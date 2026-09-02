import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, ChevronLeft, ChevronRight, Box } from 'lucide-react';
import { isWebGLSupported } from '../../utils/webgl';
import ThreeErrorBoundary from './three/ThreeErrorBoundary';

// Lazy-load the Three.js canvas so initial page load does not parse 3D dependencies synchronously
const LuxuryHeroCanvas = lazy(() => import('./three/LuxuryHeroCanvas'));

export default function HeroBannerSection({ heroBanners = [] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [webglSupported, setWebglSupported] = useState(false);
  const [show3D, setShow3D] = useState(true);

  useEffect(() => {
    setWebglSupported(isWebGLSupported());
  }, []);

  // Default fallback hero if no admin banner configured
  const defaultBanner = {
    title: 'Elevated Fashion & Timeless Lifestyle',
    subtitle: 'Explore curated Indian and international designer apparel, handcrafted leather footwear, and signature lifestyle essentials.',
    imageUrl: '',
    ctaText: 'Browse Full Catalog',
    ctaLink: '/shop',
  };

  const banners = heroBanners.length > 0 ? heroBanners : [defaultBanner];

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const currentBanner = banners[currentIndex] || banners[0];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  };

  return (
    <section
      role="region"
      aria-label="Featured Hero Showcase"
      className="relative rounded-3xl bg-[#2A211B] text-white p-8 sm:p-14 overflow-hidden shadow-lg min-h-[380px] sm:min-h-[440px] flex items-center justify-between"
    >
      {/* 1. Static Background Image with Dark Gradient Overlay (Always available) */}
      {currentBanner.imageUrl && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <picture>
            {currentBanner.mobileImageUrl && (
              <source media="(max-width: 640px)" srcSet={currentBanner.mobileImageUrl} />
            )}
            <img
              src={currentBanner.imageUrl}
              alt={currentBanner.title}
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover object-center opacity-30 transition-opacity duration-700 ease-in-out"
            />
          </picture>
        </div>
      )}

      {/* Gradient vignette protecting text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#171513] via-[#2A211B]/95 to-transparent z-0 pointer-events-none" />

      {/* 2. Interactive 3D Canvas Layer (Lazy-Loaded, Isolated, WebGL-Guarded) */}
      {webglSupported && show3D && (
        <div className="absolute inset-0 lg:left-1/3 z-1 flex items-center justify-center pointer-events-auto opacity-90 transition-opacity duration-1000">
          <ThreeErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <LuxuryHeroCanvas />
            </Suspense>
          </ThreeErrorBoundary>
        </div>
      )}

      {/* 3. Hero Content Overlay (Semantic, High-contrast, Server-authoritative) */}
      <div className="relative z-10 max-w-2xl space-y-4 pointer-events-auto">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#9A6A45]/30 border border-[#9A6A45]/40 text-[#E7DED5] text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-[#9A6A45]" />
            <span>LuxeCart Signature Haute-Horlogerie</span>
          </div>

          {webglSupported && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[11px] text-[#E7DED5] font-mono">
              <Box className="w-3 h-3 text-[#9A6A45]" />
              <span>3D Interactive</span>
            </span>
          )}
        </div>

        <h1 className="text-3xl sm:text-5xl font-serif font-bold tracking-tight leading-tight text-[#F7F3EE]">
          {currentBanner.title}
        </h1>

        {currentBanner.subtitle && (
          <p className="text-sm sm:text-base text-[#E7DED5] max-w-lg leading-relaxed">
            {currentBanner.subtitle}
          </p>
        )}

        <div className="pt-2 flex flex-wrap items-center gap-4">
          <Link
            to={currentBanner.ctaLink || '/shop'}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-[#2A211B] hover:bg-[#F7F3EE] transition-colors text-sm font-semibold shadow-xs"
          >
            <span>{currentBanner.ctaText || 'Browse Collection'}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            to="/shop?isNewArrival=true"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/20 text-white hover:bg-white/10 transition-colors text-sm font-medium"
          >
            <span>New Arrivals</span>
          </Link>
        </div>
      </div>

      {/* 4. Slider Controls (if multiple banners) */}
      {banners.length > 1 && (
        <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2 pointer-events-auto">
          <button
            onClick={handlePrev}
            className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors border border-white/10"
            title="Previous Banner"
            aria-label="Previous Banner"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 px-2">
            {banners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  idx === currentIndex ? 'w-6 bg-[#9A6A45]' : 'w-2 bg-white/40'
                }`}
              />
            ))}
          </div>
          <button
            onClick={handleNext}
            className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors border border-white/10"
            title="Next Banner"
            aria-label="Next Banner"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </section>
  );
}
