import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Layers, Sparkles } from 'lucide-react';
import ProductCard from '../ProductCard';

export default function FeaturedCollectionSection({ featuredCollections = [], fallbackProducts = [] }) {
  // If no dynamic featured collections configured by admin, render fallback products if available
  if (!featuredCollections || featuredCollections.length === 0) {
    if (!fallbackProducts || fallbackProducts.length === 0) return null;

    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-serif font-bold text-[#2A211B]">
              Featured Collections
            </h2>
            <p className="text-xs text-[#705E51]">Hand-picked highlights from our luxury catalog</p>
          </div>
          <Link to="/shop?isFeatured=true" className="text-xs font-semibold text-[#9A6A45] hover:underline flex items-center gap-1">
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {fallbackProducts.map((prod) => (
            <ProductCard key={prod.id || prod._id} product={prod} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-12">
      {featuredCollections.map((col) => {
        const hasProducts = col.targetProducts && col.targetProducts.length > 0;
        const productsToRender = hasProducts ? col.targetProducts : fallbackProducts.slice(0, 4);

        const categoryLink = col.targetCategory
          ? `/shop?category=${col.targetCategory.slug || col.targetCategory.id}`
          : col.ctaLink || '/shop';

        return (
          <section key={col.id || col._id} className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E7DED5] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-serif font-bold text-[#2A211B]">
                    {col.title}
                  </h2>
                  {col.targetCategory && (
                    <span className="px-2 py-0.5 rounded-full bg-[#F7F3EE] border border-[#E7DED5] text-[#9A6A45] text-[10px] font-semibold">
                      {col.targetCategory.name}
                    </span>
                  )}
                </div>
                {col.subtitle && (
                  <p className="text-xs text-[#705E51] mt-0.5">{col.subtitle}</p>
                )}
              </div>

              <Link
                to={categoryLink}
                className="text-xs font-semibold text-[#9A6A45] hover:text-[#2A211B] hover:underline flex items-center gap-1 shrink-0"
              >
                <span>{col.ctaText || 'Explore Collection'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {productsToRender && productsToRender.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                {productsToRender.map((prod) => (
                  <ProductCard key={prod.id || prod._id} product={prod} />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-white rounded-2xl border border-[#E7DED5] text-xs text-[#705E51]">
                <Layers className="w-8 h-8 opacity-40 mx-auto mb-2 text-[#9A6A45]" />
                <p>Curated products are being prepared for this collection.</p>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
