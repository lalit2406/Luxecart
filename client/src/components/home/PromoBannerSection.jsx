import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Tag, Gift, Sparkles } from 'lucide-react';

export default function PromoBannerSection({ promoBanners = [] }) {
  if (!promoBanners || promoBanners.length === 0) {
    return null;
  }

  const gridCols =
    promoBanners.length === 1
      ? 'grid-cols-1'
      : promoBanners.length === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : 'grid-cols-1 md:grid-cols-3';

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif font-bold text-[#2A211B]">
            Exclusive Privileges & Promotions
          </h2>
          <p className="text-xs text-[#705E51]">Limited-time artisanal specials and couture curation</p>
        </div>
      </div>

      <div className={`grid ${gridCols} gap-4 sm:gap-6`}>
        {promoBanners.map((promo) => (
          <div
            key={promo.id || promo._id}
            className="relative rounded-2xl bg-white border border-[#E7DED5] overflow-hidden p-6 hover:border-[#9A6A45] hover:shadow-xs transition-all flex flex-col justify-between group"
          >
            {/* Background image preview if provided */}
            {promo.imageUrl && (
              <div className="absolute inset-0 z-0 overflow-hidden">
                <img
                  src={promo.imageUrl}
                  alt={promo.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover opacity-10 group-hover:opacity-20 transition-opacity duration-300"
                />
              </div>
            )}

            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F7F3EE] border border-[#E7DED5] text-[#9A6A45] text-[10px] font-bold uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-[#9A6A45]" />
                <span>Special Offer</span>
              </div>

              <h3 className="font-serif font-bold text-lg text-[#2A211B] group-hover:text-[#9A6A45] transition-colors">
                {promo.title}
              </h3>

              {promo.subtitle && (
                <p className="text-xs text-[#705E51] leading-relaxed line-clamp-2">
                  {promo.subtitle}
                </p>
              )}
            </div>

            {promo.ctaLink && (
              <div className="relative z-10 pt-4 mt-2 border-t border-[#E7DED5]/60 flex items-center justify-between">
                <Link
                  to={promo.ctaLink}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#9A6A45] hover:text-[#2A211B] transition-colors"
                >
                  <span>{promo.ctaText || 'Explore Privileges'}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
