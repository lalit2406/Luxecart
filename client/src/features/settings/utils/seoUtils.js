/**
 * LuxeCart SEO & Metadata Utility Functions
 * Pure helpers for canonical site origin resolution, title formatting,
 * canonical URL sanitization, social metadata, JSON-LD generation, and favicon handling.
 */

export const DEFAULT_SITE_ORIGIN = 'https://luxecart-rouge.vercel.app';

/**
 * Checks whether a hostname belongs to a backend API host or local dev environment
 * that must never be published as a canonical frontend URL.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isApiOrLocalHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') return true;
  const h = hostname.trim().toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h.endsWith('.onrender.com')
  );
}

/**
 * Resolves the centralized canonical frontend site origin.
 * Never exposes the Render backend hostname as a canonical website URL.
 *
 * @param {string|null} [overrideOrigin=null]
 * @returns {string}
 */
export function getCanonicalSiteOrigin(overrideOrigin = null) {
  const envOrigin =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL
      ? import.meta.env.VITE_SITE_URL
      : null;

  const browserOrigin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : null;

  const candidates = [overrideOrigin, envOrigin, browserOrigin, DEFAULT_SITE_ORIGIN];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!isValidHttpUrl(trimmed)) continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname.toLowerCase().endsWith('.onrender.com')) continue;
      if (
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
        candidate !== overrideOrigin
      ) {
        continue;
      }
      return parsed.origin;
    } catch {
      continue;
    }
  }

  return DEFAULT_SITE_ORIGIN;
}

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
export function buildCanonicalUrl(canonical, siteUrl = DEFAULT_SITE_ORIGIN) {
  if (canonical === false) return '';

  const effectiveSiteUrl =
    isValidHttpUrl(siteUrl) && !isApiOrLocalHostname(new URL(siteUrl).hostname)
      ? new URL(siteUrl).origin
      : isValidHttpUrl(siteUrl)
        ? new URL(siteUrl).origin
        : DEFAULT_SITE_ORIGIN;

  let urlObj;
  try {
    if (canonical && typeof canonical === 'string' && canonical.trim()) {
      if (canonical.startsWith('http://') || canonical.startsWith('https://')) {
        urlObj = new URL(canonical);
        if (isApiOrLocalHostname(urlObj.hostname) && effectiveSiteUrl !== urlObj.origin) {
          urlObj = new URL(`${urlObj.pathname}${urlObj.search}`, effectiveSiteUrl);
        }
      } else {
        const pathWithSlash = canonical.startsWith('/') ? canonical : `/${canonical}`;
        urlObj = new URL(pathWithSlash, effectiveSiteUrl);
      }
    } else if (typeof window !== 'undefined' && window.location) {
      const current = new URL(window.location.href);
      urlObj = new URL(`${current.pathname}${current.search}`, effectiveSiteUrl);
    } else {
      return '';
    }
  } catch {
    return canonical || '';
  }

  // Never expose password-reset tokens in canonical URLs
  if (urlObj.pathname.startsWith('/reset-password/')) {
    urlObj.pathname = '/reset-password';
  }
  urlObj.searchParams.delete('token');

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
 * Page-specific image takes precedence. Falls back to store logoUrlLight if valid, else hosted LuxeCart banner.
 * @param {string|null} pageImage
 * @param {string|null} logoUrl
 * @param {string} [fallbackImage]
 * @returns {string}
 */
export function resolveMetaImage(
  pageImage,
  logoUrl,
  fallbackImage = `${DEFAULT_SITE_ORIGIN}/images/hero-campaign.jpg`
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

/**
 * Formats a product/variant selling price stored in whole Indian Rupees (INR)
 * for Schema.org Offer structured data (e.g., 899 -> "899.00").
 * Returns null if the price is missing, non-finite, <= 0, boolean, or non-numeric string.
 * Product catalog prices are already stored in Rupees (never paise).
 *
 * @param {number|string|null|undefined} priceInRupees
 * @returns {string|null}
 */
export function formatOfferPriceInr(priceInRupees) {
  if (priceInRupees === null || priceInRupees === undefined || typeof priceInRupees === 'boolean') {
    return null;
  }
  if (typeof priceInRupees === 'object') {
    return null;
  }
  if (typeof priceInRupees === 'string') {
    const trimmed = priceInRupees.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed.toFixed(2);
  }
  if (typeof priceInRupees === 'number') {
    if (!Number.isFinite(priceInRupees) || priceInRupees <= 0) return null;
    return priceInRupees.toFixed(2);
  }
  return null;
}

/**
 * Recursively flattens a nested category tree into a flat array of active category nodes.
 * Handles arbitrary depth without mutating the source tree.
 *
 * @param {Array<object>} categoryTree
 * @param {Array<object>} [acc=[]]
 * @returns {Array<object>}
 */
export function flattenCategoryTree(categoryTree = [], acc = []) {
  if (!Array.isArray(categoryTree)) return acc;
  for (const node of categoryTree) {
    if (!node || typeof node !== 'object') continue;
    if (node.isActive !== false) {
      acc.push(node);
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      flattenCategoryTree(node.children, acc);
    }
  }
  return acc;
}

/**
 * Finds an active category node matching an ID or slug across all tree levels.
 * Returns null when missing, empty, or inactive.
 *
 * @param {Array<object>} categoryTree
 * @param {string|null|undefined} categoryIdentifier
 * @returns {object|null}
 */
export function findActiveCategoryInTree(categoryTree = [], categoryIdentifier = null) {
  const path = findCategoryPathInTree(categoryTree, categoryIdentifier);
  return path.length > 0 ? path[path.length - 1] : null;
}

/**
 * Recursively locates an active category by ID or slug and returns its full
 * ancestor-to-leaf path `[root, ..., target]`. Returns `[]` if missing or inactive.
 *
 * @param {Array<object>} categoryTree
 * @param {string|null|undefined} categoryIdentifier
 * @returns {Array<object>}
 */
export function findCategoryPathInTree(categoryTree = [], categoryIdentifier = null) {
  if (!Array.isArray(categoryTree) || !categoryIdentifier || typeof categoryIdentifier !== 'string') {
    return [];
  }
  const trimmed = categoryIdentifier.trim();
  if (!trimmed) return [];
  const lowerSlug = trimmed.toLowerCase();

  for (const node of categoryTree) {
    if (!node || typeof node !== 'object' || node.isActive === false) continue;

    const catId = node.id || node._id;
    const idMatch = catId !== undefined && catId !== null && String(catId) === trimmed;
    const slugMatch = typeof node.slug === 'string' && node.slug.trim().toLowerCase() === lowerSlug;

    if (idMatch || slugMatch) {
      return [node];
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      const childPath = findCategoryPathInTree(node.children, categoryIdentifier);
      if (childPath.length > 0) {
        return [node, ...childPath];
      }
    }
  }

  return [];
}

/**
 * Builds Organization & WebSite Schema.org JSON-LD for the homepage
 * using the centralized canonical frontend origin and store settings.
 * Never invents physical addresses, phone numbers, registration IDs, or commercial claims.
 *
 * @param {{ storeName?: string, tagline?: string, logoUrl?: string|null, siteOrigin?: string }} options
 * @returns {Array<object>}
 */
export function buildHomepageStructuredData({
  storeName = 'LuxeCart',
  tagline = '',
  logoUrl = null,
  siteOrigin = null,
} = {}) {
  const originUrl = getCanonicalSiteOrigin(siteOrigin);
  const safeStoreName =
    storeName && typeof storeName === 'string' && storeName.trim() ? storeName.trim() : 'LuxeCart';
  const safeTagline = tagline && typeof tagline === 'string' && tagline.trim() ? tagline.trim() : '';
  const resolvedLogo = isValidHttpUrl(logoUrl) ? logoUrl.trim() : `${originUrl}/luxecart-logo.png`;

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: safeStoreName,
      url: originUrl,
      logo: resolvedLogo,
      ...(safeTagline ? { description: safeTagline } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: safeStoreName,
      url: originUrl,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${originUrl}/shop?search={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ];
}

/**
 * Builds synchronized visible breadcrumb items and BreadcrumbList Schema.org JSON-LD
 * for ShopPage, dynamically including any valid active category hierarchy.
 *
 * @param {Array<object>} [categoryTree=[]]
 * @param {string|null} [categoryIdentifier=null]
 * @param {string|null} [siteOrigin=null]
 * @returns {{ items: Array<{ label: string, to: string, url: string }>, jsonLd: object }}
 */
export function buildShopBreadcrumbs(categoryTree = [], categoryIdentifier = null, siteOrigin = null) {
  const originUrl = getCanonicalSiteOrigin(siteOrigin);
  const items = [
    { label: 'Home', to: '/', url: `${originUrl}/` },
    { label: 'Shop', to: '/shop', url: `${originUrl}/shop` },
  ];

  const categoryPath = findCategoryPathInTree(categoryTree, categoryIdentifier);
  for (const cat of categoryPath) {
    const slugOrId = cat.slug || cat._id || cat.id;
    if (!cat.name || !slugOrId) continue;
    const to = `/shop?category=${encodeURIComponent(slugOrId)}`;
    items.push({
      label: cat.name,
      to,
      url: `${originUrl}${to}`,
    });
  }

  return {
    items,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.label,
        item: item.url,
      })),
    },
  };
}

