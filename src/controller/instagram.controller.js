import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const CLIENT_ID = process.env.INSTAGRAM_CLIENT_ID;
const CLIENT_SECRET = process.env.INSTAGRAM_CLIENT_SECRET;
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const startInstagramAuth = (req, res) => {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      throw new Error('Missing Instagram environment variables');
    }

    const token = req.cookies.accessToken;
    console.log('startInstagramAuth - Cookies:', req.cookies);
    console.log('startInstagramAuth - Token:', token ? token.substring(0, 20) + '...' : 'Not found');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const workspaceId = req.query.workspaceId || '';
    const state = Buffer.from(JSON.stringify({ token, workspaceId })).toString('base64');
    const scope = 'user_profile,user_media';
    const authUrl = `https://www.instagram.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&response_type=code&state=${state}`;

    console.log('🔗 Instagram Auth URL:', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Instagram Auth Start Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Instagram authentication',
    });
  }
};

export const handleInstagramCallback = async (req, res) => {
  const { code, error, error_description, state } = req.query;

  if (error) {
    console.error('❌ Instagram OAuth Error:', error, error_description);
    return res.redirect(`/login?error=${error}&error_description=${encodeURIComponent(error_description)}`);
  }

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Authorization code not provided',
    });
  }

  try {
    if (!state) {
      throw new Error('State parameter missing');
    }
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { token, workspaceId } = stateData;
    console.log('handleInstagramCallback - State token:', token ? token.substring(0, 20) + '...' : 'Not found');

    if (!token) {
      throw new Error('No token provided in state');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const tokenRes = await axios.post(
      'https://api.instagram.com/oauth/access_token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code,
      })
    );

    const accessToken = tokenRes.data.access_token;
    const instagramId = tokenRes.data.user_id;

    const userInfo = await axios.get(
      `https://graph.instagram.com/me?fields=id,username,account_type&access_token=${accessToken}`
    );

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const instagramDetails = {
      platform: 'instagram',
      accountId: instagramId,
      accessToken,
      connectedAt: new Date(),
      workspaceId: workspaceId || null,
      profile: {
        username: userInfo.data.username || '',
        account_type: userInfo.data.account_type || '',
      },
    };

    const existingInstagram = user.socialMedia.find(
      (sm) => sm.platform === 'instagram' && sm.accountId === instagramId
    );

    if (existingInstagram) {
      await User.updateOne(
        { _id: userId, 'socialMedia.accountId': instagramId },
        {
          $set: {
            'socialMedia.$.accessToken': accessToken,
            'socialMedia.$.connectedAt': new Date(),
            'socialMedia.$.profile': instagramDetails.profile,
            'socialMedia.$.workspaceId': workspaceId || null,
          },
        }
      );
    } else {
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            socialMedia: instagramDetails,
          },
        }
      );
    }

    res.redirect('http://localhost:3000/dashboard?status=instagram_connected');
  } catch (error) {
    console.error('❌ Instagram Callback Error:', error.response?.data || error.message);
    res.redirect(`/login?error=server_error&error_description=${encodeURIComponent('Failed to connect Instagram')}`);
  }
};