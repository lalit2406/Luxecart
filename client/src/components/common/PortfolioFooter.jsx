import React from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import Logo from './Logo';
import { useStoreSettings } from '../../features/settings/context/useStoreSettings';

/**
 * Shared non-commercial portfolio disclosure copy used across the storefront and policy pages.
 */
export const PORTFOLIO_NOTICE_TEXT =
  'LuxeCart is a non-commercial ecommerce portfolio demonstration. Orders, payments, shipping and returns are simulated.';

/**
 * Shared navigation list for publicly accessible legal and policy pages.
 */
export const POLICY_NAV_LINKS = Object.freeze([
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'Shipping Policy', to: '/shipping-policy' },
  { label: 'Returns & Refunds Policy', to: '/returns-policy' },
]);

/**
 * Shared public Contact & Project Information navigation link.
 */
export const CONTACT_NAV_LINK = Object.freeze({
  label: 'Contact',
  to: '/contact',
});

/**
 * Subtle portfolio demonstration notice banner/strip for shared UI surfaces.
 */
export function PortfolioNoticeStrip({ variant = 'light', className = '' }) {
  const isDark = variant === 'dark';
  return (
    <div
      role="note"
      aria-label="Portfolio Demonstration Notice"
      className={`rounded-xl border px-3.5 py-2.5 text-[11px] leading-relaxed flex items-start sm:items-center gap-2.5 ${
        isDark
          ? 'bg-[#2A211B]/70 border-[#3D3128] text-[#E7DED5]'
          : 'bg-white border-[#E7DED5] text-[#6F6963]'
      } ${className}`}
    >
      <Info className="w-4 h-4 text-[#9A6A45] shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
      <p>
        <span className={`font-semibold ${isDark ? 'text-[#F7F3EE]' : 'text-[#2A211B]'}`}>
          Portfolio Demonstration:
        </span>{' '}
        {PORTFOLIO_NOTICE_TEXT}
      </p>
    </div>
  );
}

/**
 * Shared footer component for catalog, product, 404, and legal policy pages.
 */
export default function PortfolioFooter() {
  let settings = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const settingsContext = useStoreSettings();
    settings = settingsContext?.settings;
  } catch {
    settings = null;
  }

  const storeName = settings?.storeName || 'LuxeCart';

  return (
    <footer className="border-t border-[#3D3128] bg-[#171513] text-[#E7DED5] py-8 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-md">
            <Link to="/" className="inline-flex items-center" aria-label={`${storeName} Home`}>
              <Logo variant="dark" className="h-7 w-auto" alt={storeName} />
            </Link>
            <p className="text-xs text-[#A8988B] leading-relaxed">{PORTFOLIO_NOTICE_TEXT}</p>
          </div>

          <nav
            aria-label="Legal & Portfolio Policies"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#A8988B]"
          >
            <Link to="/shop" className="hover:text-white transition-colors">
              Shop Catalog
            </Link>
            <Link to={CONTACT_NAV_LINK.to} className="hover:text-white transition-colors">
              {CONTACT_NAV_LINK.label}
            </Link>
            {POLICY_NAV_LINKS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <Link to="/support" className="hover:text-white transition-colors">
              Support Desk
            </Link>
          </nav>
        </div>

        <div className="border-t border-[#2A211B] pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-[#8C7A6D]">
          <p>
            &copy; {new Date().getFullYear()} {storeName} — Non-Commercial Portfolio Demo.
          </p>
          <p>Simulated Cash on Delivery • No Real Financial Transactions</p>
        </div>
      </div>
    </footer>
  );
}
