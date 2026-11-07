/**
 * Safe navigation and URL redirect utilities for LuxeCart Storefront
 */

/**
 * Validates and resolves a safe internal application redirect path.
 * Supports:
 * - String path, e.g. "/products/aurelia-structured-shoulder-bag"
 * - Location object with pathname, search, and hash, e.g. { pathname: "/checkout", search: "?step=review" }
 *
 * Security:
 * - Rejects external URLs (http://, https://, protocol-relative //, /\\)
 * - Rejects non-HTTP protocols (javascript:, data:)
 * - Rejects auth routes (/login, /register) to prevent redirect loops
 * - Always falls back to "/" or the specified fallback
 *
 * @param {string | object | null | undefined} rawTarget - Raw target from location.state.from or query
 * @param {string} [fallback="/"] - Safe internal fallback path
 * @returns {string} Safe relative internal path
 */
export function getSafeRedirectPath(rawTarget, fallback = '/') {
  if (!rawTarget) return fallback;

  let path = '';
  if (typeof rawTarget === 'string') {
    path = rawTarget.trim();
  } else if (typeof rawTarget === 'object' && rawTarget !== null) {
    if (typeof rawTarget.pathname === 'string') {
      const pathname = rawTarget.pathname || '';
      const search = typeof rawTarget.search === 'string' ? rawTarget.search : '';
      const hash = typeof rawTarget.hash === 'string' ? rawTarget.hash : '';
      path = `${pathname}${search}${hash}`.trim();
    }
  }

  if (!path) return fallback;

  // Security checks:
  // Must start with single '/' and not with '//' or '/\'
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
    return fallback;
  }

  try {
    const dummyBase = 'http://localhost';
    const parsed = new URL(path, dummyBase);

    // Host/origin must remain strictly on the dummy base
    if (parsed.origin !== dummyBase) {
      return fallback;
    }

    // Protocol must be http/https as resolved against dummyBase
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fallback;
    }

    // Prevent redirect loops back to auth pages
    const normalizedPath = parsed.pathname.toLowerCase();
    if (normalizedPath === '/login' || normalizedPath === '/register') {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
