import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const CLIENT_ID = process.env.TWITTER_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
const REDIRECT_URI = process.env.TWITTER_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const startTwitterAuth = (req, res) => {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      throw new Error('Missing Twitter environment variables');
    }

    const token = req.cookies.accessToken;
    console.log('startTwitterAuth - Cookies:', req.cookies);
    console.log('startTwitterAuth - Token:', token ? token.substring(0, 20) + '...' : 'Not found');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const workspaceId = req.query.workspaceId || '';
    const state = Buffer.from(JSON.stringify({ token, workspaceId })).toString('base64');
    const scope = 'users.read tweet.read tweet.write';
    const authUrl = `https://api.twitter.com/2/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&state=${state}&code_challenge=challenge&code_challenge_method=plain`;

    console.log('🔗 Twitter Auth URL:', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Twitter Auth Start Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate Twitter authentication',
    });
  }
};

export const handleTwitterCallback = async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    console.error('❌ Twitter OAuth Error:', error);
    return res.redirect(`/login?error=${error}&error_description=${encodeURIComponent('Twitter authentication failed')}`);
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
    console.log('handleTwitterCallback - State token:', token ? token.substring(0, 20) + '...' : 'Not found');

    if (!token) {
      throw new Error('No token provided in state');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const tokenRes = await axios.post(
      'https://api.twitter.com/2/oauth2/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: 'challenge',
      }),
      {
        auth: {
          username: CLIENT_ID,
          password: CLIENT_SECRET,
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    const userInfo = await axios.get('https://api.twitter.com/2/users/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const twitterId = userInfo.data.data.id;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const twitterDetails = {
      platform: 'twitter',
      accountId: twitterId,
      accessToken,
      connectedAt: new Date(),
      workspaceId: workspaceId || null,
      profile: {
        name: userInfo.data.data.name || '',
        username: userInfo.data.data.username || '',
        picture: userInfo.data.data.profile_image_url || '',
      },
    };

    const existingTwitter = user.socialMedia.find(
      (sm) => sm.platform === 'twitter' && sm.accountId === twitterId
    );

    if (existingTwitter) {
      await User.updateOne(
        { _id: userId, 'socialMedia.accountId': twitterId },
        {
          $set: {
            'socialMedia.$.accessToken': accessToken,
            'socialMedia.$.connectedAt': new Date(),
            'socialMedia.$.profile': twitterDetails.profile,
            'socialMedia.$.workspaceId': workspaceId || null,
          },
        }
      );
    } else {
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            socialMedia: twitterDetails,
          },
        }
      );
    }

    res.redirect('http://localhost:3000/dashboard?status=twitter_connected');
  } catch (error) {
    console.error('❌ Twitter Callback Error:', error.response?.data || error.message);
    res.redirect(`/login?error=server_error&error_description=${encodeURIComponent('Failed to connect Twitter')}`);
  }
};