/**
 * Builds BreadcrumbList Schema.org JSON-LD for the catalog page.
 *
 * @param {string|null} [siteOrigin=null]
 * @param {Array<object>} [categoryTree=[]]
 * @param {string|null} [categoryIdentifier=null]
 * @returns {object}
 */
export function buildShopBreadcrumbStructuredData(
  siteOrigin = null,
  categoryTree = [],
  categoryIdentifier = null
) {
  return buildShopBreadcrumbs(categoryTree, categoryIdentifier, siteOrigin).jsonLd;
}

/**
 * Builds synchronized visible breadcrumb items and BreadcrumbList JSON-LD for ProductDetailPage.
 *
 * @param {object} product
 * @param {string|null} [siteOrigin=null]
 * @returns {{ items: Array<{ label: string, to: string, url: string, isCurrent?: boolean }>, jsonLd: object }}
 */
export function buildProductBreadcrumbs(product, siteOrigin = null) {
  const originUrl = getCanonicalSiteOrigin(siteOrigin);
  const items = [
    { label: 'Home', to: '/', url: `${originUrl}/` },
    { label: 'Shop', to: '/shop', url: `${originUrl}/shop` },
  ];

  const seenCategoryKeys = new Set();
  const pushCategoryCrumb = (cat) => {
    if (!cat || typeof cat !== 'object' || cat.isActive === false) return;
    const slugOrId = cat.slug || cat._id || cat.id;
    if (!cat.name || !slugOrId) return;
    const key = String(slugOrId).toLowerCase();
    if (seenCategoryKeys.has(key)) return;
    seenCategoryKeys.add(key);
    const to = `/shop?category=${encodeURIComponent(slugOrId)}`;
    items.push({
      label: cat.name,
      to,
      url: `${originUrl}${to}`,
    });
  };

  for (const anc of product?.category?.ancestors || []) {
    pushCategoryCrumb(anc);
  }
  pushCategoryCrumb(product?.category);

  if (product?.name && product?.slug) {
    const canonicalProductUrl = buildCanonicalUrl(`/products/${product.slug}`, originUrl);
    items.push({
      label: product.name,
      to: `/products/${encodeURIComponent(product.slug)}`,
      url: canonicalProductUrl,
      isCurrent: true,
    });
  }

  return {
    items,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.label,
        item: item.url,
      })),
    },
  };
}

