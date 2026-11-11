import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  LifeBuoy,
  Flame,
  Award,
  Layers,
  Instagram,
  Facebook,
  Twitter,
  Mail,
  Phone,
  Clock,
  MapPin,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import AnnouncementBar from '../components/home/AnnouncementBar';
import HeroBannerSection from '../components/home/HeroBannerSection';
import PromoBannerSection from '../components/home/PromoBannerSection';
import ProductCard from '../components/ProductCard';
import SEO from '../components/common/SEO';
import { buildHomepageStructuredData } from '../features/settings/utils/seoUtils';
import Logo from '../components/common/Logo';
import {
  CONTACT_NAV_LINK,
  POLICY_NAV_LINKS,
  PortfolioNoticeStrip,
} from '../components/common/PortfolioFooter';
import { contentApi } from '../features/content/api/contentApi';
import { categoryApi } from '../features/categories/api/categoryApi';
import { productApi } from '../features/products/api/productApi';
import { useStoreSettings } from '../features/settings/context/useStoreSettings';
import {
  isValidHttpUrl,
  isValidEmail,
  isValidPhone,
  formatAddress,
} from '../features/settings/utils/contactUtils';

/**
 * Clean inline SVG for Pinterest
 */
function PinterestIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345-.09.375-.291 1.199-.334 1.357-.057.24-.19.291-.438.175-1.637-.762-2.66-3.153-2.66-5.076 0-4.135 3.007-7.935 8.675-7.935 4.555 0 8.096 3.246 8.096 7.585 0 4.526-2.854 8.169-6.814 8.169-1.331 0-2.583-.692-3.011-1.509l-.819 3.123c-.296 1.139-1.097 2.566-1.634 3.439C9.563 23.807 10.758 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
    </svg>
  );
}

/**
 * Skeleton Loader for Product Grids
 */
function ProductGridSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-[#E7DED5] overflow-hidden p-3 space-y-3 animate-pulse"
        >
          <div className="aspect-4/5 bg-[#E7DED5]/40 rounded-lg w-full" />
          <div className="h-3 bg-[#E7DED5]/50 rounded w-1/3" />
          <div className="h-4 bg-[#E7DED5]/70 rounded w-3/4" />
          <div className="h-4 bg-[#E7DED5]/50 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const { settings } = useStoreSettings();
  const storeName = settings?.storeName || 'LuxeCart';
  const tagline =
    settings?.tagline ||
    "Curated luxury fashion, handcrafted leather footwear, botanical beauty, and lifestyle essentials.";

  // Safe contact attributes
  const hasEmail = isValidEmail(settings?.supportEmail);
  const hasPhone = isValidPhone(settings?.supportPhone);
  const hasHours = Boolean(
    settings?.operatingHours &&
      typeof settings.operatingHours === 'string' &&
      settings.operatingHours.trim()
  );
  const formattedAddress = formatAddress(settings?.address);

  // Social link definitions with safe URL validation
  const rawSocial = settings?.socialLinks || {};
  const activeSocialLinks = [
    { platform: 'instagram', label: 'Instagram', url: rawSocial.instagram, icon: Instagram },
    { platform: 'facebook', label: 'Facebook', url: rawSocial.facebook, icon: Facebook },
    { platform: 'twitter', label: 'Twitter / X', url: rawSocial.twitter, icon: Twitter },
    { platform: 'pinterest', label: 'Pinterest', url: rawSocial.pinterest, icon: PinterestIcon },
  ].filter((item) => isValidHttpUrl(item.url));

  const standardFeeRupees =
    typeof settings?.shipping?.standardFeeRupees === 'number' && settings.shipping.standardFeeRupees >= 0
      ? settings.shipping.standardFeeRupees
      : 200;
  const minDeliveryDays = settings?.shipping?.deliveryEstimateDays?.min || 3;
  const maxDeliveryDays = settings?.shipping?.deliveryEstimateDays?.max || 7;
  const isReturnsEnabled = settings?.returns?.isReturnsEnabled !== false;
  const returnWindowDays = settings?.returns?.returnWindowDays || 7;
  const isCodEnabled = settings?.payment?.isCodEnabled !== false;

  const [homepageContent, setHomepageContent] = useState({
    announcementBars: [],
    heroBanners: [],
    promoBanners: [],
    featuredCollections: [],
    sections: [],
  });

  const [categories, setCategories] = useState([]);
  const [trendingProducts, setTrendingProducts] = useState([]);
  const [newArrivalProducts, setNewArrivalProducts] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);

  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingNewArrivals, setLoadingNewArrivals] = useState(true);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  // 6 Verified luxury department tiles using actual product images from catalog
  const departmentTiles = [
    {
      id: 'men',
      name: 'Men',
      slug: 'men',
      link: '/shop?gender=MEN',
      subtitle: 'Tailored Shirts & Casual Cottons',
      imageUrl:
        'https://res.cloudinary.com/luxecart-india/image/upload/v1791548905/luxecart/products/northline-oxford-casual-shirt/m5blvfpnalwob3ent1ce.jpg',
    },
    {
      id: 'women',
      name: 'Women',
      slug: 'women',
      link: '/shop?gender=WOMEN',
      subtitle: 'Satin Eveningwear & Dresses',
      imageUrl:
        'https://res.cloudinary.com/luxecart-india/image/upload/v1791556121/luxecart/products/elane-satin-midi-dress/wdnrdoghhkxcuuoyffkh.jpg',
    },
    {
      id: 'footwear',
      name: 'Footwear',
      slug: 'footwear',
      link: '/shop?category=footwear',
      subtitle: 'Handcrafted Loafers & Runners',
      imageUrl:
        'https://res.cloudinary.com/luxecart-india/image/upload/v1791631393/luxecart/products/stride-minimal-leather-loafers/qbazxdfbstepymvrizg0.jpg',
    },
    {
      id: 'beauty',
      name: 'Beauty',
      slug: 'beauty',
      link: '/shop?category=beauty',
      subtitle: 'Botanical Face Serums & Skincare',
      imageUrl:
        'https://res.cloudinary.com/luxecart-india/image/upload/v1791632316/luxecart/products/nivelle-vitamin-c-brightening-serum/veo7dzwacenzwrrxdtll.jpg',
    },
    {
      id: 'accessories',
      name: 'Accessories',
      slug: 'accessories',
      link: '/shop?category=accessories',
      subtitle: 'Structured Leather Shoulder Bags',
      imageUrl:
        'https://res.cloudinary.com/luxecart-india/image/upload/v1791632732/luxecart/products/aurelia-structured-shoulder-bag/ycztontqcmmgijui1yrv.jpg',
    },
    {
      id: 'lifestyle',
      name: 'Lifestyle',
      slug: 'lifestyle',
      link: '/shop?category=lifestyle',
      subtitle: 'Artisanal Sets & Contemporary Living',
      imageUrl:
        'https://res.cloudinary.com/luxecart-india/image/upload/v1791628415/luxecart/products/nivara-printed-kurta-set/hizvwbk3c3fjyjkefomd.jpg',
    },
  ];

  useEffect(() => {
    // 1. Fetch Dynamic Storefront CMS Content
    contentApi
      .getHomepageContent()
      .then((res) => {
        if (res?.success && res.data) {
          setHomepageContent(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch homepage dynamic content:', err);
      });

    // 2. Fetch Catalog Categories
    categoryApi
      .getCategories()
      .then((res) => setCategories(res?.data?.categories || []))
      .catch(() => {});

    // 3. Fetch Trending Products (sorted by rating or catalog order)
    productApi
      .getProducts({ limit: 4, sort: 'rating' })
      .then((res) => {
        const prods = res?.data || [];
        setTrendingProducts(prods.length > 0 ? prods : []);
      })
      .catch(() => {})
      .finally(() => setLoadingTrending(false));

    // 4. Fetch New Arrivals (strictly items marked isNewArrival)
    productApi
      .getNewArrivals(4)
      .then((res) => {
        const prods = res?.data?.products || res?.data || [];
        setNewArrivalProducts(prods);
      })
      .catch(() => {})
      .finally(() => setLoadingNewArrivals(false));

    // 5. Fetch Featured Collection
    productApi
      .getFeaturedProducts(4)
      .then((res) => {
        const prods = res?.data?.products || res?.data || [];
        setFeaturedProducts(prods);
      })
      .catch(() => {})
      .finally(() => setLoadingFeatured(false));
  }, []);

  const homepageStructuredData = buildHomepageStructuredData({
    storeName,
    tagline,
    logoUrl: settings?.logoUrlLight,
  });

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <SEO
        title={settings?.seo?.metaTitle || `${storeName} — Premium Fashion & Luxury Lifestyle`}
        description={settings?.seo?.metaDescription || tagline}
        keywords={settings?.seo?.keywords}
        canonical="/"
        structuredData={homepageStructuredData}
      />

      {/* 1. Announcement Bar */}
      <AnnouncementBar announcements={homepageContent.announcementBars} />

      {/* 2. Main Navigation Header */}
      <Navbar />

      <main id="main-content" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-10 sm:space-y-14 flex-1">
        {/* 3. Editorial Campaign Hero Banner */}
        <HeroBannerSection heroBanners={homepageContent.heroBanners} />

        {/* 4. Shop by Category (Image-Led Tiles with Consistent Aspect Ratios) */}
        <section aria-labelledby="shop-by-category-title" className="space-y-4 sm:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#E7DED5] pb-3 sm:pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[#9A6A45] text-xs font-bold uppercase tracking-wider mb-0.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Curated Departments</span>
              </div>
              <h2 id="shop-by-category-title" className="text-xl sm:text-2xl font-serif font-bold text-[#2A211B]">
                Shop by Category
              </h2>
            </div>
            <Link
              to="/shop"
              className="text-xs font-semibold text-[#9A6A45] hover:text-[#2A211B] transition-colors flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Explore All Departments</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {departmentTiles.map((dept) => (
              <Link
                key={dept.name}
                to={dept.link}
                className="group relative rounded-2xl overflow-hidden bg-white border border-[#E7DED5] hover:border-[#9A6A45] transition-all hover:shadow-xs flex flex-col"
              >
                {/* Image Container with Consistent 3:4 Aspect Ratio */}
                <div className="relative aspect-3/4 w-full bg-[#F7F3EE] overflow-hidden">
                  <img
                    src={dept.imageUrl}
                    alt={`${dept.name} Collection`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover object-center group-hover:scale-106 transition-transform duration-500 ease-out"
                  />
                  {/* Subtle Dark Gradient at bottom of image for readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                  {/* Category Title Overlay on Image */}
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 text-white">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#E7DED5]/90">
                      Collection
                    </span>
                    <h3 className="font-serif font-bold text-sm sm:text-base text-white leading-tight">
                      {dept.name}
                    </h3>
                  </div>
                </div>

                {/* Card Footer Subtitle */}
                <div className="p-2.5 bg-white flex items-center justify-between">
                  <span className="text-[11px] text-[#705E51] font-medium line-clamp-1">
                    {dept.subtitle}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#9A6A45] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 5. Trending Now (Real Catalog Products with Wishlist & Real Pricing) */}
        <section aria-labelledby="trending-now-title" className="space-y-4 sm:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#E7DED5] pb-3 sm:pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[#9A6A45] text-xs font-bold uppercase tracking-wider mb-0.5">
                <Flame className="w-3.5 h-3.5 text-amber-600" />
                <span>Popular Silhouettes</span>
              </div>
              <h2 id="trending-now-title" className="text-xl sm:text-2xl font-serif font-bold text-[#2A211B]">
                Trending Now
              </h2>
            </div>
            <Link
              to="/shop?sort=rating"
              className="text-xs font-semibold text-[#9A6A45] hover:text-[#2A211B] transition-colors flex items-center gap-1 self-start sm:self-auto"
            >
              <span>View All Trending</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loadingTrending ? (
            <ProductGridSkeleton count={4} />
          ) : trendingProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {trendingProducts.slice(0, 4).map((prod) => (
                <ProductCard key={prod.id || prod._id} product={prod} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-[#E7DED5] text-xs text-[#705E51]">
              <p>Trending pieces are updating from catalog.</p>
            </div>
          )}
        </section>

        {/* 6. Curated Campaign Banner (Editorial Spotlight: Handcrafted Footwear) */}
        <section aria-label="Curated Campaign Editorial" className="relative rounded-3xl overflow-hidden bg-[#2A211B] text-white border border-[#3D3128] shadow-md">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
            {/* Editorial Copy */}
            <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#9A6A45]/30 border border-[#9A6A45]/50 text-[#E7DED5] text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                <Award className="w-3 h-3 text-[#9A6A45]" />
                <span>Signature Footwear Spotlight</span>
              </div>

              <h2 className="text-xl sm:text-3xl font-serif font-bold text-[#F7F3EE] leading-tight">
                Handcrafted Footwear: Modern Silhouette Meets Everyday Comfort
              </h2>

              <p className="text-xs sm:text-sm text-[#D5CAC0] leading-relaxed max-w-lg">
                Engineered with supple leather, tailored detailing, and cushioned grip. Designed for seamless day-to-evening versatility.
              </p>

              <div className="pt-1 flex flex-wrap items-center gap-3 sm:gap-4">
                <Link
                  to="/shop?category=footwear"
                  className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-[#F7F3EE] text-[#2A211B] hover:bg-white transition-all text-xs sm:text-sm font-bold shadow-md hover:-translate-y-0.5 active:translate-y-0"
                >
                  <span>Explore Footwear Collection</span>
                  <ArrowRight className="w-4 h-4 text-[#9A6A45]" />
                </Link>

                <span className="text-xs text-[#A8988B] font-medium">
                  Featuring Stride & Vanta Collections
                </span>
              </div>
            </div>

            {/* Campaign Visual */}
            <div className="lg:col-span-5 relative h-64 sm:h-80 lg:h-full min-h-[260px] overflow-hidden">
              <img
                src="/images/campaign-footwear.jpg"
                alt="Handcrafted Leather Footwear Campaign"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.src =
                    'https://res.cloudinary.com/luxecart-india/image/upload/v1791631393/luxecart/products/stride-minimal-leather-loafers/qbazxdfbstepymvrizg0.jpg';
                }}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t lg:bg-gradient-to-l from-transparent via-transparent to-[#2A211B] opacity-90" />
            </div>
          </div>
        </section>

        {/* 7. New Arrivals (Real catalog items marked isNewArrival) */}
        <section aria-labelledby="new-arrivals-title" className="space-y-4 sm:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#E7DED5] pb-3 sm:pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[#9A6A45] text-xs font-bold uppercase tracking-wider mb-0.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Seasonal Releases</span>
              </div>
              <h2 id="new-arrivals-title" className="text-xl sm:text-2xl font-serif font-bold text-[#2A211B]">
                New Arrivals
              </h2>
            </div>
            <Link
              to="/shop?isNewArrival=true"
              className="text-xs font-semibold text-[#9A6A45] hover:text-[#2A211B] transition-colors flex items-center gap-1 self-start sm:self-auto"
            >
              <span>View All New In</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loadingNewArrivals ? (
            <ProductGridSkeleton count={4} />
          ) : newArrivalProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {newArrivalProducts.slice(0, 4).map((prod) => (
                <ProductCard key={prod.id || prod._id} product={prod} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-[#E7DED5] text-xs text-[#705E51]">
              <p>Fresh season arrivals are being prepared.</p>
            </div>
          )}
        </section>

        {/* 8. Promotional Banners (Verified Available Products, Horology-Free) */}
        <PromoBannerSection promoBanners={homepageContent.promoBanners} />

        {/* 9. Featured Collection (Curated Highlights) */}
        <section aria-labelledby="featured-collection-title" className="space-y-4 sm:space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[#E7DED5] pb-3 sm:pb-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[#9A6A45] text-xs font-bold uppercase tracking-wider mb-0.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Editorial Selections</span>
              </div>
              <h2 id="featured-collection-title" className="text-xl sm:text-2xl font-serif font-bold text-[#2A211B]">
                Featured Collection
              </h2>
            </div>
            <Link
              to="/shop?isFeatured=true"
              className="text-xs font-semibold text-[#9A6A45] hover:text-[#2A211B] transition-colors flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Explore Highlights</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loadingFeatured ? (
            <ProductGridSkeleton count={4} />
          ) : featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {featuredProducts.slice(0, 4).map((prod) => (
                <ProductCard key={prod.id || prod._id} product={prod} />
              ))}
            </div>
          ) : trendingProducts.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {trendingProducts.slice(0, 4).map((prod) => (
                <ProductCard key={prod.id || prod._id} product={prod} />
              ))}
            </div>
          ) : null}
        </section>

        {/* 10. Verified Brand Promises (Value Propositions) */}
        <section aria-label="Brand Promises" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 sm:pt-6 border-t border-[#E7DED5]">
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7DED5] hover:border-[#9A6A45] transition-all flex items-start gap-3.5 shadow-2xs">
            <div className="p-2.5 rounded-xl bg-[#F7F3EE] text-[#9A6A45] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#2A211B] uppercase tracking-wide">
                Portfolio Catalog Showcase
              </h3>
              <p className="text-[11px] text-[#705E51] mt-1 leading-relaxed">
                Non-commercial portfolio demonstration featuring curated multi-variant fashion and lifestyle items.
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7DED5] hover:border-[#9A6A45] transition-all flex items-start gap-3.5 shadow-2xs">
            <div className="p-2.5 rounded-xl bg-[#F7F3EE] text-[#9A6A45] shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#2A211B] uppercase tracking-wide">
                Simulated COD Delivery
              </h3>
              <p className="text-[11px] text-[#705E51] mt-1 leading-relaxed">
                Simulated flat ₹{standardFeeRupees} delivery flow with Cash on Delivery demo checkout ({minDeliveryDays}–{maxDeliveryDays} days estimate).
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7DED5] hover:border-[#9A6A45] transition-all flex items-start gap-3.5 shadow-2xs">
            <div className="p-2.5 rounded-xl bg-[#F7F3EE] text-[#9A6A45] shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#2A211B] uppercase tracking-wide">
                {isReturnsEnabled ? `${returnWindowDays}-Day Return Simulation` : 'Returns Currently Paused'}
              </h3>
              <p className="text-[11px] text-[#705E51] mt-1 leading-relaxed">
                {isReturnsEnabled
                  ? `Interactive post-delivery return request simulation within a ${returnWindowDays}-day demo window via the customer portal.`
                  : 'Simulated returns are currently unavailable in store settings.'}
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E7DED5] hover:border-[#9A6A45] transition-all flex items-start gap-3.5 shadow-2xs">
            <div className="p-2.5 rounded-xl bg-[#F7F3EE] text-[#9A6A45] shrink-0">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#2A211B] uppercase tracking-wide">
                Dedicated Customer Care
              </h3>
              <p className="text-[11px] text-[#705E51] mt-1 leading-relaxed">
                Responsive order assistance and ticket tracking through our built-in help desk.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Comprehensive Luxury Footer */}
      <footer className="border-t border-[#3D3128] bg-[#171513] text-[#E7DED5] pt-12 pb-8 mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 sm:space-y-12">
          {/* Main Footer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 text-xs">
            {/* Column 1 & 2: Brand Identity */}
            <div className="lg:col-span-2 space-y-4 pr-4">
              <div className="flex items-center gap-2">
                <Logo variant="dark" className="h-8 w-auto" alt={storeName} />
              </div>
              <p className="text-[#A8988B] text-xs leading-relaxed max-w-sm">
                {tagline}
              </p>

              {/* Meaningful Contact Details */}
              {(hasEmail || hasPhone || hasHours || formattedAddress) && (
                <div className="pt-2 space-y-1.5 text-[11px] text-[#A8988B]">
                  {hasEmail && (
                    <p className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#9A6A45] shrink-0" />
                      <a
                        href={`mailto:${settings.supportEmail.trim()}`}
                        className="hover:text-white transition-colors"
                      >
                        {settings.supportEmail.trim()}
                      </a>
                    </p>
                  )}
                  {hasPhone && (
                    <p className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-[#9A6A45] shrink-0" />
                      <a
                        href={`tel:${settings.supportPhone.trim()}`}
                        className="hover:text-white transition-colors"
                      >
                        {settings.supportPhone.trim()}
                      </a>
                    </p>
                  )}
                  {hasHours && (
                    <p className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-[#9A6A45] shrink-0" />
                      <span>{settings.operatingHours.trim()}</span>
                    </p>
                  )}
                  {formattedAddress && (
                    <p className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#9A6A45] shrink-0 mt-0.5" />
                      <span>{formattedAddress}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Social Profile Links (rendered only when valid HTTP/HTTPS URLs exist) */}
              {activeSocialLinks.length > 0 && (
                <div className="pt-2 flex items-center gap-3">
                  {activeSocialLinks.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <a
                        key={item.platform}
                        href={item.url.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${storeName} on ${item.label}`}
                        className="text-[#A8988B] hover:text-[#E7DED5] transition-colors p-1 -m-1"
                      >
                        <IconComponent className="w-4 h-4" />
                      </a>
                    );
                  })}
                </div>
              )}

              <div className="pt-1 text-[11px] text-[#8C7A6D]">
                <p>Curated with quality and craftsmanship.</p>
              </div>
            </div>

            {/* Column 3: Shop Departments */}
            <div className="space-y-3">
              <h4 className="font-semibold text-[#F7F3EE] text-xs uppercase tracking-wider">
                Departments
              </h4>
              <ul className="space-y-2 text-[#A8988B]">
                <li>
                  <Link to="/shop?isNewArrival=true" className="hover:text-white transition-colors">
                    New Arrivals
                  </Link>
                </li>
                <li>
                  <Link to="/shop?gender=MEN" className="hover:text-white transition-colors">
                    Men's Collection
                  </Link>
                </li>
                <li>
                  <Link to="/shop?gender=WOMEN" className="hover:text-white transition-colors">
                    Women's Collection
                  </Link>
                </li>
                <li>
                  <Link to="/shop?category=footwear" className="hover:text-white transition-colors">
                    Luxury Footwear
                  </Link>
                </li>
                <li>
                  <Link to="/shop?category=beauty" className="hover:text-white transition-colors">
                    Skincare & Beauty
                  </Link>
                </li>
                <li>
                  <Link to="/shop?category=accessories" className="hover:text-white transition-colors">
                    Leather Accessories
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Client Concierge */}
            <div className="space-y-3">
              <h4 className="font-semibold text-[#F7F3EE] text-xs uppercase tracking-wider">
                Customer Care
              </h4>
              <ul className="space-y-2 text-[#A8988B]">
                <li>
                  <Link to="/orders" className="hover:text-white transition-colors">
                    My Orders & Tracking
                  </Link>
                </li>
                <li>
                  <Link to="/wishlist" className="hover:text-white transition-colors">
                    Saved Wishlist
                  </Link>
                </li>
                <li>
                  <Link to="/cart" className="hover:text-white transition-colors">
                    Shopping Bag
                  </Link>
                </li>
                <li>
                  <Link to="/account/addresses" className="hover:text-white transition-colors">
                    Delivery Addresses
                  </Link>
                </li>
                <li>
                  <Link to="/support" className="hover:text-white transition-colors">
                    Support & FAQs
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 5: Portfolio Policies & Legal Disclosures */}
            <div className="space-y-3">
              <h4 className="font-semibold text-[#F7F3EE] text-xs uppercase tracking-wider">
                Policies &amp; Transparency
              </h4>
              <nav aria-label="Policies & Legal Disclosures">
                <ul className="space-y-2 text-[#A8988B]">
                  <li>
                    <Link to={CONTACT_NAV_LINK.to} className="hover:text-white transition-colors">
                      {CONTACT_NAV_LINK.label}
                    </Link>
                  </li>
                  {POLICY_NAV_LINKS.map((item) => (
                    <li key={item.to}>
                      <Link to={item.to} className="hover:text-white transition-colors">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <span className="text-[#8C7A6D] text-[11px]">
                      {isReturnsEnabled ? `${returnWindowDays}-Day Return Simulation` : 'Returns Currently Unavailable'}
                    </span>
                  </li>
                  <li>
                    <span className="text-[#8C7A6D] text-[11px]">
                      {isCodEnabled ? 'Simulated Cash on Delivery' : 'Cash on Delivery Unavailable'}
                    </span>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

          <PortfolioNoticeStrip variant="dark" />

          {/* Bottom Copyright & Security Strip */}
          <div className="border-t border-[#2A211B] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#705E51]">
            <p>
              &copy; {new Date().getFullYear()} {storeName} — Non-Commercial Portfolio Demo. All rights reserved.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-[#8C7A6D]">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#9A6A45]" />
                <span>Portfolio Demonstration</span>
              </span>
              <span>•</span>
              <span>Simulated Cash on Delivery</span>
              <span>•</span>
              <span>No Real Financial Transactions</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
