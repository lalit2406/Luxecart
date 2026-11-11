import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, Home, ShoppingBag } from 'lucide-react';
import Navbar from '../components/Navbar';
import SEO from '../components/common/SEO';
import PortfolioFooter from '../components/common/PortfolioFooter';
import { useStoreSettings } from '../features/settings/context/useStoreSettings';

/**
 * Custom 404 Page for unmatched client-side routes.
 * Renders a single H1, navigation links back to Home and Shop, and `robots="noindex, nofollow"`.
 * Note: Because LuxeCart is deployed as a Vercel client-side SPA, the initial HTTP status
 * served for unmatched URLs via the `/(.*) -> /index.html` rewrite is HTTP 200; indexing
 * exclusion is signaled to crawlers via `<meta name="robots" content="noindex, nofollow" />`.
 */
export default function NotFoundPage() {
  let storeName = 'LuxeCart';
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const settingsContext = useStoreSettings();
    storeName = settingsContext?.settings?.storeName || 'LuxeCart';
  } catch {
    storeName = 'LuxeCart';
  }

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <SEO
        title="Page Not Found"
        description={`The page you requested could not be found at ${storeName}.`}
        robots="noindex, nofollow"
        canonical={false}
      />

      <Navbar />

      <main
        id="main-content"
        className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-16 sm:py-24"
      >
        <div className="max-w-lg w-full bg-white border border-[#E7DED5] rounded-3xl p-8 sm:p-12 text-center shadow-xs space-y-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-[#F7F3EE] border border-[#E7DED5] flex items-center justify-center text-[#9A6A45]">
            <Compass className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#9A6A45]">
              Error 404
            </p>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#2A211B] tracking-tight">
              Page Not Found
            </h1>
            <p className="text-xs sm:text-sm text-[#6F6963] leading-relaxed pt-1">
              The destination you are looking for may have moved or no longer exists. Explore our curated collections below.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-xs sm:text-sm font-semibold shadow-xs"
            >
              <Home className="w-4 h-4" />
              <span>Return Home</span>
            </Link>

            <Link
              to="/shop"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#F7F3EE] border border-[#E7DED5] text-[#2A211B] hover:border-[#9A6A45] transition-colors text-xs sm:text-sm font-semibold"
            >
              <ShoppingBag className="w-4 h-4 text-[#9A6A45]" />
              <span>Explore Shop</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#9A6A45]" />
            </Link>
          </div>
        </div>
      </main>

      <PortfolioFooter />
    </div>
  );
}
