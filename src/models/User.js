// models/User.js
import mongoose from 'mongoose';

const socialMediaSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['linkedin', 'facebook', 'twitter', 'instagram', 'youtube', 'tiktok', 'pinterest', 'threads', 'bluesky', 'googlebusiness', 'mastodon'],
    required: true,
  },
  accessToken: {
    type: String,
    required: true,
  },
  refreshToken: {
    type: String,
  },
  tokenExpiry: {
    type: Date,
  },
  accountId: {
    type: String,
    required: true,
  },
  connectedAt: {
    type: Date,
    default: Date.now,
  },
});

const googleAuthSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
  },
  accessToken: {
    type: String,
    required: true,
  },
  refreshToken: {
    type: String,
  },
  email: {
    type: String,
    required: true,
  },
});

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  googleAuth: {
    type: googleAuthSchema,
    default: null,
  },
  socialMedia: [socialMediaSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Export using ES6 module syntax
export default mongoose.models?.User || mongoose.model('User', userSchema);