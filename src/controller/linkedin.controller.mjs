import axios from 'axios';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

let userAccessToken = null;

// Step 1: Start LinkedIn Auth
export const startLinkedInAuth = (req, res) => {
  try {
    console.log(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      throw new Error('Missing required environment variables');
    }

    // Updated scopes to match LinkedIn Developer Portal
    const scope = 'profile email openid '

    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scope)}`;
    console.log('🔗 LinkedIn Auth URL:', authUrl);

    res.redirect(authUrl);
  } catch (error) {
    console.error('❌ Auth Start Error:', error.message);
    res.status(500).send('Failed to initiate authentication');
  }
};

// Step 2: Handle Callback
export const handleCallback = async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.error('❌ OAuth Error:', error, error_description);
    return res.redirect(`http://localhost:5000/?error=${error}&error_description=${encodeURIComponent(error_description)}`); // Updated redirect to port 5000
  }

  if (!code) {
    return res.status(400).send('Authorization code not provided');
  }

  try {
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
    userAccessToken = accessToken;
    console.log('✅ Access Token:', accessToken);
    console.log('📜 Token Response:', tokenRes.data); // Log full token response

    const userInfo = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,      },
    });
    console.log('👤 User Info:', userInfo.data);

    const linkedinId = userInfo.data.id;
    const name = `${userInfo.data.localizedFirstName} ${userInfo.data.localizedLastName}`

    let user = await User.findOne({ 'socialMedia.accountId': linkedinId });
    if (!user) {
      user = new User({
        email,
        name,
        socialMedia: [
          {
            platform: 'linkedin',
            accessToken,
            accountId: linkedinId,
            connectedAt: new Date(),
          },
        ],
      });
      await user.save();
      console.log('✅ New user saved:', user);
    } else {
      await User.updateOne(
        { 'socialMedia.accountId': linkedinId },
        {
          $set: {
            'socialMedia.$.accessToken': accessToken,
            'socialMedia.$.connectedAt': new Date(),
          },
        }
      );
      console.log('✅ LinkedIn updated for user:', user.email);
    }

    res.redirect(`http://localhost:5000/?status=connected&userId=${user._id}`); // Updated redirect to port 5000
  } catch (error) {
    console.error('❌ Callback Error:', error.response?.data || error.message);
    res.redirect(`http://localhost:5000/?error=server_error&error_description=${encodeURIComponent('Failed to retrieve access token or user data')}`);
  }
};

// Step 3: Token Status Checker
export const getTokenStatus = (req, res) => {
  try {
    res.json({
      status: userAccessToken ? 'connected' : 'not_connected',
      token: process.env.NODE_ENV === 'development' ? userAccessToken : undefined,
    });
  } catch (error) {
    console.error('❌ Token Status Error:', error.message);
    res.status(500).send('Failed to get token status');
  }
};