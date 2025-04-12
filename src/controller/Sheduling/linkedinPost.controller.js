import Post from '../../models/Post.js'
import User from '../../models/User.js';
import Schedule from '../../models/Schedule.js';
import axios from 'axios';
import FormData from 'form-data';

export const scheduleLinkedInPost = async (req, res) => {
  try {
    const { content, hashtags, scheduledTime } = req.body;
    const mediaFiles = req.files; // Array of images

    // Validate input
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content is required' });
    }
    if (!scheduledTime) {
      return res.status(400).json({ success: false, message: 'Scheduled time is required' });
    }

    // Validate scheduledTime
    const scheduledDate = new Date(scheduledTime);
    if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return res.status(400).json({ success: false, message: 'Scheduled time must be in the future' });
    }

    // Parse hashtags
    let parsedHashtags = [];
    try {
      parsedHashtags = hashtags ? JSON.parse(hashtags) : [];
    } catch (error) {
      console.error('Hashtag parse error:', error);
      return res.status(400).json({ success: false, message: 'Invalid hashtags format' });
    }

    // Limit media files
    if (mediaFiles && mediaFiles.length > 5) {
      return res.status(400).json({ success: false, message: 'Maximum 5 images allowed' });
    }

    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find LinkedIn account
    const linkedinAccount = user.socialMedia.find((sm) => sm.platform === 'linkedin');
    if (!linkedinAccount) {
      return res.status(400).json({
        success: false,
        message: 'LinkedIn account not connected',
      });
    }

    // Combine content with hashtags
    const fullContent = `${content}\n${parsedHashtags.map((tag) => `#${tag}`).join(' ')}`.trim();

    // Create post
    const post = new Post({
      userId: req.user.id,
      platform: 'linkedin',
      content: fullContent,
      mediaUrl: '', // Will store comma-separated asset URNs
      status: 'scheduled',
      createdAt: new Date(),
    });

    let mediaAssets = [];

    // Handle image uploads
    if (mediaFiles && mediaFiles.length > 0) {
      for (const mediaFile of mediaFiles) {
        // Register upload
        const registerResponse = await axios.post(
          'https://api.linkedin.com/v2/assets?action=registerUpload',
          {
            registerUploadRequest: {
              recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
              owner: `urn:li:person:${linkedinAccount.accountId}`,
              serviceRelationships: [
                {
                  relationshipType: 'OWNER',
                  identifier: 'urn:li:userGeneratedContent',
                },
              ],
            },
          },
          {
            headers: {
              Authorization: `Bearer ${linkedinAccount.accessToken}`,
              'Content-Type': 'application/json',
              'X-Restli-Protocol-Version': '2.0.0',
            },
          }
        );

        const uploadUrl = registerResponse.data.value.uploadMechanism[
          'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
        ].uploadUrl;
        const mediaAsset = registerResponse.data.value.asset;

        // Upload image
        const form = new FormData();
        form.append('file', mediaFile.buffer, {
          filename: mediaFile.originalname,
          contentType: mediaFile.mimetype,
        });

        await axios.put(uploadUrl, form, {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${linkedinAccount.accessToken}`,
          },
        });

        mediaAssets.push(mediaAsset);
      }

      // Store asset URNs
      post.mediaUrl = mediaAssets.join(',');
    }

    // Save post
    await post.save();

    // Create schedule
    const schedule = new Schedule({
      userId: req.user.id,
      postId: post._id,
      platform: 'linkedin',
      scheduledTime: scheduledDate,
      status: 'pending',
      createdAt: new Date(),
    });

    await schedule.save();

    console.log('LinkedIn post scheduled:', { postId: post._id, scheduleId: schedule._id });
    res.status(200).json({
      success: true,
      post: {
        id: post._id,
        content: post.content,
        mediaUrl: post.mediaUrl,
        status: post.status,
      },
      schedule: {
        id: schedule._id,
        scheduledTime: schedule.scheduledTime,
      },
    });
  } catch (error) {
    console.error('Schedule LinkedIn post error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule post',
      error: error.response?.data?.message || error.message,
    });
  }
};

// Execute scheduled post (called by cron)
export const executeScheduledPost = async (scheduleId) => {
  try {
    const schedule = await Schedule.findById(scheduleId).populate('postId userId');
    if (!schedule || schedule.status !== 'pending') {
      console.log('Schedule not found or not pending:', scheduleId);
      return;
    }

    const post = schedule.postId;
    const user = schedule.userId;

    // Find LinkedIn account
    const linkedinAccount = user.socialMedia.find((sm) => sm.platform === 'linkedin');
    if (!linkedinAccount) {
      console.error('LinkedIn account not connected for user:', user._id);
      schedule.status = 'failed';
      post.status = 'failed';
      await Promise.all([schedule.save(), post.save()]);
      return;
    }

    // Prepare media assets
    const mediaAssets = post.mediaUrl ? post.mediaUrl.split(',') : [];

    // Create LinkedIn post
    const payload = {
      author: `urn:li:person:${linkedinAccount.accountId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: post.content },
          shareMediaCategory: mediaAssets.length > 0 ? 'IMAGE' : 'NONE',
          media: mediaAssets.map((asset) => ({
            status: 'READY',
            media: asset,
          })),
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const response = await axios.post(
      'https://api.linkedin.com/v2/ugcPosts',
      payload,
      {
        headers: {
          Authorization: `Bearer ${linkedinAccount.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
    );

    // Update statuses
    schedule.status = 'completed';
    schedule.executedAt = new Date();
    post.status = 'posted';
    post.postedAt = new Date();

    await Promise.all([schedule.save(), post.save()]);

    console.log('Scheduled post executed:', { scheduleId, linkedinPostId: response.data.id });
  } catch (error) {
    console.error('Execute scheduled post error:', error.response?.data || error.message);
    const schedule = await Schedule.findById(scheduleId);
    if (schedule) {
      schedule.status = 'failed';
      await schedule.save();
      const post = await Post.findById(schedule.postId);
      if (post) {
        post.status = 'failed';
        await post.save();
      }
    }
  }
};