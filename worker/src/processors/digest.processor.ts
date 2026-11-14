import { Job } from 'bullmq';
import { Post } from '../../../server/src/models/Post.js';
import { User } from '../../../server/src/models/User.js';
import { EmailSuppression } from '../../../server/src/models/EmailSuppression.js';
import { emailQueue } from '../../../server/src/services/queue.service.js';
import { logger } from '../../../server/src/utils/logger.js';
import { checkAndIncrementQuota } from './email.processor.js';

export async function processWeeklyDigestJob(_job: Job<any>): Promise<void> {
  logger.info({ msg: 'Running weekly devlog digest processor...' });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // 1. Fetch top 3 devlogs of the week
  const topPosts = await Post.find({
    state: 'published',
    publishedAt: { $gte: sevenDaysAgo }
  })
    .sort({ likeCount: -1, commentCount: -1, _id: -1 })
    .limit(3)
    .populate('authorId', 'username displayName')
    .lean();

  if (topPosts.length === 0) {
    logger.info({ msg: 'No posts in past 7 days to compile into weekly digest' });
    return;
  }

  // 2. Query verified active users (up to 50 recipients per batch to respect daily quota)
  const recipients = await User.find({
    state: 'active',
    isEmailVerified: true
  })
    .limit(50)
    .lean();

  logger.info({ msg: `Found ${recipients.length} eligible recipients for weekly digest` });

  for (const user of recipients) {
    // Check suppression
    const isSuppressed = await EmailSuppression.findOne({ emailLower: user.emailLower });
    if (isSuppressed) continue;

    // Check daily budget
    const hasQuota = await checkAndIncrementQuota();
    if (!hasQuota) {
      logger.warn({ msg: 'Quota exhausted during weekly digest dispatch; halting batch' });
      break;
    }

    const postsHtml = topPosts
      .map((p: any) => {
        const author = p.authorId?.displayName || p.authorId?.username || 'Dev';
        return `
          <div style="margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #1e293b;">
              by @${p.authorId?.username || 'anon'} (${author})
            </p>
            <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.4;">
              ${p.text.slice(0, 180)}...
            </p>
          </div>
        `;
      })
      .join('');

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin-top: 0;">Weekly Top Devlogs on Qelem 🇪🇹</h2>
        <p style="font-size: 14px; color: #475569;">
          Hi ${user.displayName}, here are the most insightful devlogs published by your Ethiopian CS peers this week:
        </p>
        ${postsHtml}
        <div style="margin-top: 24px; text-align: center;">
          <a href="https://qelem.vercel.app/explore" style="background-color: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 13px; display: inline-block;">
            Explore More Devlogs
          </a>
        </div>
      </div>
    `;

    await emailQueue.add('weekly-digest-email', {
      to: user.email,
      subject: 'Top Devlogs of the Week - Qelem',
      htmlBody
    });
  }

  logger.info({ msg: 'Weekly digest job finished dispatching.' });
}
