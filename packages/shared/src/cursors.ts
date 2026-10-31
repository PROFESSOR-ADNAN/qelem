import { createHmac, timingSafeEqual } from 'node:crypto';
import { KeysetCursorPayload } from './types.js';

const CURSOR_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class CursorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CursorError';
  }
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function base64UrlDecode(str: string): Buffer {
  return Buffer.from(str, 'base64url');
}

function computeSignature(payloadStr: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(payloadStr).digest();
}

/**
 * Encodes a keyset cursor payload into a signed opaque base64url string.
 */
export function encodeCursor(payload: KeysetCursorPayload, secret: string): string {
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(Buffer.from(payloadStr, 'utf8'));
  const sig = computeSignature(payloadB64, secret);
  const sigB64 = base64UrlEncode(sig);
  return `${payloadB64}.${sigB64}`;
}

/**
 * Decodes and verifies a signed keyset cursor.
 * Accepts optional oldSecret to support key rotation with overlap periods.
 */
export function decodeCursor(
  cursorStr: string,
  secret: string,
  oldSecret?: string
): KeysetCursorPayload {
  if (!cursorStr || typeof cursorStr !== 'string') {
    throw new CursorError('Cursor must be a non-empty string');
  }

  const parts = cursorStr.split('.');
  if (parts.length !== 2) {
    throw new CursorError('Malformed cursor structure');
  }

  const [payloadB64, sigB64] = parts;
  const providedSig = base64UrlDecode(sigB64);

  const expectedSigCurrent = computeSignature(payloadB64, secret);
  let isValid = false;

  if (providedSig.length === expectedSigCurrent.length && timingSafeEqual(providedSig, expectedSigCurrent)) {
    isValid = true;
  } else if (oldSecret) {
    const expectedSigOld = computeSignature(payloadB64, oldSecret);
    if (providedSig.length === expectedSigOld.length && timingSafeEqual(providedSig, expectedSigOld)) {
      isValid = true;
    }
  }

  if (!isValid) {
    throw new CursorError('Cursor signature verification failed or cursor was tampered with');
  }

  let parsed: unknown;
  try {
    const jsonStr = base64UrlDecode(payloadB64).toString('utf8');
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new CursorError('Failed to parse cursor payload');
  }

  const payload = parsed as KeysetCursorPayload;

  if (payload.v !== 1) {
    throw new CursorError(`Unsupported cursor version: ${payload.v}`);
  }

  if (typeof payload.ts !== 'number' || typeof payload.score !== 'number' || !payload.id || !payload.kind) {
    throw new CursorError('Incomplete cursor properties');
  }

  // Check cursor expiration
  if (Date.now() - payload.ts > CURSOR_TTL_MS) {
    throw new CursorError('Cursor has expired');
  }

  return payload;
}
