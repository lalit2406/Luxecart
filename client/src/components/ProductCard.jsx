import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Heart } from 'lucide-react';
import { useWishlist } from '../features/wishlist/context/WishlistContext';
import { useAuth } from '../features/auth/hooks/useAuth';
import { getOptimizedImageUrl, LUXE_PLACEHOLDER_IMAGE } from '../utils/image';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { addItem, removeItem, isWishlisted } = useWishlist();
  const { isAuthenticated } = useAuth();

  const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0];
  const rawImageUrl = primaryImage?.url || LUXE_PLACEHOLDER_IMAGE;
  const imageUrl = getOptimizedImageUrl(rawImageUrl, { width: 600, quality: 'auto:good' });

  const minPrice = product.priceSummary?.minPrice || 0;
  const minMrp = product.priceSummary?.minMrp || minPrice;
  const discountPercent = product.priceSummary?.maxDiscountPercent || 0;
  const inStock = product.priceSummary?.hasStock;
  const wishlisted = isWishlisted(product._id);

  const handleWishlistClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (wishlisted) {
      await removeItem(product._id);
    } else {
      await addItem(product._id);
    }
  };

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group block bg-[#FFFFFF] rounded-xl border border-[#E7DED5] overflow-hidden hover:shadow-md transition-all duration-300 relative"
    >
      {/* Image Thumbnail Container */}
      <div className="relative aspect-4/5 w-full bg-[#F7F3EE] overflow-hidden">
        <img
          src={imageUrl}
          alt={primaryImage?.alt || product.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          decoding="async"
        />

        {/* Wishlist Floating Button */}
        <button
          onClick={handleWishlistClick}
          className="absolute top-2.5 right-2.5 p-2 rounded-full bg-white/90 text-[#2A211B] hover:text-[#9A6A45] hover:bg-white transition-colors shadow-xs z-10 cursor-pointer"
          title={wishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
        >
          <Heart className={`w-4 h-4 ${wishlisted ? 'fill-[#9A6A45] text-[#9A6A45]' : ''}`} />
        </button>

        {/* Badges Overlay */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {discountPercent > 0 && (
            <span className="px-2 py-0.5 rounded-sm bg-[#9A6A45] text-white text-[10px] font-bold uppercase tracking-wider">
              {discountPercent}% OFF
            </span>
          )}
          {product.isNewArrival && (
            <span className="px-2 py-0.5 rounded-sm bg-[#2A211B] text-white text-[10px] font-bold uppercase tracking-wider">
              NEW
            </span>
          )}
        </div>

        {!inStock && (
          <div className="absolute inset-0 bg-[#2A211B]/40 backdrop-blur-[2px] flex items-center justify-center">
            <span className="px-3 py-1 rounded bg-[#2A211B] text-white text-xs font-semibold uppercase tracking-wider">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Product Information */}
      <div className="p-4 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-[#6F6963]">
          <span className="font-semibold uppercase tracking-wider text-[#9A6A45]">
            {product.brand}
          </span>
          {product.ratings?.count > 0 && (
            <div className="flex items-center gap-0.5 text-amber-600 font-medium">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              <span>{product.ratings.average.toFixed(1)}</span>
            </div>
          )}
        </div>

        <h3 className="text-sm font-medium text-[#2A211B] line-clamp-1 group-hover:text-[#9A6A45] transition-colors">
          {product.name}
        </h3>

        {/* Pricing Matrix */}
        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-base font-bold text-[#2A211B]">
            ₹{minPrice.toLocaleString('en-IN')}
          </span>
          {minMrp > minPrice && (
            <span className="text-xs text-[#6F6963] line-through">
              ₹{minMrp.toLocaleString('en-IN')}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
