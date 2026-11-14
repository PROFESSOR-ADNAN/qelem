import { User } from '../models/User.js';
import { logger } from '../utils/logger.js';
import { redis } from '../config/redis.js';

export class TelegramService {
  private static botToken = process.env.TELEGRAM_BOT_TOKEN || null;

  static isConfigured(): boolean {
    return Boolean(this.botToken);
  }

  static async generateLinkCode(userId: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    // Cache sync code for 10 minutes in Redis
    await redis.setex(`telegram:sync:${code}`, 600, userId);
    return code;
  }

  static async handleWebhook(body: any): Promise<void> {
    if (!body?.message) return;

    const chatId = body.message.chat?.id;
    const text = (body.message.text || '').trim();

    // Check if user sent /start <syncCode>
    if (text.startsWith('/start ')) {
      const code = text.split(' ')[1]?.trim();
      if (!code) return;

      const userId = await redis.get(`telegram:sync:${code}`);
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          $set: { telegramChatId: String(chatId) }
        });
        await redis.del(`telegram:sync:${code}`);
        await this.sendMessage(
          String(chatId),
          `✅ <b>Account Linked!</b>\n\nYour Telegram is now connected to Qelem. You will receive real-time alerts whenever other students comment on your devlogs or mention you.`
        );
        logger.info({ msg: 'Telegram account linked to Qelem user', userId, chatId });
      }
    }
  }

  static async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.botToken) {
      logger.debug({ msg: 'TELEGRAM_BOT_TOKEN not set; skipping live dispatch', chatId, text });
      return true;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML'
        })
      });
      return res.ok;
    } catch (err: any) {
      logger.error({ msg: 'Failed to send Telegram notification', error: err.message });
      return false;
    }
  }

  static async notifyComment(recipientChatId: string, actorUsername: string, postText: string, postId: string): Promise<void> {
    const preview = postText.length > 80 ? postText.slice(0, 80) + '...' : postText;
    const message = `💬 <b>New comment from @${actorUsername}</b>\n\nOn devlog: "<i>${preview}</i>"\n\n👉 <a href="https://qelem.vercel.app/p/${postId}">View discussion on Qelem</a>`;
    await this.sendMessage(recipientChatId, message);
  }
}
