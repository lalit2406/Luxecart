import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Heart } from 'lucide-react';
import { useWishlist } from '../features/wishlist/context/WishlistContext';
import { useAuth } from '../features/auth/hooks/useAuth';
import { getOptimizedImageUrl, LUXE_PLACEHOLDER_IMAGE } from '../utils/image';
import { useStoreSettings } from '../features/settings/context/useStoreSettings';

export default function ProductCard({ product, priority = false }) {
  let settings = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const context = useStoreSettings();
    settings = context?.settings;
  } catch {
    settings = null;
  }
  const storeName = settings?.storeName || 'LuxeCart';

  const navigate = useNavigate();
  const { addItem, removeItem, isWishlisted } = useWishlist();
  const { isAuthenticated } = useAuth();
  const [isWishlistBusy, setIsWishlistBusy] = useState(false);

  if (!product) return null;

  const productId = product.id || product._id;
  const productUrl = product.slug ? `/products/${product.slug}` : (productId ? `/products/${productId}` : '/shop');

  // 1. Image Resolution and Fallback Handling
  const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0];
  const rawImageUrl = primaryImage?.url || LUXE_PLACEHOLDER_IMAGE;
  const optimizedUrl = getOptimizedImageUrl(rawImageUrl, { width: 600, quality: 'auto:good' });
  const [imgSrc, setImgSrc] = useState(optimizedUrl);

  useEffect(() => {
    setImgSrc(optimizedUrl);
  }, [optimizedUrl]);

  // 2. Pricing and Variant Resolution
  const activeVariants = Array.isArray(product.variants)
    ? product.variants.filter((v) => v.isActive !== false)
    : [];

  let minPrice = 0;
  let minMrp = 0;

  if (activeVariants.length > 0) {
    const sortedVariants = [...activeVariants].sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    const lowestPriceVariant = sortedVariants[0];
    minPrice = typeof lowestPriceVariant.price === 'number' && lowestPriceVariant.price >= 0 ? lowestPriceVariant.price : 0;
    minMrp = typeof lowestPriceVariant.mrp === 'number' && lowestPriceVariant.mrp >= 0
      ? lowestPriceVariant.mrp
      : (typeof product.priceSummary?.minMrp === 'number' && product.priceSummary.minMrp >= 0
          ? product.priceSummary.minMrp
          : minPrice);
  } else {
    minPrice =
      typeof product.priceSummary?.minPrice === 'number' && product.priceSummary.minPrice >= 0
        ? product.priceSummary.minPrice
        : 0;

    minMrp =
      typeof product.priceSummary?.minMrp === 'number' && product.priceSummary.minMrp >= 0
        ? product.priceSummary.minMrp
        : minPrice;
  }

  // Calculate discount percentage directly and strictly from comparable MRP & selling price
  const discountPercent =
    minMrp > minPrice && minPrice > 0
      ? Math.round(((minMrp - minPrice) / minMrp) * 100)
      : 0;

  // Strict verification: only display discount badge & strike-through when MRP is strictly higher than selling price and discount > 0
  const hasValidDiscount = discountPercent > 0 && minMrp > minPrice && minPrice > 0;

  // 3. Stock Availability Resolution
  const hasStockFlag = typeof product.priceSummary?.hasStock === 'boolean'
    ? product.priceSummary.hasStock
    : (typeof product.priceSummary?.totalStock === 'number'
        ? product.priceSummary.totalStock > 0
        : (activeVariants.length > 0
            ? activeVariants.some((v) => (v.inventory?.stock ?? 0) > 0)
            : true));

  const isArchivedOrDraft = product.status && product.status !== 'ACTIVE';
  const isAvailable = hasStockFlag && !isArchivedOrDraft;

  // 4. Verified Badges & Ratings
  const isNew = Boolean(product.isNewArrival);
  const wishlisted = Boolean(productId && isWishlisted(productId));

  const hasValidRating =
    typeof product.ratings?.average === 'number' &&
    product.ratings.average > 0 &&
    product.ratings.average <= 5 &&
    typeof product.ratings?.count === 'number' &&
    product.ratings.count > 0;

  const handleWishlistClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!productId || isWishlistBusy) return;

    if (!isAuthenticated) {
      navigate('/login', { state: { from: productUrl } });
      return;
    }

    try {
      setIsWishlistBusy(true);
      if (wishlisted) {
        await removeItem(productId);
      } else {
        await addItem(productId);
      }
    } catch (err) {
      console.error('Failed to toggle wishlist:', err);
    } finally {
      setIsWishlistBusy(false);
    }
  };

  const imageAlt = primaryImage?.alt || (product.brand ? `${product.brand} - ${product.name}` : product.name) || `${storeName} Curated Product`;

  return (
    <Link
      to={productUrl}
      className="group flex flex-col h-full bg-[#FFFFFF] rounded-xl border border-[#E7DED5] overflow-hidden hover:shadow-md transition-all duration-300 relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] focus-visible:ring-offset-2"
    >
      {/* 1. Image Thumbnail Container with Zero-CLS Aspect Ratio */}
      <div className="relative aspect-[4/5] w-full bg-[#F7F3EE] overflow-hidden shrink-0">
        <img
          src={imgSrc}
          alt={imageAlt}
          className={`w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out ${
            !isAvailable ? 'opacity-75 grayscale-[25%]' : ''
          }`}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          onError={() => {
            if (imgSrc !== LUXE_PLACEHOLDER_IMAGE) {
              setImgSrc(LUXE_PLACEHOLDER_IMAGE);
            }
          }}
        />

        {/* Wishlist Floating Button - Accessible, large touch target, non-propagating */}
        <button
          type="button"
          onClick={handleWishlistClick}
          disabled={isWishlistBusy}
          className={`absolute top-2 right-2 sm:top-2.5 sm:right-2.5 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 backdrop-blur-xs text-[#2A211B] hover:text-[#9A6A45] hover:bg-white transition-all shadow-xs z-10 flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] focus-visible:ring-offset-2 ${
            isWishlistBusy ? 'opacity-60 cursor-not-allowed' : ''
          }`}
          title={wishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}
          aria-label={
            wishlisted
              ? `Remove ${product.name || 'product'} from wishlist`
              : `Save ${product.name || 'product'} to wishlist`
          }
        >
          <Heart
            className={`w-4 h-4 transition-transform ${
              wishlisted ? 'fill-[#9A6A45] text-[#9A6A45] scale-110' : 'hover:scale-110'
            }`}
          />
        </button>

        {/* Verified Badges Overlay */}
        <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 flex flex-col gap-1 z-10 max-w-[65%]">
          {hasValidDiscount && (
            <span className="px-2 py-0.5 rounded-sm bg-[#9A6A45] text-white text-[10px] font-bold uppercase tracking-wider shadow-xs truncate">
              {discountPercent}% OFF
            </span>
          )}
          {isNew && (
            <span className="px-2 py-0.5 rounded-sm bg-[#2A211B] text-white text-[10px] font-bold uppercase tracking-wider shadow-xs truncate">
              NEW
            </span>
          )}
        </div>

        {/* Out of Stock Overlay */}
        {!isAvailable && (
          <div className="absolute inset-0 bg-[#171513]/50 backdrop-blur-[1px] flex items-center justify-center p-2 z-10">
            <span className="px-3 py-1 rounded bg-[#2A211B]/95 border border-[#E7DED5]/40 text-white text-xs font-semibold uppercase tracking-wider shadow-sm text-center">
              Sold Out
            </span>
          </div>
        )}
      </div>

      {/* 2. Product Information - Deliberate vertical layout & alignment */}
      <div className="p-3 sm:p-4 flex flex-col flex-1">
        {/* Brand & Verified Ratings Row */}
        <div className="flex items-center justify-between text-[11px] gap-2 min-h-[16px]">
          <span className="font-semibold uppercase tracking-wider text-[#9A6A45] truncate">
            {product.brand || storeName}
          </span>
          {hasValidRating && (
            <div
              className="flex items-center gap-1 text-[11px] font-medium text-[#705E51] shrink-0"
              aria-label={`Rating ${product.ratings.average.toFixed(1)} out of 5 based on ${product.ratings.count} reviews`}
            >
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              <span className="text-[#2A211B] font-semibold">{product.ratings.average.toFixed(1)}</span>
              <span className="text-[#705E51]">({product.ratings.count})</span>
            </div>
          )}
        </div>

        {/* Product Title Area - Clamped to 2 lines with consistent min-height for uniform row alignment */}
        <h3 className="mt-1 text-sm font-medium text-[#2A211B] line-clamp-2 min-h-[2.5rem] leading-snug group-hover:text-[#9A6A45] transition-colors">
          {product.name}
        </h3>

        {/* Flexible space */}
        <div className="flex-1 min-h-[0.5rem]" />

        {/* Well-padded price row with subtle warm-gray separation */}
        <div className="pt-2.5 border-t border-[#F0EAE1] flex items-baseline flex-wrap gap-x-2 gap-y-0.5">
          <span className="text-sm sm:text-base font-bold text-[#2A211B] shrink-0">
            ₹{minPrice.toLocaleString('en-IN')}
          </span>
          {hasValidDiscount && (
            <span className="text-xs text-[#705E51] line-through shrink-0">
              ₹{minMrp.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
