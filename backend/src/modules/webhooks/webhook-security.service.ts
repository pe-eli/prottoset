import crypto from 'crypto';

const MAX_WEBHOOK_AGE_MS = 5 * 60 * 1000;

export interface SignatureValidationResult {
  valid: boolean;
  reason?: string;
  timestamp?: number;
  nonce?: string;
}

function safeEqualHex(expectedHex: string, receivedHex: string): boolean {
  try {
    const expected = Buffer.from(expectedHex, 'hex');
    const received = Buffer.from(receivedHex, 'hex');
    if (expected.length === 0 || received.length === 0) return false;
    if (expected.length !== received.length) return false;
    return crypto.timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

function isFreshTimestampMs(timestampMs: number): boolean {
  const diff = Math.abs(Date.now() - timestampMs);
  return diff <= MAX_WEBHOOK_AGE_MS;
}

function parseMercadoPagoSignature(signatureHeader: string): { ts: string; v1: string } | null {
  const parts = signatureHeader.split(',').map((entry) => entry.trim());
  const ts = parts.find((entry) => entry.startsWith('ts='))?.slice(3);
  const v1 = parts.find((entry) => entry.startsWith('v1='))?.slice(3);
  if (!ts || !v1) return null;
  return { ts, v1 };
}

function normalizeRawBody(rawBody: Buffer | string): string {
  return Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
}

export const webhookSecurityService = {
  validateMercadoPagoSignature(params: {
    rawBody: Buffer | string;
    signatureHeader?: string;
    secret?: string;
  }): SignatureValidationResult {
    const secret = params.secret?.trim();
    if (!secret) {
      return { valid: true };
    }

    if (!params.signatureHeader) {
      return { valid: false, reason: 'missing_signature' };
    }

    const parsed = parseMercadoPagoSignature(params.signatureHeader);
    if (!parsed) {
      return { valid: false, reason: 'invalid_signature_format' };
    }

    const timestampSeconds = Number(parsed.ts);
    if (!Number.isFinite(timestampSeconds)) {
      return { valid: false, reason: 'invalid_timestamp' };
    }

    const timestampMs = timestampSeconds * 1000;
    if (!isFreshTimestampMs(timestampMs)) {
      return { valid: false, reason: 'expired_timestamp', timestamp: timestampMs };
    }

    const raw = normalizeRawBody(params.rawBody);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${parsed.ts}.${raw}`)
      .digest('hex');

    const valid = safeEqualHex(expected, parsed.v1);
    return valid
      ? { valid: true, timestamp: timestampMs }
      : { valid: false, reason: 'invalid_signature', timestamp: timestampMs };
  },

  validateEvolutionSignature(params: {
    rawBody: Buffer | string;
    signatureHeader?: string;
    timestampHeader?: string;
    nonceHeader?: string;
    secret?: string;
  }): SignatureValidationResult {
    const secret = params.secret?.trim();
    if (!secret) {
      return { valid: false, reason: 'missing_webhook_secret' };
    }

    const signature = params.signatureHeader?.trim();
    const timestampRaw = params.timestampHeader?.trim();
    const nonce = params.nonceHeader?.trim();

    if (!signature || !timestampRaw || !nonce) {
      return { valid: false, reason: 'missing_required_headers' };
    }

    const timestampMs = Number(timestampRaw);
    if (!Number.isFinite(timestampMs)) {
      return { valid: false, reason: 'invalid_timestamp' };
    }

    if (!isFreshTimestampMs(timestampMs)) {
      return { valid: false, reason: 'expired_timestamp', timestamp: timestampMs, nonce };
    }

    const raw = normalizeRawBody(params.rawBody);
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestampRaw}.${nonce}.${raw}`)
      .digest('hex');

    const valid = safeEqualHex(expected, signature);
    return valid
      ? { valid: true, timestamp: timestampMs, nonce }
      : { valid: false, reason: 'invalid_signature', timestamp: timestampMs, nonce };
  },
};
