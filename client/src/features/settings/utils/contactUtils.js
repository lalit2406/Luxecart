/**
 * Contact and Social Link Formatting & Validation Utilities
 */

/**
 * Validates that a URL is a secure/standard HTTP/HTTPS URL
 * Prevents javascript:, data:, or malformed protocols from being rendered
 * @param {string} url
 * @returns {boolean}
 */
export const isValidHttpUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * Validates whether an email string is structurally valid and non-empty
 * @param {string} email
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

/**
 * Validates whether a phone number has sufficient digits and valid characters
 * @param {string} phone
 * @returns {boolean}
 */
export const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  if (trimmed.length < 5) return false;
  return /^[+0-9\s\-().]+$/.test(trimmed);
};

/**
 * Formats an address object into a single readable string, returning null if empty
 * @param {object} addr
 * @returns {string|null}
 */
export const formatAddress = (addr) => {
  if (!addr || typeof addr !== 'object') return null;
  const parts = [addr.street, addr.city, addr.state, addr.postalCode, addr.country]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
};
