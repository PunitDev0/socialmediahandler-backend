import axios from 'axios';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const startLinkedInAuth = (req, res) => {
  try {
    // if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    //   throw new Error('Missing LinkedIn environment variables');
    // }

    const token = req.cookies.accessToken;
    if (!token) {
      return res.status(401).send('Authentication required');
    }

    const workspaceId = req.query.workspaceId || '';
    const state = Buffer.from(JSON.stringify({ token, workspaceId })).toString('base64');
    const scope = 'profile email openid';
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&state=${state}`;

    console.log('🔗 LinkedIn Auth URL:', authUrl);
    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ LinkedIn Auth Start Error:', error.message);
    res.status(500).send('Failed to initiate LinkedIn authentication');
  }
};

export const handleLinkedInCallback = async (req, res) => {
  const { code, error, error_description, state } = req.query;
  if (error) {
    console.error('❌ LinkedIn OAuth Error:', error, error_description);
    return res.redirect(`/login?error=${error}&error_description=${encodeURIComponent(error_description)}`);
  }
  if (!code) {
    return res.status(400).send('Authorization code not provided');
  }
  try {
    if (!state) {
      throw new Error('State parameter missing');
    }
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { token, workspaceId } = stateData;

    if (!token) {
      throw new Error('No token provided in state');
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    const tokenRes = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      null,
      {
        params: {
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const accessToken = tokenRes.data.access_token;

    const userInfo = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const linkedinId = userInfo.data.sub;

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const linkedInDetails = {
      platform: 'linkedin',
      accountId: linkedinId,
      accessToken,
      connectedAt: new Date(),
      workspaceId: workspaceId || null,
      profile: {
        name: userInfo.data.name || '',
        email: userInfo.data.email || '',
        picture: userInfo.data.picture || '',
      },
    };

    const existingLinkedIn = user.socialMedia.find(
      (sm) => sm.platform === 'linkedin' && sm.accountId === linkedinId
    );

    if (existingLinkedIn) {
      await User.updateOne(
        { _id: userId, 'socialMedia.accountId': linkedinId },
        {
          $set: {
            'socialMedia.$.accessToken': accessToken,
            'socialMedia.$.connectedAt': new Date(),
            'socialMedia.$.profile': linkedInDetails.profile,
            'socialMedia.$.workspaceId': workspaceId || null,
          },
        }
      );
    } else {
      await User.updateOne(
        { _id: userId },
        {
          $push: {
            socialMedia: linkedInDetails,
          },
        }
      );
    }

    res.redirect('http://localhost:3000/dashboard?status=linkedin_connected');
  } catch (error) {
    console.error('❌ LinkedIn Callback Error:', error.response?.data || error.message);
    res.redirect(`/login?error=server_error&error_description=${encodeURIComponent('Failed to connect LinkedIn')}`);
  }
};