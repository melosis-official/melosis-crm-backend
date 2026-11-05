import { env } from './env';

export function isAllowedOrigin(origin: string): boolean {
  if (origin === env.FRONTEND_ORIGIN) return true;
  if (env.NODE_ENV !== 'development') return false;

  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:') return false;
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1' || host.endsWith('.local')) return true;

    const octets = host.split('.').map(Number);
    if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
    const [first, second] = octets as [number, number, number, number];
    return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
  } catch {
    return false;
  }
}
