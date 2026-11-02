/**
 * Pinterest URL validator – restricts allowed hostnames exclusively to Pinterest domains.
 */
const ALLOWED_HOSTS = new Set([
  'pinterest.com',
  'www.pinterest.com',
  'in.pinterest.com',
  'pin.it',
  'pinimg.com',
  'v1.pinimg.com',
  'v.pinimg.com',
  'i.pinimg.com',
  'pinterest.co.uk',
  'pinterest.ca',
  'pinterest.de',
  'pinterest.fr',
]);

export function validateVideoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  if (url.length > 2000) return false;

  try {
    const parsed = new URL(url);

    // Only HTTPS (or HTTP for short links)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

    // Must be a known Pinterest host
    const host = parsed.hostname.toLowerCase();

    if (ALLOWED_HOSTS.has(host) || host.endsWith('.pinterest.com') || host.endsWith('.pinimg.com')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
