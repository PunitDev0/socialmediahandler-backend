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
    const token = req.cookies.accesstoken;
    const workspaceId = req.query.workspaceId || '';

    if (!token) {
      console.error('❌ No accessToken cookie found');
      return res.status(401).send('Authentication required');
    }

    console.log('🔍 Access Token Cookie:', token);
    console.log('🔍 State Data:', { token, workspaceId });

    const state = Buffer.from(JSON.stringify({ token, workspaceId })).toString('base64');

    const scope = 'profile email openid w_member_social';
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
  console.log('Callback Query:', { code, error, error_description, state });

  if (error) {
    console.error('❌ LinkedIn OAuth Error:', error, error_description);
    return res.redirect(`/login?error=${error}&error_description=${encodeURIComponent(error_description)}`);
  }

  if (!code) {
    console.error('❌ Authorization code missing');
    return res.status(400).send('Authorization code not provided');
  }

  if (!state) {
    console.error('❌ State parameter missing');
    return res.status(400).send('State parameter missing');
  }

  try {
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (err) {
      console.error('❌ Invalid state format:', err.message);
      throw new Error('Invalid state parameter');
    }

    console.log('🔍 Decoded State:', stateData);

    const { token, workspaceId } = stateData;

    if (!token) {
      console.error('❌ No token provided in state');
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
    const scopes = tokenRes.data.scope ? tokenRes.data.scope.split(',') : [];

    if (!scopes.includes('w_member_social')) {
      console.error('❌ Missing w_member_social scope in token response:', scopes);
      throw new Error('LinkedIn token does not include w_member_social permission');
    }

    const userInfo = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': '202409',
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
      scopes,
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
            'socialMedia.$.scopes': scopes,
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

    console.log('✅ LinkedIn connected for user:', userId, 'Scopes:', scopes);
    res.redirect('http://localhost:3000/dashboard?status=linkedin_connected');
  } catch (error) {
    console.error('❌ LinkedIn Callback Error:', error.response?.data || error.message);
    res.redirect(`/login?error=server_error&error_description=${encodeURIComponent('Failed to connect LinkedIn')}`);
  }
};