import cron from 'node-cron';
import Schedule from '../models/Schedule.js';
import { executeScheduledPost } from '../controller/Sheduling/linkedinPost.controller.js';

export const startCronJobs = () => {
  // Run every minute to check for pending schedules
  cron.schedule('* * * * *', async () => {
    try {
      console.log('Checking for scheduled posts...');
      const now = new Date();
      const ISTOffset = 5.5 * 60 * 60 * 1000; // IST is UTC +5:30
      const nowIST = new Date(now.getTime() + ISTOffset);
      console.log(nowIST);
      
      const schedules = await Schedule.find({
        status: 'pending',
        scheduledTime: { $lte: nowIST  },
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