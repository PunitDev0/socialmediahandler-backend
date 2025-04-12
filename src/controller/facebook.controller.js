import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const CLIENT_ID = process.env.FACEBOOK_CLIENT_ID;
const CLIENT_SECRET = process.env.FACEBOOK_CLIENT_SECRET;
const REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const startFacebookAuth = (req, res) => {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      throw new Error('Missing Facebook environment variables');
    }

    const token = req.cookies.accessToken;
    console.log('startFacebookAuth - Cookies:', req.cookies);
    console.log('startFacebookAuth - Token:', token ? token.substring(0, 20) + '...' : 'Not found');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const workspaceId = req.query.workspaceId || '';
    const state = Buffer.from(JSON.stringify({ token, workspaceId })).toString('base64');
    const scope = 'public_profile,email';
    const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&state=${state}`;

    console.log('🔗 Facebook Auth URL:', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Facebook Auth Start Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Facebook authentication',
    });
  }
};

export const handleFacebookCallback = async (req, res) => {
  const { code, error, error_description, state } = req.query;

  if (error) {
    console.error('❌ Facebook OAuth Error:', error, error_description);
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
    console.log('handleFacebookCallback - State token:', token ? token.substring(0, 20) + '...' : 'Not found');

    if (!token) {
      throw new Error('No token provided in state');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const tokenRes = await axios.get('https://graph.facebook.com/v20.0/oauth/access_token', {
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      },
    });

    const accessToken = tokenRes.data.access_token;

    const userInfo = await axios.get('https://graph.facebook.com/me?fields=id,name,email,picture', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const facebookId = userInfo.data.id;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const facebookDetails = {
      platform: 'facebook',
      accountId: facebookId,
      accessToken,
      connectedAt: new Date(),
      workspaceId: workspaceId || null,
      profile: {
        name: userInfo.data.name || '',
        email: userInfo.data.email || '',
        picture: userInfo.data.picture?.data?.url || '',
      },
    };

    const existingFacebook = user.socialMedia.find(
      (sm) => sm.platform === 'facebook' && sm.accountId === facebookId
    );

    if (existingFacebook) {
      await User.updateOne(
        { _id: userId, 'socialMedia.accountId': facebookId },
        {
          $set: {
            'socialMedia.$.accessToken': accessToken,
            'socialMedia.$.connectedAt': new Date(),
            'socialMedia.$.profile': facebookDetails.profile,
            'socialMedia.$.workspaceId': workspaceId || null,
          },
        }
      );
    } else {
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            socialMedia: facebookDetails,
          },
        }
      );
    }

    res.redirect('http://localhost:3000/dashboard?status=facebook_connected');
  } catch (error) {
    console.error('❌ Facebook Callback Error:', error.response?.data || error.message);
    res.redirect(`/login?error=server_error&error_description=${encodeURIComponent('Failed to connect Facebook')}`);
  }
};