/**
 * LuxeCart Image Optimization & Cloudinary Delivery Utilities
 */

// Luxury neutral SVG fallback placeholder
export const LUXE_PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750" width="600" height="750">
      <rect width="600" height="750" fill="#F7F3EE"/>
      <rect x="20" y="20" width="560" height="710" fill="none" stroke="#E7DED5" stroke-width="2" rx="16"/>
      <g transform="translate(300, 340)" text-anchor="middle">
        <circle cx="0" cy="-20" r="44" fill="#EAE2D8"/>
        <path d="M-18 -26 L18 -26 L12 -6 L-12 -6 Z M-10 -6 L10 -6 L8 4 L-8 4 Z" fill="#9A6A45"/>
        <circle cx="0" cy="-30" r="4" fill="#9A6A45"/>
        <text y="60" font-family="serif" font-size="20" font-weight="600" fill="#2A211B" letter-spacing="3">LUXECART</text>
        <text y="84" font-family="sans-serif" font-size="11" font-weight="500" fill="#9A6A45" letter-spacing="2">CURATED ATELIER</text>
      </g>
    </svg>`
  );

/**
 * Automatically injects Cloudinary transformations (auto format, auto quality, responsive resize)
 * @param {string} url - Original image URL
 * @param {object} options - Transformation options
 * @param {number} [options.width] - Desired width
 * @param {number} [options.height] - Desired height
 * @param {string} [options.crop='limit'] - Crop mode (limit, fill, scale)
 * @param {string} [options.quality='auto'] - Quality setting (auto, auto:good, auto:best)
 * @returns {string} Optimized URL
 */
export const getOptimizedImageUrl = (url, options = {}) => {
  if (!url || typeof url !== 'string') return LUXE_PLACEHOLDER_IMAGE;

  // If not Cloudinary, return as-is
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url;
  }

  // If already transformed with parameters, return as-is
  if (url.includes('/upload/f_auto') || url.includes('/upload/w_')) {
    return url;
  }

  const { width, height, crop = 'limit', quality = 'auto' } = options;
  const transformations = ['f_auto', `q_${quality}`];

  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  if (width || height) transformations.push(`c_${crop}`);

  const transformString = transformations.join(',');
  return url.replace('/upload/', `/upload/${transformString}/`);
};
