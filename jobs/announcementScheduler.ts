import cron from 'node-cron';
import db from '@/models';
import { Op } from 'sequelize';

export function startAnnouncementScheduler() {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      
      const [updatedCount] = await db.Announcement.update(
        { status: 'sent' },
        {
          where: {
            status: 'scheduled',
            scheduledAt: { [Op.lte]: now }
          }
        }
      );

      if (updatedCount > 0) {
        console.log(`[Announcement Scheduler] Updated ${updatedCount} announcement(s) to 'sent' status`);
      }
    } catch (error) {
      console.error('[Announcement Scheduler] Error:', error);
    }
  });

  console.log('[Announcement Scheduler] Started - running every minute');
}
