import cron from 'node-cron';
import Schedule from '../models/Schedule.js';
import { executeScheduledPost } from '../controller/Sheduling/linkedinPost.controller.js';

export const startCronJobs = () => {
  // Run every minute to check for pending schedules
  cron.schedule('* * * * *', async () => {
    try {
      console.log('Checking for scheduled posts...');
      const now = new Date();
      const schedules = await Schedule.find({
        status: 'pending',
        scheduledTime: { $lte: now },
      });

      for (const schedule of schedules) {
        console.log('Executing schedule:', schedule._id);
        await executeScheduledPost(schedule._id);
      }
    } catch (error) {
      console.error('Cron job error:', error);
    }
  });
};