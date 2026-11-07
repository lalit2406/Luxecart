import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, ChevronLeft, ChevronRight, ShieldCheck, Truck, RotateCcw } from 'lucide-react';

export default function HeroBannerSection({ heroBanners = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reliable, verified local campaign hero asset
  const defaultBanner = {
    title: 'The Autumn / Winter Haute Collection',
    subtitle:
      'Curated designer silhouettes, tailored apparel, handcrafted leather footwear, and signature lifestyle essentials.',
    imageUrl: '/images/hero-campaign.jpg',
    ctaText: 'Shop Collection',
    ctaLink: '/shop',
  };

  const banners = heroBanners && heroBanners.length > 0 ? heroBanners : [defaultBanner];

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const currentBanner = banners[currentIndex] || banners[0];
  const activeImageUrl = currentBanner.imageUrl || '/images/hero-campaign.jpg';

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  return (
    <section
      role="region"
      aria-label="Editorial Campaign Hero"
      className="relative rounded-3xl bg-[#171513] text-white overflow-hidden shadow-xl min-h-[340px] sm:min-h-[400px] lg:min-h-[440px] flex items-center border border-[#3D3128]"
    >
      {/* 1. Real High-Fashion Campaign Image with Balanced Contrast Scrim */}
      <div className="absolute inset-0 z-0">
        <img
          src={activeImageUrl}
          alt={currentBanner.title || 'LuxeCart Fashion Campaign'}
          loading="eager"
          decoding="async"
          onError={(e) => {
            // Graceful fallback to verified local campaign asset if dynamic URL fails
            if (e.currentTarget.src !== window.location.origin + '/images/hero-campaign.jpg') {
              e.currentTarget.src = '/images/hero-campaign.jpg';
            }
          }}
          className="w-full h-full object-cover object-center lg:object-right opacity-65 scale-100 transition-all duration-1000 ease-out"
        />
        {/* Directional Scrim: solid readable background for text on the left, clear natural fashion photo on the right */}
        <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-[#171513] via-[#171513]/80 sm:via-[#171513]/65 to-black/20 z-1" />
      </div>

      {/* 2. Editorial Content Showcase */}
      <div className="relative z-10 max-w-xl px-6 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-12 space-y-4 sm:space-y-5">
        {/* Curated Campaign Tag */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#9A6A45]/30 border border-[#9A6A45]/50 text-[#E7DED5] text-[10px] sm:text-[11px] font-bold uppercase tracking-widest shadow-xs">
            <Sparkles className="w-3 h-3 text-[#E7DED5]" />
            <span>Seasonal Campaign</span>
          </div>
        </div>

        {/* Editorial Headline */}
        <div className="space-y-2 sm:space-y-2.5">
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-serif font-bold tracking-tight leading-[1.15] text-[#F7F3EE]">
            {currentBanner.title || 'The Autumn / Winter Haute Collection'}
          </h1>

          <p className="text-xs sm:text-sm text-[#D5CAC0] max-w-lg leading-relaxed">
            {currentBanner.subtitle ||
              'Explore curated designer silhouettes, tailored apparel, handcrafted leather footwear, and signature lifestyle essentials.'}
          </p>
        </div>

        {/* Action CTAs */}
        <div className="pt-1 flex flex-wrap items-center gap-3">
          <Link
            to={currentBanner.ctaLink || '/shop'}
            className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-[#F7F3EE] text-[#171513] hover:bg-white transition-all text-xs sm:text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>{currentBanner.ctaText || 'Shop Collection'}</span>
            <ArrowRight className="w-4 h-4 text-[#9A6A45]" />
          </Link>

          <Link
            to="/shop?isNewArrival=true"
            className="inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-[#F7F3EE] transition-all text-xs sm:text-sm font-semibold backdrop-blur-xs"
          >
            <span>New Arrivals</span>
          </Link>
        </div>

        {/* Verified Brand Assurance Badges in Hero */}
        <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-4 sm:gap-6 text-[10px] sm:text-[11px] text-[#A8988B]">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#9A6A45]" />
            <span>Curated Designer Labels</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-[#9A6A45]" />
            <span>Delivery Across India</span>
          </span>
          <span className="flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5 text-[#9A6A45]" />
            <span>7-Day Return Policy</span>
          </span>
        </div>
      </div>

      {/* 3. Slider Controls (Visible when CMS has multiple banners) */}
      {banners.length > 1 && (
        <div className="absolute bottom-5 right-5 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrev}
            className="p-1.5 sm:p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors border border-white/20"
            title="Previous Banner"
            aria-label="Previous Banner"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <div className="flex items-center gap-1.5 px-2">
            {banners.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? 'w-5 sm:w-6 bg-[#9A6A45]' : 'w-2 bg-white/40'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="p-1.5 sm:p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors border border-white/20"
            title="Next Banner"
            aria-label="Next Banner"
          >
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      )}
    </section>
  );
}
