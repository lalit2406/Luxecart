import { useEffect } from 'react';
import { useStoreSettings } from '../../features/settings/context/useStoreSettings';
import {
  DEFAULT_SITE_ORIGIN,
  getCanonicalSiteOrigin,
  isValidHttpUrl,
  formatTitle,
  buildCanonicalUrl,
  resolveMetaImage,
  resolveMetaKeywords,
  updateFavicon,
} from '../../features/settings/utils/seoUtils';

export {
  DEFAULT_SITE_ORIGIN,
  getCanonicalSiteOrigin,
  isValidHttpUrl,
  formatTitle,
  buildCanonicalUrl,
  resolveMetaImage,
  resolveMetaKeywords,
  updateFavicon,
};

/**
 * Reusable SEO & Document Head Management Component
 * Dynamically updates document title, standard meta tags, OpenGraph, Twitter cards,
 * canonical links, dynamic favicon, and Schema.org JSON-LD structured data.
 */
export default function SEO({
  title,
  description,
  keywords,
  canonical,
  image,
  type = 'website',
  robots = 'index, follow',
  structuredData = null,
}) {
  let settings = null;
  try {
    const settingsContext = useStoreSettings();
    settings = settingsContext?.settings;
  } catch {
    settings = null;
  }

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const storeName = settings?.storeName || 'LuxeCart';
    const defaultTitle = settings?.seo?.metaTitle || `${storeName} — Curated Luxury Fashion & Lifestyle`;
    const defaultDescription =
      settings?.seo?.metaDescription ||
      `Explore curated luxury fashion, handcrafted footwear, and signature lifestyle essentials at ${storeName}.`;
    const siteUrl = getCanonicalSiteOrigin();
    const defaultImage = `${siteUrl}/images/hero-campaign.jpg`;

    const fullTitle = formatTitle(title, storeName, defaultTitle);
    const metaDescription = description || defaultDescription;
    const metaImage = resolveMetaImage(image, settings?.logoUrlLight, defaultImage);
    const metaKeywords = resolveMetaKeywords(keywords, settings?.seo?.keywords);
    const canonicalUrl = buildCanonicalUrl(canonical, siteUrl);

    // 1. Update Title
    document.title = fullTitle;

    // Helper: Set or create meta tag
    const setMetaTag = (attributeName, attributeValue, content) => {
      if (!content) return;
      let element = document.querySelector(`meta[${attributeName}="${attributeValue}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attributeName, attributeValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 2. Standard Meta Tags
    setMetaTag('name', 'description', metaDescription);
    setMetaTag('name', 'robots', robots);
    if (metaKeywords) {
      setMetaTag('name', 'keywords', metaKeywords);
    }

    // 3. Open Graph Tags
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', metaDescription);
    setMetaTag('property', 'og:image', metaImage);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:type', type);
    setMetaTag('property', 'og:site_name', storeName);

    // 4. Twitter Card Tags
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', metaDescription);
    setMetaTag('name', 'twitter:image', metaImage);

    // 5. Canonical Link (explicitly remove stale canonical when suppressed with canonical={false})
    let canonicalElement = document.querySelector('link[rel="canonical"]');
    if (canonical === false || !canonicalUrl) {
      if (canonicalElement) {
        canonicalElement.remove();
      }
      const staleOgUrl = document.querySelector('meta[property="og:url"]');
      if (staleOgUrl) {
        staleOgUrl.remove();
      }
    } else {
      if (!canonicalElement) {
        canonicalElement = document.createElement('link');
        canonicalElement.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalElement);
      }
      canonicalElement.setAttribute('href', canonicalUrl);
    }

    // 6. Dynamic Favicon Update
    updateFavicon(settings?.faviconUrl);

    // 7. JSON-LD Structured Data
    const scriptId = 'luxecart-structured-data';
    let scriptElement = document.getElementById(scriptId);

    if (structuredData) {
      if (!scriptElement) {
        scriptElement = document.createElement('script');
        scriptElement.setAttribute('type', 'application/ld+json');
        scriptElement.setAttribute('id', scriptId);
        document.head.appendChild(scriptElement);
      }
      scriptElement.textContent = JSON.stringify(structuredData);
    } else if (scriptElement) {
      scriptElement.remove();
    }

    return () => {
      // Cleanup on unmount if needed
    };
  }, [title, description, keywords, canonical, image, type, robots, structuredData, settings]);

  return null;
}
