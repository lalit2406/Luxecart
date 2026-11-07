/**
 * Regex Utility Functions
 *
 * Provides safe escaping and length-bounding for user-controlled strings
 * before embedding in MongoDB regular expressions or JavaScript RegExp constructors.
 */

/**
 * Safely escape regular expression metacharacters and bound input length.
 *
 * Requirements:
 * - Accepts only string values (returns empty string for non-string types)
 * - Trims leading and trailing whitespace
 * - Bounds input length to maxLength (default 100 characters)
 * - Escapes all JavaScript RegExp metacharacters: [.*+?^${}()|[\]\\]
 * - Does not compile the RegExp itself
 *
 * @param {unknown} input - User-controlled input string
 * @param {number} [maxLength=100] - Maximum allowed string length before escaping
 * @returns {string} Sanitized, bounded, and escaped literal string
 */
export const escapeRegex = (input, maxLength = 100) => {
  if (typeof input !== 'string') {
    return '';
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  const limit = typeof maxLength === 'number' && maxLength > 0 ? maxLength : 100;
  const bounded = trimmed.slice(0, limit);

  return bounded.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
