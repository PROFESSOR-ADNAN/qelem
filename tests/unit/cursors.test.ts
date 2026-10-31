import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor, CursorError } from '../../packages/shared/src/cursors.js';

describe('Signed Keyset Cursors', () => {
  const secret = 'test-secret-key-that-is-at-least-32-chars-long';
  const oldSecret = 'old-secret-key-that-was-rotated-out-32-chars';

  it('correctly encodes and decodes a valid cursor', () => {
    const payload = {
      v: 1,
      kind: 'home' as const,
      score: 1730419200000,
      id: 'post_1234567890abcdef',
      ts: Date.now()
    };

    const encoded = encodeCursor(payload, secret);
    expect(typeof encoded).toBe('string');
    expect(encoded.split('.')).toHaveLength(2);

    const decoded = decodeCursor(encoded, secret);
    expect(decoded.v).toBe(1);
    expect(decoded.kind).toBe('home');
    expect(decoded.score).toBe(payload.score);
    expect(decoded.id).toBe(payload.id);
  });

  it('rejects tampered payload', () => {
    const payload = {
      v: 1,
      kind: 'home' as const,
      score: 1730419200000,
      id: 'post_1234567890abcdef',
      ts: Date.now()
    };

    const encoded = encodeCursor(payload, secret);
    const [payloadB64, sigB64] = encoded.split('.');

    // Tamper with payload
    const tamperedPayloadB64 = Buffer.from(JSON.stringify({ ...payload, score: 9999999999999 })).toString('base64url');
    const tamperedCursor = `${tamperedPayloadB64}.${sigB64}`;

    expect(() => decodeCursor(tamperedCursor, secret)).toThrowError(CursorError);
  });

  it('rejects tampered signature', () => {
    const payload = {
      v: 1,
      kind: 'home' as const,
      score: 1730419200000,
      id: 'post_1234567890abcdef',
      ts: Date.now()
    };

    const encoded = encodeCursor(payload, secret);
    const [payloadB64] = encoded.split('.');
    const fakeSigB64 = Buffer.from('bad_signature_bytes_12345678901234567890123456789012').toString('base64url');
    const tamperedCursor = `${payloadB64}.${fakeSigB64}`;

    expect(() => decodeCursor(tamperedCursor, secret)).toThrowError(CursorError);
  });

  it('supports key rotation using oldSecret', () => {
    const payload = {
      v: 1,
      kind: 'explore' as const,
      score: 42.5,
      id: 'post_999',
      ts: Date.now()
    };

    // Encoded with the old key
    const encodedWithOld = encodeCursor(payload, oldSecret);

    // Decoded with new key + old key fallback
    const decoded = decodeCursor(encodedWithOld, secret, oldSecret);
    expect(decoded.score).toBe(42.5);
    expect(decoded.id).toBe('post_999');
  });

  it('rejects expired cursor', () => {
    const payload = {
      v: 1,
      kind: 'home' as const,
      score: 100,
      id: 'post_old',
      ts: Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago (> 24h TTL)
    };

    const encoded = encodeCursor(payload, secret);
    expect(() => decodeCursor(encoded, secret)).toThrowError('Cursor has expired');
  });
});
