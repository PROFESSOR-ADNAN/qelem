import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ChapaService } from '../services/chapa.service.js';
import { User } from '../models/User.js';
import { Post } from '../models/Post.js';
import { AppError } from '../middleware/error.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const InitializeTipSchema = z.object({
  authorId: z.string(),
  postId: z.string().optional(),
  amount: z.coerce.number().min(10, 'Minimum tip amount is 10 ETB').max(50000, 'Maximum tip amount is 50,000 ETB'),
  currency: z.enum(['ETB', 'USD']).default('ETB'),
  email: z.string().email(),
  name: z.string().min(2).max(100),
  message: z.string().max(280).optional()
});

export class PaymentController {
  static getStatus(_req: Request, res: Response): void {
    res.json({
      enabled: ChapaService.isConfigured(),
      provider: 'Chapa',
      supportedMethods: ['telebirr', 'cbe_birr', 'awash_birr', 'cards', 'bank_transfer'],
      currency: 'ETB',
      publicKey: env.CHAPA_PUBLIC_KEY || null
    });
  }

  static async initializeTip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = InitializeTipSchema.parse(req.body);

      const author = await User.findById(parsed.authorId);
      if (!author) {
        throw new AppError(404, 'Author not found');
      }

      if (parsed.postId) {
        const post = await Post.findById(parsed.postId);
        if (!post) {
          throw new AppError(404, 'Post not found');
        }
      }

      const txRef = `qelem-tip-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const nameParts = parsed.name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || 'Supporter';

      const result = await ChapaService.initializePayment({
        amount: parsed.amount,
        currency: parsed.currency,
        email: parsed.email,
        firstName,
        lastName,
        txRef,
        customization: {
          title: `Tip @${author.username} on Qelem`,
          description: parsed.message ? `"${parsed.message}"` : `Support for devlog by @${author.username}`
        },
        meta: {
          authorId: author._id.toString(),
          postId: parsed.postId || null,
          supporterId: req.user?.id || null,
          message: parsed.message || null
        }
      });

      res.status(200).json({
        success: true,
        checkoutUrl: result.checkoutUrl,
        txRef: result.txRef
      });
    } catch (err) {
      next(err);
    }
  }

  static async verifyTip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { txRef } = req.params;
      if (!txRef) {
        throw new AppError(400, 'Transaction reference txRef is required');
      }

      const verification = await ChapaService.verifyPayment(txRef as string);
      res.status(200).json({
        success: verification.status === 'success',
        status: verification.status,
        amount: verification.amount,
        currency: verification.currency,
        txRef: verification.txRef
      });
    } catch (err) {
      next(err);
    }
  }

  static async webhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['x-chapa-signature'] as string;
    const body = req.body;

    logger.info({ msg: 'Chapa webhook event received', event: body?.event, tx_ref: body?.tx_ref });

    if (signature && !ChapaService.verifyWebhookSignature(JSON.stringify(body), signature)) {
      logger.warn({ msg: 'Invalid Chapa webhook signature received' });
      res.status(400).send('Invalid signature');
      return;
    }

    // Acknowledge webhook receipt to Chapa immediately
    res.status(200).json({ received: true });
  }
}
