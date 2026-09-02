import { useEffect } from 'react';

/**
 * Reusable SEO & Document Head Management Component
 * Dynamically updates document title, standard meta tags, OpenGraph, Twitter cards,
 * canonical links, and Schema.org JSON-LD structured data.
 */
export default function SEO({
  title,
  description,
  canonical,
  image,
  type = 'website',
  robots = 'index, follow',
  structuredData = null,
}) {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const defaultTitle = 'LuxeCart — Premium Fashion & Luxury Lifestyle';
    const defaultDescription =
      'Explore curated Indian and international designer apparel, handcrafted luxury footwear, and signature lifestyle essentials at LuxeCart.';
    const defaultImage = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=1200';
    const siteUrl = window.location.origin;

    const fullTitle = title
      ? title.includes('LuxeCart')
        ? title
        : `${title} | LuxeCart`
      : defaultTitle;
    const metaDescription = description || defaultDescription;
    const metaImage = image || defaultImage;
    const canonicalUrl = canonical
      ? canonical.startsWith('http')
        ? canonical
        : `${siteUrl}${canonical}`
      : window.location.href;

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

    // 3. Open Graph Tags
    setMetaTag('property', 'og:title', fullTitle);
    setMetaTag('property', 'og:description', metaDescription);
    setMetaTag('property', 'og:image', metaImage);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:type', type);
    setMetaTag('property', 'og:site_name', 'LuxeCart');

    // 4. Twitter Card Tags
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', fullTitle);
    setMetaTag('name', 'twitter:description', metaDescription);
    setMetaTag('name', 'twitter:image', metaImage);

    // 5. Canonical Link
    let canonicalElement = document.querySelector('link[rel="canonical"]');
    if (!canonicalElement) {
      canonicalElement = document.createElement('link');
      canonicalElement.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalElement);
    }
    canonicalElement.setAttribute('href', canonicalUrl);

    // 6. JSON-LD Structured Data
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
  }, [title, description, canonical, image, type, robots, structuredData]);

  return null;
}
