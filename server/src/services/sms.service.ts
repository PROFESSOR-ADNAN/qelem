import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function normalizeEthiopianPhone(raw: string): string {
  let cleaned = raw.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('09') || cleaned.startsWith('07')) {
    cleaned = '+251' + cleaned.substring(1);
  } else if (cleaned.startsWith('9') || cleaned.startsWith('7')) {
    cleaned = '+251' + cleaned;
  } else if (cleaned.startsWith('251')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

export function isValidEthiopianPhone(phone: string): boolean {
  const normalized = normalizeEthiopianPhone(phone);
  // Matches Ethiopian Ethio Telecom (+2519...) and Safaricom (+2517...)
  return /^\+251[97]\d{8}$/.test(normalized);
}

export class SmsService {
  static async sendOtp(phone: string, otpCode: string): Promise<boolean> {
    const normalizedPhone = normalizeEthiopianPhone(phone);

    if (!isValidEthiopianPhone(normalizedPhone)) {
      throw new Error('Invalid Ethiopian phone number. Please enter a valid number (e.g., 0912345678 or 0712345678).');
    }

    if (!env.SMS_API_KEY) {
      logger.warn({
        msg: 'SMS_API_KEY not configured. Mocking SMS dispatch in dev mode.',
        phone: normalizedPhone,
        otpCode
      });
      return true;
    }

    const apiUrl = env.SMS_API_URL || 'https://api.afromessage.com/api/send';
    const message = `Your Qelem verification code is: ${otpCode}. Valid for 10 minutes.`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.SMS_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: normalizedPhone,
          message
        })
      });

      const data: any = await response.json();
      if (!response.ok || (data.acknowledge && data.acknowledge !== 'success')) {
        logger.error({ msg: 'AfroMessage SMS send error', status: response.status, data });
        throw new Error(data.response?.errors?.[0] || data.message || 'Failed to dispatch SMS verification code.');
      }

      logger.info({ msg: 'AfroMessage SMS OTP sent successfully', phone: normalizedPhone });
      return true;
    } catch (err: any) {
      logger.error({ msg: 'AfroMessage network or delivery failure', error: err.message, phone: normalizedPhone });
      throw new Error(err.message || 'SMS service is temporarily unreachable.');
    }
  }
}
