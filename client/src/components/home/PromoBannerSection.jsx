import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Tag } from 'lucide-react';
import { LUXE_PLACEHOLDER_IMAGE } from '../../utils/image';

export default function PromoBannerSection({ promoBanners = [] }) {
  // Verified fallback campaigns featuring actual available catalog products
  const verifiedFallbacks = [
    {
      id: 'promo-aurelia-bag',
      title: 'Aurelia Structured Shoulder Bag',
      subtitle: 'Handcrafted in full-grain leather with tailored structure and brass accents.',
      imageUrl:
        'https://res.cloudinary.com/luxecart-india/image/upload/v1791632732/luxecart/products/aurelia-structured-shoulder-bag/ycztontqcmmgijui1yrv.jpg',
      ctaText: 'Shop Aurelia Bag',
      ctaLink: '/products/aurelia-structured-shoulder-bag',
      badge: 'Curated Leathercraft',
    },
    {
      id: 'promo-vanta-sneakers',
      title: 'Vanta Retro Runner Sneakers',
      subtitle: 'Two-tone paneling and ergonomic cushioning engineered for versatile everyday style.',
      imageUrl:
        'https://res.cloudinary.com/luxecart-india/image/upload/v1791629718/luxecart/products/vanta-retro-runner-sneakers/bntp3g1xmmjwgfrqhwwi.jpg',
      ctaText: 'Shop Vanta Runners',
      ctaLink: '/products/vanta-retro-runner-sneakers',
      badge: 'Footwear Spotlight',
    },
  ];

  // Filter out any unestablished or horology promotions from CMS
  const isHorology = (item) => {
    const text = `${item.title || ''} ${item.subtitle || ''} ${item.ctaLink || ''}`.toLowerCase();
    return text.includes('horology') || text.includes('timepiece') || text.includes('watch');
  };

  const validBanners = (promoBanners || []).filter((b) => !isHorology(b));
  const bannersToRender = validBanners.length > 0 ? validBanners : verifiedFallbacks;

  if (bannersToRender.length === 0) {
    return null;
  }

  const gridCols =
    bannersToRender.length === 1
      ? 'grid-cols-1'
      : 'grid-cols-1 md:grid-cols-2';

  return (
    <section aria-labelledby="promotions-title" className="space-y-4">
      <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[#9A6A45] text-xs font-bold uppercase tracking-wider mb-0.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Seasonal Spotlight</span>
          </div>
          <h2 id="promotions-title" className="text-xl sm:text-2xl font-serif font-bold text-[#2A211B]">
            Curated Collections
          </h2>
        </div>
      </div>

      <div className={`grid ${gridCols} gap-4 sm:gap-6`}>
        {bannersToRender.map((promo) => (
          <div
            key={promo.id || promo._id}
            className="relative rounded-2xl bg-white border border-[#E7DED5] overflow-hidden hover:border-[#9A6A45] hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[220px] sm:min-h-[240px] group"
          >
            {/* High-visibility product imagery - crisp, unwashed, anchored to right */}
            {promo.imageUrl && (
              <div className="absolute right-0 top-0 bottom-0 w-1/2 sm:w-5/12 overflow-hidden pointer-events-none z-0">
                <img
                  src={promo.imageUrl}
                  alt={promo.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = LUXE_PLACEHOLDER_IMAGE;
                  }}
                />
                {/* Soft left feathered blend to card body - product itself stays vibrant and clear */}
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/10 to-transparent pointer-events-none" />
              </div>
            )}

            {/* Gradient backdrop shield for mobile/tablet text clarity */}
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 sm:via-white/80 to-transparent sm:w-3/5 pointer-events-none z-0" />

            {/* Content panel - High contrast text panel on solid luxury background */}
            <div className="relative z-10 max-w-[72%] sm:max-w-[62%] p-5 sm:p-7 flex flex-col justify-between h-full space-y-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F7F3EE] border border-[#E7DED5] text-[#9A6A45] text-[10px] font-bold uppercase tracking-wider">
                  <Tag className="w-3 h-3 text-[#9A6A45]" />
                  <span>{promo.badge || 'Curated Release'}</span>
                </div>

                <h3 className="font-serif font-bold text-lg sm:text-xl text-[#2A211B] group-hover:text-[#9A6A45] transition-colors leading-snug">
                  {promo.title}
                </h3>

                {promo.subtitle && (
                  <p className="text-xs text-[#705E51] leading-relaxed line-clamp-2">
                    {promo.subtitle}
                  </p>
                )}
              </div>

              {promo.ctaLink && (
                <div className="pt-2">
                  <Link
                    to={promo.ctaLink}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A6A45] hover:text-[#2A211B] transition-colors"
                  >
                    <span>{promo.ctaText || 'Shop Collection'}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
