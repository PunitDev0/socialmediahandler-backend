import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
console.log(process.env.CLIENT_ID);

let userAccessToken = null;

export const startLinkedInAuth = (req, res) => {
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=r_liteprofile%20r_emailaddress%20w_member_social`;
  res.redirect(authUrl);
};

export const handleCallback = async (req, res) => {
  const code = req.query.code;

  try {
    const tokenRes = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
      params: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    userAccessToken = tokenRes.data.access_token;
    console.log('✅ Access Token:', userAccessToken);

    res.redirect('http://localhost:5500/?status=connected'); // frontend redirect
  } catch (err) {
    console.error('❌ Error:', err.response?.data || err.message);
    res.status(500).send('Failed to retrieve token');
  }
};

export const getTokenStatus = (req, res) => {
  if (userAccessToken) {
    res.json({ status: 'connected' });
  } else {
    res.json({ status: 'not_connected' });
  }
};
