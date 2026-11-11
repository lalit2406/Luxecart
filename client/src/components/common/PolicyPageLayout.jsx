import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import Navbar from '../Navbar';
import SEO from './SEO';
import PortfolioFooter, { POLICY_NAV_LINKS, PortfolioNoticeStrip } from './PortfolioFooter';
import { useStoreSettings } from '../../features/settings/context/useStoreSettings';
import { buildPageBreadcrumbs, buildCanonicalUrl } from '../../features/settings/utils/seoUtils';

/**
 * Shared accessible layout for LuxeCart's public portfolio policy and legal transparency pages.
 */
export default function PolicyPageLayout({
  title,
  breadcrumbLabel = '',
  seoTitle,
  description,
  canonicalPath,
  badgeLabel,
  subtitle,
  sections = [],
}) {
  let storeName = 'LuxeCart';
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const settingsContext = useStoreSettings();
    storeName = settingsContext?.settings?.storeName || 'LuxeCart';
  } catch {
    storeName = 'LuxeCart';
  }

  const { items: breadcrumbItems, jsonLd: breadcrumbSchema } = buildPageBreadcrumbs(
    breadcrumbLabel || title,
    canonicalPath
  );
  const canonicalUrl = buildCanonicalUrl(canonicalPath);

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: seoTitle || title,
    description,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: storeName,
      url: buildCanonicalUrl('/'),
    },
  };

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <SEO
        title={seoTitle || title}
        description={description}
        canonical={canonicalPath}
        structuredData={[webPageSchema, breadcrumbSchema]}
      />

      <Navbar />

      <main id="main-content" className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 space-y-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#6F6963]">
          {breadcrumbItems.map((item, idx) => {
            const isLast = idx === breadcrumbItems.length - 1;
            return (
              <React.Fragment key={item.to}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-[#A8988B] shrink-0" aria-hidden="true" />}
                {isLast ? (
                  <span aria-current="page" className="text-[#2A211B] font-medium">
                    {item.label}
                  </span>
                ) : (
                  <Link to={item.to} className="hover:text-[#9A6A45] transition-colors">
                    {item.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        <PortfolioNoticeStrip />

        <article className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-10 shadow-xs space-y-8">
          <header className="space-y-3 border-b border-[#E7DED5] pb-6">
            {badgeLabel && (
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9A6A45]">
                {badgeLabel}
              </p>
            )}
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#2A211B] tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-[#6F6963] leading-relaxed">{subtitle}</p>
            )}
          </header>

          <div className="space-y-7">
            {sections.map((section) => (
              <section key={section.heading} className="space-y-2.5">
                <h2 className="text-base sm:text-lg font-serif font-bold text-[#2A211B]">
                  {section.heading}
                </h2>
                {Array.isArray(section.paragraphs) &&
                  section.paragraphs.map((text, idx) => (
                    <p key={idx} className="text-xs sm:text-sm text-[#574D45] leading-relaxed">
                      {text}
                    </p>
                  ))}
                {Array.isArray(section.bullets) && section.bullets.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-[#574D45] leading-relaxed">
                    {section.bullets.map((bullet, idx) => (
                      <li key={idx}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <footer className="pt-6 border-t border-[#E7DED5] flex flex-wrap items-center justify-between gap-4 text-xs text-[#6F6963]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {POLICY_NAV_LINKS.filter((item) => item.to !== canonicalPath).map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="text-[#9A6A45] hover:text-[#2A211B] font-medium transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <Link
              to="/shop"
              className="text-[#2A211B] hover:text-[#9A6A45] font-semibold transition-colors"
            >
              Browse Demo Catalog &rarr;
            </Link>
          </footer>
        </article>
      </main>

      <PortfolioFooter />
    </div>
  );
}