/**
 * Builds Product & BreadcrumbList Schema.org JSON-LD for ProductDetailPage.
 * - Preserves whole-INR pricing without dividing by 100.
 * - Excludes inactive variants and omits invalid/non-positive offers.
 * - Emits OutOfStock whenever variants are unavailable or stock <= 0.
 * - Never fabricates SKUs, GTINs, MPNs, or fake ratings.
 *
 * @param {object} product
 * @param {object|null} selectedVariant
 * @param {Array<object>} images
 * @param {boolean} isOutOfStock
 * @param {string|null} [siteOrigin=null]
 * @returns {Array<object>}
 */
export function buildProductStructuredData(
  product,
  selectedVariant = null,
  images = [],
  isOutOfStock = false,
  siteOrigin = null
) {
  const originUrl = getCanonicalSiteOrigin(siteOrigin);
  const canonicalProductUrl = buildCanonicalUrl(`/products/${product?.slug || ''}`, originUrl);

  const hasVariantsArray = Array.isArray(product?.variants) && product.variants.length > 0;
  const activeVariants = (product?.variants || []).filter((v) => v && v.isActive !== false);
  const validSelectedVariant =
    selectedVariant && selectedVariant.isActive !== false ? selectedVariant : null;

  // Never use an inactive variant's price or SKU; omit offer if all defined variants are inactive
  const allDefinedVariantsInactive = hasVariantsArray && activeVariants.length === 0;
  const rawPrice = allDefinedVariantsInactive
    ? undefined
    : validSelectedVariant
      ? (validSelectedVariant.price ?? product?.priceSummary?.minPrice)
      : (selectedVariant && selectedVariant.isActive === false
          ? undefined
          : product?.priceSummary?.minPrice);

  const formattedOfferPrice = formatOfferPriceInr(rawPrice);

  const genuineSku =
    (typeof validSelectedVariant?.sku === 'string' && validSelectedVariant.sku.trim()) ||
    (!selectedVariant && activeVariants.find((v) => typeof v.sku === 'string' && v.sku.trim())?.sku.trim()) ||
    null;

  const variantOutOfStock =
    validSelectedVariant?.inventory?.stock !== undefined && validSelectedVariant.inventory.stock <= 0;
  const resolvedOutOfStock =
    Boolean(isOutOfStock) ||
    allDefinedVariantsInactive ||
    variantOutOfStock ||
    product?.priceSummary?.hasStock === false;

  const validImageUrls = (images || []).map((img) => img?.url).filter((u) => isValidHttpUrl(u));
  const safeBrand =
    typeof product?.brand === 'string' && product.brand.trim() ? product.brand.trim() : null;
  const safeDescription =
    typeof product?.description === 'string' && product.description.trim()
      ? product.description.trim()
      : null;

  const hasValidRating =
    typeof product?.ratings?.count === 'number' &&
    product.ratings.count > 0 &&
    typeof product?.ratings?.average === 'number' &&
    product.ratings.average > 0 &&
    product.ratings.average <= 5;

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product?.name,
    ...(safeDescription ? { description: safeDescription } : {}),
    ...(validImageUrls.length > 0 ? { image: validImageUrls } : {}),
    ...(safeBrand
      ? {
          brand: {
            '@type': 'Brand',
            name: safeBrand,
          },
        }
      : {}),
    ...(genuineSku ? { sku: genuineSku } : {}),
    ...(formattedOfferPrice !== null
      ? {
          offers: {
            '@type': 'Offer',
            price: formattedOfferPrice,
            priceCurrency: 'INR',
            availability: resolvedOutOfStock
              ? 'https://schema.org/OutOfStock'
              : 'https://schema.org/InStock',
            url: canonicalProductUrl,
            itemCondition: 'https://schema.org/NewCondition',
          },
        }
      : {}),
    ...(hasValidRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.ratings.average,
            reviewCount: product.ratings.count,
          },
        }
      : {}),
  };

  const { jsonLd: breadcrumbSchema } = buildProductBreadcrumbs(product, originUrl);

  return [productSchema, breadcrumbSchema];
}

