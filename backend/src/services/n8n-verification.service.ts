import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

interface StartVerificationPayload {
  userId: string;
  email: string;
  displayName: string;
  requestId: string;
}

interface StartVerificationResponse {
  verificationId: string;
  expiresAt: string;
}

interface ValidateCodePayload {
  verificationId: string;
  email: string;
  code: string;
}

interface ValidateCodeResponse {
  valid: boolean;
  reason?: 'invalid_code' | 'expired' | 'too_many_attempts';
  consumedAt?: string;
}

const responseNonces = new Map<string, number>();

function env(name: string): string {
  return (process.env[name] || '').trim();
}

function isEnabled(): boolean {
  return !!(env('N8N_VERIFICATION_START_URL') && env('N8N_VERIFICATION_VALIDATE_URL') && env('N8N_SHARED_SECRET'));
}

function timeoutMs(): number {
  const parsed = Number(env('N8N_TIMEOUT_MS'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10000;
}

function acceptedSkewMs(): number {
  const parsed = Number(env('N8N_SIGNATURE_MAX_SKEW_MS'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 60 * 1000;
}

function mustValidateSignedResponse(): boolean {
  const explicit = env('N8N_REQUIRE_SIGNED_RESPONSE');
  if (explicit) return explicit === 'true';
  return process.env.NODE_ENV === 'production';
}

function signPayload(secret: string, timestamp: string, nonce: string, body: string): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${nonce}.${body}`)
    .digest('hex');
}

function safeHexEqual(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, 'hex');
    const right = Buffer.from(b, 'hex');
    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function rememberNonce(nonce: string): boolean {
  const now = Date.now();
  for (const [key, expiry] of responseNonces.entries()) {
    if (expiry <= now) responseNonces.delete(key);
  }

  if (responseNonces.has(nonce)) return false;

  responseNonces.set(nonce, now + acceptedSkewMs());
  return true;
}

function assertSignedResponse(rawBody: string, headers: Headers): void {
  if (!mustValidateSignedResponse()) return;

  const secret = env('N8N_SHARED_SECRET');
  const signature = headers.get('x-signature') || '';
  const timestamp = headers.get('x-timestamp') || '';
  const nonce = headers.get('x-nonce') || '';

  if (!signature || !timestamp || !nonce) {
    throw new Error('Resposta do n8n sem headers de assinatura');
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > acceptedSkewMs()) {
    throw new Error('Timestamp de resposta do n8n inválido/expirado');
  }

  if (!rememberNonce(nonce)) {
    throw new Error('Nonce repetido na resposta do n8n');
  }

  const expected = signPayload(secret, timestamp, nonce, rawBody);
  if (!safeHexEqual(expected, signature)) {
    throw new Error('Assinatura inválida na resposta do n8n');
  }
}

async function signedPost<TRequest extends object, TResponse>(url: string, payload: TRequest): Promise<TResponse> {
  const secret = env('N8N_SHARED_SECRET');
  if (!secret) {
    throw new Error('N8N_SHARED_SECRET não configurado');
  }

  const body = JSON.stringify(payload);
  const timestamp = Date.now().toString();
  const nonce = randomUUID();
  const signature = signPayload(secret, timestamp, nonce, body);

  console.log(`[N8N] POST ${url}`);
  console.log(`[N8N] Headers assinados enviados (timestamp=${timestamp}, nonce=${nonce})`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-signature': signature,
      'x-timestamp': timestamp,
      'x-nonce': nonce,
    },
    body,
    signal: AbortSignal.timeout(timeoutMs()),
  });

  const raw = await response.text();
  console.log(`[N8N] Resposta status=${response.status} body=${raw}`);

  if (!response.ok) {
    throw new Error(`n8n retornou status ${response.status}`);
  }

  assertSignedResponse(raw, response.headers);

  return JSON.parse(raw) as TResponse;
}

export const n8nVerificationService = {
  enabled(): boolean {
    return isEnabled();
  },

  async startVerification(payload: StartVerificationPayload): Promise<StartVerificationResponse> {
    const url = env('N8N_VERIFICATION_START_URL');
    if (!url) throw new Error('N8N_VERIFICATION_START_URL não configurado');
    return signedPost<StartVerificationPayload, StartVerificationResponse>(url, payload);
  },

  async validateCode(payload: ValidateCodePayload): Promise<ValidateCodeResponse> {
    const url = env('N8N_VERIFICATION_VALIDATE_URL');
    if (!url) throw new Error('N8N_VERIFICATION_VALIDATE_URL não configurado');
    return signedPost<ValidateCodePayload, ValidateCodeResponse>(url, payload);
  },
};