import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { emailQueue } from './queue.service.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
});

export class EmailService {
  static async sendVerificationEmail(email: string, displayName: string, token: string): Promise<void> {
    const webBase = (env.WEB_BASE_URL || 'https://qelem.vercel.app').replace(/\/$/, '');
    const verifyUrl = `${webBase}/verify-email?token=${token}`;

    const subject = `Verify your email address - Qelem`;
    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin-top: 0;">Welcome to Qelem, ${displayName}!</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          Thank you for joining Qelem — the devlog and learning community for Ethiopian computer science students.
        </p>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          Please confirm your email address by clicking the button below to verify your account and unlock posting privileges.
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${verifyUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          Or copy and paste this link in your browser:<br/>
          <a href="${verifyUrl}" style="color: #2563eb; word-break: break-all;">${verifyUrl}</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">
          This verification link expires in 24 hours. If you did not create an account on Qelem, you can safely ignore this email.
        </p>
      </div>
    `;

    // Try direct delivery with SMTP if configured
    if (env.SMTP_USER && env.SMTP_PASS) {
      try {
        await transporter.sendMail({
          from: env.EMAIL_FROM,
          to: email,
          subject,
          html: htmlBody
        });
        logger.info({ msg: 'Verification email sent directly via SMTP', to: email });
        return;
      } catch (err: any) {
        logger.error({ msg: 'Direct SMTP send failed, queuing verification email fallback', error: err.message });
      }
    }

    // Fallback to queue if SMTP failed or queue is running
    try {
      await emailQueue.add('verification-email', {
        to: email,
        type: 'verification',
        subject,
        htmlBody
      });
      logger.info({ msg: 'Verification email queued in BullMQ', to: email });
    } catch (qErr: any) {
      logger.error({ msg: 'Failed to queue verification email', error: qErr.message });
    }
  }
}
