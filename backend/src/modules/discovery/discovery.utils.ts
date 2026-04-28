export function randomInt(min: number, max: number): number {
  const normalizedMin = Math.ceil(min);
  const normalizedMax = Math.floor(max);
  return Math.floor(Math.random() * (normalizedMax - normalizedMin + 1)) + normalizedMin;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function randomDelay(minMs: number, maxMs: number): Promise<void> {
  await sleep(randomInt(minMs, maxMs));
}

export function normalizeUrl(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';

  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`);
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return value;
  }
}

export function isRetryableHttpStatus(status: number | undefined): boolean {
  if (!status) return false;
  return status === 429 || status >= 500;
}
