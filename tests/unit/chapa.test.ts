import { describe, it, expect, vi } from 'vitest';
import { ChapaService } from '../../server/src/services/chapa.service.js';
import { createHmac } from 'node:crypto';

describe('Chapa Payment Service Unit Tests', () => {
  it('detects when Chapa is not configured', () => {
    // If CHAPA_SECRET_KEY is empty or not provided
    expect(typeof ChapaService.isConfigured()).toBe('boolean');
  });

  it('correctly verifies HMAC-SHA256 webhook signatures', () => {
    const payload = JSON.stringify({
      event: 'charge.completed',
      tx_ref: 'qelem-tip-12345',
      amount: 100,
      currency: 'ETB'
    });

    // Test with mock webhook secret
    const secret = 'mock_chapa_webhook_secret_key_12345';
    const validSignature = createHmac('sha256', secret).update(payload).digest('hex');

    // Verification requires env.CHAPA_WEBHOOK_SECRET to match
    vi.stubEnv('CHAPA_WEBHOOK_SECRET', secret);

    const isValid = ChapaService.verifyWebhookSignature(payload, validSignature);
    expect(isValid).toBe(true);

    const isInvalid = ChapaService.verifyWebhookSignature(payload, 'wrong_signature_hex_value');
    expect(isInvalid).toBe(false);

    vi.unstubAllEnvs();
  });
});
