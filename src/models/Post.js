// models/Post.js
import mongoose from "mongoose";

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  platform: {
    type: String,
    enum: ['linkedin', 'facebook', 'twitter', 'instagram', 'youtube', 'tiktok', 'pinterest', 'threads', 'bluesky', 'googlebusiness', 'mastodon'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  mediaUrl: {
    type: String, // Optional URL for images/videos
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'posted', 'failed'],
    default: 'draft',
  },
  postedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models?.Post || mongoose.model('Post', postSchema);