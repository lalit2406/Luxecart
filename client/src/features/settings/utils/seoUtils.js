/**
 * LuxeCart SEO & Metadata Utility Functions
 * Pure helpers for title formatting, canonical URL sanitization, social metadata, and favicon handling.
 */

/**
 * Validates whether a given string is an absolute HTTP or HTTPS URL.
 * @param {string} string
 * @returns {boolean}
 */
export function isValidHttpUrl(string) {
  if (!string || typeof string !== 'string') return false;
  try {
    const url = new URL(string.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Pure helper to compute full document title with dynamic storeName.
 * Preserves custom titles, avoids duplicate store suffixes, and provides fallback.
 * @param {string|null} title
 * @param {string|null} [storeName='LuxeCart']
 * @param {string|null} [defaultTitle=null]
 * @returns {string}
 */
export function formatTitle(title, storeName = 'LuxeCart', defaultTitle = null) {
  const effectiveStoreName =
    storeName && typeof storeName === 'string' && storeName.trim() ? storeName.trim() : 'LuxeCart';
  const fallback = defaultTitle || `${effectiveStoreName} — Curated Luxury Fashion & Lifestyle`;
  if (!title || typeof title !== 'string' || !title.trim()) {
    return fallback;
  }

  const trimmed = title.trim();
  const lowerTitle = trimmed.toLowerCase();
  const lowerStore = effectiveStoreName.toLowerCase();

  // If title already contains store name (e.g. "Collection | LuxeCart" or "LuxeCart — Summer"), preserve
  if (lowerStore && lowerTitle.includes(lowerStore)) {
    return trimmed;
  }

  // Strip trailing delimiters before appending store suffix
  const cleanTitle = trimmed.replace(/[\s|—–-]+$/, '');
  return `${cleanTitle} | ${effectiveStoreName}`;
}

/**
 * Pure helper to sanitize and compute canonical URLs.
 * Strips marketing tracking parameters (utm_*, gclid, etc.) and preserves legitimate query parameters.
 * @param {string|null} canonical
 * @param {string} [siteUrl='http://localhost']
 * @returns {string}
 */
export function buildCanonicalUrl(canonical, siteUrl = 'http://localhost') {
  let urlObj;
  try {
    if (canonical && typeof canonical === 'string' && canonical.trim()) {
      if (canonical.startsWith('http://') || canonical.startsWith('https://')) {
        urlObj = new URL(canonical);
      } else {
        const pathWithSlash = canonical.startsWith('/') ? canonical : `/${canonical}`;
        urlObj = new URL(pathWithSlash, siteUrl);
      }
    } else if (typeof window !== 'undefined' && window.location) {
      urlObj = new URL(window.location.href);
    } else {
      return '';
    }
  } catch {
    return canonical || '';
  }

  // Tracking query parameters to strip from canonical links
  const trackingParams = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'gclid',
    'fbclid',
    'msclkid',
    '_ga',
    '_gl',
    'mc_cid',
    'mc_eid',
  ];

  trackingParams.forEach((param) => {
    urlObj.searchParams.delete(param);
  });

  return urlObj.toString();
}

/**
 * Pure helper to resolve social card image.
 * Page-specific image takes precedence. Falls back to store logoUrlLight if valid, else fallback editorial image.
 * @param {string|null} pageImage
 * @param {string|null} logoUrl
 * @param {string} [fallbackImage]
 * @returns {string}
 */
export function resolveMetaImage(
  pageImage,
  logoUrl,
  fallbackImage = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200'
) {
  if (pageImage && typeof pageImage === 'string' && pageImage.trim()) {
    return pageImage.trim();
  }
  if (isValidHttpUrl(logoUrl)) {
    return logoUrl.trim();
  }
  return fallbackImage;
}

/**
 * Pure helper to resolve keywords string.
 * @param {string|string[]|null} keywords
 * @param {string|string[]|null} [defaultKeywords=null]
 * @returns {string}
 */
export function resolveMetaKeywords(keywords, defaultKeywords = null) {
  const source = keywords || defaultKeywords;
  if (!source) return '';
  if (Array.isArray(source)) {
    return source
      .filter(Boolean)
      .map((k) => String(k).trim())
      .filter(Boolean)
      .join(', ');
  }
  if (typeof source === 'string') {
    return source.trim();
  }
  return '';
}

/**
 * Dynamically updates document favicon link elements safely.
 * Preserves local fallback (/favicon.svg) on load failure or missing URL.
 * @param {string|null} faviconUrl
 * @param {string} [fallbackFavicon='/favicon.svg']
 */
export function updateFavicon(faviconUrl, fallbackFavicon = '/favicon.svg') {
  if (typeof document === 'undefined') return;

  const setFaviconHref = (href) => {
    const iconLinks = document.querySelectorAll("link[rel*='icon']");
    if (iconLinks.length > 0) {
      iconLinks.forEach((link) => {
        link.setAttribute('href', href);
      });
    } else {
      const newLink = document.createElement('link');
      newLink.setAttribute('rel', 'icon');
      newLink.setAttribute('href', href);
      document.head.appendChild(newLink);
    }
  };

  if (!isValidHttpUrl(faviconUrl)) {
    setFaviconHref(fallbackFavicon);
    return;
  }

  const trimmed = faviconUrl.trim();
  if (typeof Image !== 'undefined') {
    const probe = new Image();
    probe.onload = () => {
      setFaviconHref(trimmed);
    };
    probe.onerror = () => {
      setFaviconHref(fallbackFavicon);
    };
    probe.src = trimmed;
  } else {
    setFaviconHref(trimmed);
  }
}
