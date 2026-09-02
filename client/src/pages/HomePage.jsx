import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Package,
  Truck,
  RotateCcw,
  LifeBuoy,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import AnnouncementBar from '../components/home/AnnouncementBar';
import HeroBannerSection from '../components/home/HeroBannerSection';
import PromoBannerSection from '../components/home/PromoBannerSection';
import FeaturedCollectionSection from '../components/home/FeaturedCollectionSection';
import SEO from '../components/common/SEO';
import Logo from '../components/common/Logo';
import { contentApi } from '../features/content/api/contentApi';
import { categoryApi } from '../features/categories/api/categoryApi';
import { productApi } from '../features/products/api/productApi';

export default function HomePage() {
  const [homepageContent, setHomepageContent] = useState({
    announcementBars: [],
    heroBanners: [],
    promoBanners: [],
    featuredCollections: [],
    sections: [],
  });
  const [contentLoading, setContentLoading] = useState(true);

  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);

  useEffect(() => {
    // 1. Fetch Dynamic Storefront Content
    contentApi
      .getHomepageContent()
      .then((res) => {
        if (res?.success && res.data) {
          setHomepageContent(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch homepage dynamic content:', err);
      })
      .finally(() => {
        setContentLoading(false);
      });

    // 2. Fetch Catalog Categories & Fallback Featured Products
    categoryApi
      .getCategories()
      .then((res) => setCategories(res?.data?.categories || []))
      .catch(() => {});

    productApi
      .getFeaturedProducts(4)
      .then((res) => setFeaturedProducts(res?.data?.products || []))
      .catch(() => {});
  }, []);

  const homepageStructuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'LuxeCart',
      url: 'https://luxecart.com',
      logo: 'https://luxecart.com/luxecart-logo.png',
      description:
        'Curated luxury fashion, artisanal timepieces, handcrafted leather footwear, and lifestyle essentials.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'LuxeCart',
      url: 'https://luxecart.com',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://luxecart.com/shop?search={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <SEO
        title="LuxeCart — Premium Fashion & Luxury Lifestyle"
        description="Explore curated Indian and international designer apparel, handcrafted luxury footwear, and signature lifestyle essentials at LuxeCart."
        canonical="/"
        structuredData={homepageStructuredData}
      />

      {/* 1. Dynamic Top Announcement Bar */}
      <AnnouncementBar announcements={homepageContent.announcementBars} />

      {/* Main Navbar */}
      <Navbar />

      <main id="main-content" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12 flex-1">
        {/* 2. Dynamic Hero Banner Section */}
        <HeroBannerSection heroBanners={homepageContent.heroBanners} />

        {/* 3. Dynamic Promotional Banners */}
        <PromoBannerSection promoBanners={homepageContent.promoBanners} />

        {/* 4. Shop by Department / Categories */}
        {categories.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
              <div>
                <h2 className="text-xl font-serif font-bold text-[#2A211B]">
                  Shop by Department
                </h2>
                <p className="text-xs text-[#705E51]">Curated luxury categories and haute horlogerie</p>
              </div>
              <Link to="/shop" className="text-xs font-semibold text-[#9A6A45] hover:underline flex items-center gap-1">
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {categories.map((cat) => (
                <Link
                  key={cat.id || cat._id}
                  to={`/shop?category=${cat.id || cat._id}`}
                  className="p-5 rounded-2xl bg-white border border-[#E7DED5] hover:border-[#9A6A45] transition-all hover:shadow-xs group space-y-1 block"
                >
                  <h3 className="font-semibold text-sm text-[#2A211B] group-hover:text-[#9A6A45] transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-[#705E51] line-clamp-1">
                    {cat.description || `${cat.children?.length || 0} Subcategories`}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 5. Dynamic Featured Collections */}
        <FeaturedCollectionSection
          featuredCollections={homepageContent.featuredCollections}
          fallbackProducts={featuredProducts}
        />

        {/* 6. Luxury Value Propositions */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-[#E7DED5]">
          <div className="p-4 rounded-xl bg-white border border-[#E7DED5] flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#F7F3EE] text-[#9A6A45]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#2A211B]">100% Authentic Luxury</h3>
              <p className="text-[11px] text-[#705E51]">Direct from master ateliers</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E7DED5] flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#F7F3EE] text-[#9A6A45]">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#2A211B]">Express Insured Shipping</h3>
              <p className="text-[11px] text-[#705E51]">Complimentary across India</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E7DED5] flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#F7F3EE] text-[#9A6A45]">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#2A211B]">Concierge Returns</h3>
              <p className="text-[11px] text-[#705E51]">Doorstep verification & instant refund</p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E7DED5] flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#F7F3EE] text-[#9A6A45]">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#2A211B]">Dedicated Styling Support</h3>
              <p className="text-[11px] text-[#705E51]">24/7 personal fashion advisor</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E7DED5] bg-[#2A211B] text-[#E7DED5] py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <Logo variant="dark" className="h-6 w-auto" alt="LuxeCart" />
            <span className="text-[#705E51]">|</span>
            <span className="text-[#E7DED5]">Artisanal Luxury E-Commerce</span>
          </div>
          <p className="text-[#705E51]">
            &copy; {new Date().getFullYear()} LuxeCart. All rights reserved. Server Authoritative CMS Active.
          </p>
        </div>
      </footer>
    </div>
  );
}