/**
 * Computes a meaningful, single-H1 heading and subtitle for ShopPage based on
 * the active category, search query, collection filter, or department.
 *
 * @param {object} [params={}]
 * @returns {{ heading: string, subtitle: string }}
 */
export function formatShopHeading({
  activeCategory = null,
  categoryParam = '',
  search = '',
  gender = '',
  isNewArrival = false,
  isFeatured = false,
} = {}) {
  if (activeCategory?.name) {
    return {
      heading: `${activeCategory.name} Collection`,
      subtitle:
        activeCategory.description ||
        `Explore curated ${activeCategory.name.toLowerCase()} selections and designer essentials.`,
    };
  }

  if (categoryParam && typeof categoryParam === 'string' && categoryParam.trim() && !/^[0-9a-fA-F]{24}$/.test(categoryParam.trim())) {
    const formatted = categoryParam
      .trim()
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
    return {
      heading: `${formatted} Collection`,
      subtitle: 'Curated luxury pieces from our signature collection.',
    };
  }

  if (search && typeof search === 'string' && search.trim()) {
    return {
      heading: `Search Results for "${search.trim()}"`,
      subtitle: 'Curated pieces matching your search query across our catalog.',
    };
  }

  if (isNewArrival) {
    return {
      heading: 'New Arrivals Collection',
      subtitle: 'Latest seasonal releases crafted with contemporary elegance.',
    };
  }

  if (isFeatured) {
    return {
      heading: 'Featured Luxury Collection',
      subtitle: 'Editorial highlights and signature pieces hand-picked by our atelier.',
    };
  }

  if (gender && typeof gender === 'string' && gender.trim()) {
    const g = gender.trim().toUpperCase();
    const label = g === 'MEN' ? "Men's" : g === 'WOMEN' ? "Women's" : g.charAt(0) + g.slice(1).toLowerCase();
    return {
      heading: `${label} Collection`,
      subtitle: `Tailored ${label.toLowerCase()} silhouettes, footwear, and signature essentials.`,
    };
  }

  return {
    heading: 'Fashion & Lifestyle Catalog',
    subtitle: 'Curated luxury apparel, footwear, accessories, and beauty collections',
  };
}

/**
 * Builds synchronized visible breadcrumb items and BreadcrumbList JSON-LD
 * for a top-level static or policy page (e.g. Home -> Privacy Policy).
 *
 * @param {string} label
 * @param {string} pagePath
 * @param {string|null} [siteOrigin=null]
 * @returns {{ items: Array<{ label: string, to: string, url: string }>, jsonLd: object }}
 */
export function buildPageBreadcrumbs(label, pagePath, siteOrigin = null) {
  const originUrl = getCanonicalSiteOrigin(siteOrigin);
  const normalizedPath = pagePath && pagePath.startsWith('/') ? pagePath : `/${pagePath || ''}`;
  const items = [
    { label: 'Home', to: '/', url: `${originUrl}/` },
    { label: label || 'Page', to: normalizedPath, url: `${originUrl}${normalizedPath}` },
  ];

  return {
    items,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        name: item.label,
        item: item.url,
      })),
    },
  };
}
