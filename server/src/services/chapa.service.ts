import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../middleware/error.js';

export interface ChapaInitializeOptions {
  amount: number | string;
  currency?: string;
  email: string;
  firstName: string;
  lastName?: string;
  txRef: string;
  callbackUrl?: string;
  returnUrl?: string;
  customization?: {
    title?: string;
    description?: string;
    logo?: string;
  };
  meta?: Record<string, any>;
}

export interface ChapaInitializeResult {
  checkoutUrl: string;
  txRef: string;
}

export interface ChapaVerifyResult {
  status: 'success' | 'failed' | 'pending';
  amount: number;
  currency: string;
  txRef: string;
  email: string;
  raw: any;
}

const CHAPA_API_BASE = 'https://api.chapa.co/v1';

export class ChapaService {
  static isConfigured(): boolean {
    return Boolean(env.CHAPA_SECRET_KEY);
  }

  static async initializePayment(options: ChapaInitializeOptions): Promise<ChapaInitializeResult> {
    if (!this.isConfigured()) {
      throw new AppError(
        503,
        'Chapa payments are not configured on this server. Set CHAPA_SECRET_KEY to enable Ethiopian payment methods (Telebirr, CBE Birr).'
      );
    }

    const payload = {
      amount: String(options.amount),
      currency: options.currency || 'ETB',
      email: options.email,
      first_name: options.firstName,
      last_name: options.lastName || 'Developer',
      tx_ref: options.txRef,
      callback_url: options.callbackUrl || `${env.API_BASE_URL}/api/v1/payments/chapa/webhook`,
      return_url: options.returnUrl || `${env.WEB_BASE_URL}/tips/success?tx_ref=${options.txRef}`,
      customization: {
        title: options.customization?.title || 'Qelem Devlog Tip',
        description: options.customization?.description || 'Support an Ethiopian developer / CS student',
        ...(options.customization?.logo ? { logo: options.customization.logo } : {})
      },
      meta: options.meta || {}
    };

    try {
      const response = await fetch(`${CHAPA_API_BASE}/transaction/initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CHAPA_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as any;

      if (!response.ok || data.status !== 'success') {
        logger.error({ msg: 'Chapa initialization failed', error: data });
        throw new AppError(400, data.message || 'Failed to initialize Chapa transaction');
      }

      return {
        checkoutUrl: data.data.checkout_url,
        txRef: options.txRef
      };
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      logger.error({ msg: 'Chapa network error during initialization', error: err.message });
      throw new AppError(502, 'Unable to communicate with Chapa payment gateway');
    }
  }

  static async verifyPayment(txRef: string): Promise<ChapaVerifyResult> {
    if (!this.isConfigured()) {
      throw new AppError(503, 'Chapa payments are not configured on this server');
    }

    try {
      const response = await fetch(`${CHAPA_API_BASE}/transaction/verify/${txRef}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${env.CHAPA_SECRET_KEY}`
        }
      });

      const data = (await response.json()) as any;

      if (!response.ok || data.status !== 'success') {
        return {
          status: 'failed',
          amount: 0,
          currency: 'ETB',
          txRef,
          email: '',
          raw: data
        };
      }

      return {
        status: data.data.status === 'success' ? 'success' : 'pending',
        amount: parseFloat(data.data.amount),
        currency: data.data.currency,
        txRef: data.data.tx_ref,
        email: data.data.email,
        raw: data.data
      };
    } catch (err: any) {
      logger.error({ msg: 'Chapa verification error', error: err.message });
      throw new AppError(502, 'Failed to verify transaction with Chapa');
    }
  }

  static verifyWebhookSignature(payload: string | Buffer, signature: string, secret?: string): boolean {
    const webhookSecret = secret || process.env.CHAPA_WEBHOOK_SECRET || env.CHAPA_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn({ msg: 'CHAPA_WEBHOOK_SECRET not set; rejecting webhook signature verification' });
      return false;
    }

    const expected = createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    return expected === signature;
  }
}
