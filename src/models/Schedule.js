// models/Schedule.js
import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
  },
  platform: {
    type: String,
    enum: ['linkedin', 'facebook', 'twitter', 'instagram', 'youtube', 'tiktok', 'pinterest', 'threads', 'bluesky', 'googlebusiness', 'mastodon'],
    required: true,
  },
  scheduledTime: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  executedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.models?.Schedule || mongoose.model('Schedule', scheduleSchema);
