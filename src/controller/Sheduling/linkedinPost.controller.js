import Post from '../../models/Post.js';
import User from '../../models/User.js';
import Schedule from '../../models/Schedule.js';
import axios from 'axios';
import FormData from 'form-data';



export const scheduleLinkedInPost = async (req, res) => {
  try {
    const { content, hashtags, scheduledTime } = req.body;
    const mediaFiles = req.files; // Array of images from multer

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
    if (hashtags) {
      try {
        parsedHashtags = JSON.parse(hashtags);
        if (!Array.isArray(parsedHashtags)) {
          throw new Error('Hashtags must be an array');
        }
      } catch (error) {
        console.error('Hashtag parse error:', error.message);
        return res.status(400).json({ success: false, message: 'Invalid hashtags format' });
      }
    }

    // Validate media files
    if (mediaFiles && mediaFiles.length > 5) {
      return res.status(400).json({ success: false, message: 'Maximum 5 images allowed' });
    }
    if (mediaFiles) {
      for (const file of mediaFiles) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
          return res.status(400).json({ success: false, message: 'Only JPEG, PNG, or GIF images allowed' });
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          return res.status(400).json({ success: false, message: 'Image size must be under 5MB' });
        }
      }
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

    // // Validate scopes
    // if (!linkedinAccount.scopes?.includes('w_member_social')) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Missing w_member_social permission. Please reconnect your LinkedIn account.',
    //   });
    // }

    // Validate access token
    try {
      await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${linkedinAccount.accessToken}`,
          'LinkedIn-Version': '202409', // Updated to latest version
        },
      });
    } catch (tokenError) {
      console.error('Invalid LinkedIn token:', tokenError.response?.data || tokenError.message);
      return res.status(401).json({
        success: false,
        message: 'LinkedIn access token is invalid or expired. Please reconnect your account.',
      });
    }

    // Combine content with hashtags
    const fullContent = `${content}\n${parsedHashtags.map((tag) => `#${tag}`).join(' ')}`.trim();

    // Create post
    const post = new Post({
      userId: req.user.id,
      platform: 'linkedin',
      content: fullContent,
      mediaUrl: '',
      status: 'scheduled',
      createdAt: new Date(),
    });

    let mediaAssets = [];

    // Handle image uploads
    if (mediaFiles && mediaFiles.length > 0) {
      for (const mediaFile of mediaFiles) {
        try {
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
                'LinkedIn-Version': '202409',
                'X-Restli-Protocol-Version': '2.0.0',
              },
            }
          );

          const uploadUrl =
            registerResponse.data.value.uploadMechanism[
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
              'LinkedIn-Version': '202409',
            },
          });

          mediaAssets.push(mediaAsset);
        } catch (uploadError) {
          console.error('Media upload error:', {
            message: uploadError.message,
            response: uploadError.response?.data,
            status: uploadError.response?.status,
          });
          if (uploadError.response?.status === 403) {
            return res.status(403).json({
              success: false,
              message: 'Permission denied for media upload. Ensure w_member_social scope is granted.',
            });
          }
          if (uploadError.response?.status === 429) {
            return res.status(429).json({
              success: false,
              message: 'LinkedIn rate limit exceeded. Try again later.',
            });
          }
          throw new Error(`Media upload failed: ${uploadError.message}`);
        }
      }

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

    console.log('LinkedIn post scheduled:', {
      postId: post._id,
      scheduleId: schedule._id,
      scheduledTime: scheduledDate,
    });

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
    console.error('Schedule LinkedIn post error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Failed to schedule post',
      error: error.response?.data?.message || error.message,
    });
  }
};

export const executeScheduledPost = async (scheduleId) => {
  try {
    const schedule = await Schedule.findById(scheduleId).populate('postId userId');
    if (!schedule) {
      console.log('Schedule not found:', scheduleId);
      return;
    }
    if (schedule.status !== 'pending') {
      console.log('Schedule not pending:', { scheduleId, status: schedule.status });
      return;
    }

    // Verify scheduled time
    const now = new Date();
      const ISTOffset = 5.5 * 60 * 60 * 1000; // IST is UTC +5:30
      const nowIST = new Date(now.getTime() + ISTOffset);
    if (schedule.scheduledTime > nowIST) {
      console.log('Scheduled time not reached:', {
        scheduleId,
        scheduledTime: schedule.scheduledTime,
        now,
      });
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

 
    try {
      await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${linkedinAccount.accessToken}`,
          'LinkedIn-Version': '202409',
        },
      });
    } catch (tokenError) {
      console.error('Invalid LinkedIn token:', {
        message: tokenError.message,
        response: tokenError.response?.data,
      });
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

    try {
      const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', payload, {
        headers: {
          Authorization: `Bearer ${linkedinAccount.accessToken}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202409',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      });

      // Update statuses
      schedule.status = 'completed';
      schedule.executedAt = new Date();
      post.status = 'posted';
      post.postedAt = new Date();
      post.linkedinPostId = response.data.id; // Store LinkedIn post ID for reference

      await Promise.all([schedule.save(), post.save()]);

      console.log('Scheduled post executed:', {
        scheduleId,
        linkedinPostId: response.data.id,
      });
    } catch (postError) {
      console.error('LinkedIn post error:', {
        message: postError.message,
        response: postError.response?.data,
        status: postError.response?.status,
      });
      if (postError.response?.status === 429) {
        console.log('Rate limit hit, marking schedule for retry:', scheduleId);
        schedule.status = 'pending'; // Allow retry
      } else {
        schedule.status = 'failed';
        post.status = 'failed';
      }
      await Promise.all([schedule.save(), post.save()]);
    }
  } catch (error) {
    console.error('Execute scheduled post error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
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