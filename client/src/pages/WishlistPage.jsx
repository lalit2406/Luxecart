import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useWishlist } from '../features/wishlist/context/WishlistContext';
import { useAuth } from '../features/auth/hooks/useAuth';
import {
  Heart,
  Trash2,
  ShoppingBag,
  ArrowRight,
  LogIn,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

export default function WishlistPage() {
  const { items, itemCount, loading, error, removeItem, clearWishlist, moveToCart } = useWishlist();
  const { isAuthenticated } = useAuth();
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [movingId, setMovingId] = useState(null);

  const handleMoveToCart = async (item) => {
    setActionSuccess(null);
    setActionError(null);

    // Identify variant to move: preferred variant or first available variant
    let variantId = item.preferredVariant?.id;
    if (!variantId && item.availableVariants?.length > 0) {
      variantId = item.availableVariants[0].id;
    }

    if (!variantId) {
      setActionError(`Please select a size/color directly on the ${item.name} product page.`);
      return;
    }

    setMovingId(item.productId);
    const res = await moveToCart(item.productId, variantId, 1);
    setMovingId(null);

    if (res.success) {
      setActionSuccess(`"${item.name}" moved to your Shopping Bag.`);
      setTimeout(() => setActionSuccess(null), 4000);
    } else {
      setActionError(res.message || 'Failed to move item to bag');
      setTimeout(() => setActionError(null), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <Navbar />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E7DED5] pb-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B]">
              My Wishlist
            </h1>
            <p className="text-xs text-[#6F6963] mt-1">
              {isAuthenticated ? `${itemCount} saved ${itemCount === 1 ? 'piece' : 'pieces'}` : 'Personal Style Curation'}
            </p>
          </div>

          {isAuthenticated && items.length > 0 && (
            <button
              onClick={clearWishlist}
              className="text-xs font-semibold text-[#6F6963] hover:text-red-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Wishlist</span>
            </button>
          )}
        </div>

        {/* Global Feedback Banners */}
        {actionSuccess && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {(error || actionError) && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error || actionError}</span>
          </div>
        )}

        {/* Guest State: Unauthenticated Prompt */}
        {!isAuthenticated ? (
          <div className="max-w-md mx-auto my-16 p-8 sm:p-12 bg-white border border-[#E7DED5] rounded-3xl text-center space-y-5 shadow-xs">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#F7F3EE] flex items-center justify-center text-[#9A6A45]">
              <Heart className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-serif font-bold text-[#2A211B]">
                Save Your Favorites
              </h2>
              <p className="text-xs text-[#6F6963] leading-relaxed">
                Sign in to your LuxeCart account to curate your personal style wishlist, access saved pieces across all devices, and receive availability updates.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-2xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-xs font-semibold"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to Wishlist</span>
            </Link>
          </div>
        ) : items.length === 0 ? (
          /* Authenticated Empty State */
          <div className="max-w-md mx-auto my-16 p-8 sm:p-12 bg-white border border-[#E7DED5] rounded-3xl text-center space-y-5 shadow-xs">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#F7F3EE] flex items-center justify-center text-[#9A6A45]">
              <Heart className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-serif font-bold text-[#2A211B]">
                Your wishlist is empty
              </h2>
              <p className="text-xs text-[#6F6963] leading-relaxed">
                Explore our fine collections and tap the heart icon on any piece you wish to save for later.
              </p>
            </div>
            <Link
              to="/shop"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-2xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-xs font-semibold"
            >
              <span>Explore Collection</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          /* Wishlist Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item) => {
              const isUnavailable = item.isAvailable === false;
              const hasPreferredVariant = !!item.preferredVariant;
              const preferredInStock = item.preferredVariant?.inStock ?? false;
              const inStock = hasPreferredVariant ? preferredInStock : item.inStock;
              const imageSrc = item.image || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600';

              return (
                <div
                  key={item.productId}
                  className="group bg-white rounded-2xl border border-[#E7DED5] overflow-hidden flex flex-col justify-between hover:shadow-md transition-all"
                >
                  <div>
                    {/* Thumbnail & Quick Remove */}
                    <div className="relative aspect-4/5 w-full bg-[#F7F3EE] overflow-hidden">
                      <Link to={`/products/${item.slug}`}>
                        <img
                          src={imageSrc}
                          alt={item.name}
                          className={`w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ${
                            isUnavailable ? 'grayscale opacity-60' : ''
                          }`}
                        />
                      </Link>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="absolute top-2.5 right-2.5 p-2 rounded-full bg-white/90 text-[#2A211B] hover:text-red-700 hover:bg-white transition-colors shadow-xs cursor-pointer"
                        title="Remove from wishlist"
                        aria-label={`Remove ${item.name} from wishlist`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Badges */}
                      <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                        {item.discountPercent > 0 && (
                          <span className="px-2 py-0.5 rounded-sm bg-[#9A6A45] text-white text-[10px] font-bold uppercase tracking-wider">
                            {item.discountPercent}% OFF
                          </span>
                        )}
                      </div>

                      {!inStock && (
                        <div className="absolute inset-0 bg-[#2A211B]/40 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                          <span className="px-3 py-1 rounded bg-[#2A211B] text-white text-xs font-semibold uppercase tracking-wider">
                            Out of Stock
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Information */}
                    <div className="p-4 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#9A6A45]">
                        {item.brand}
                      </p>
                      <Link
                        to={`/products/${item.slug}`}
                        className="text-sm font-semibold text-[#2A211B] line-clamp-1 hover:text-[#9A6A45] transition-colors"
                      >
                        {item.name}
                      </Link>

                      {/* Preferred Variant Note */}
                      {hasPreferredVariant && (
                        <p className="text-[11px] text-[#6F6963] flex items-center gap-1">
                          <span>Saved:</span>
                          <span className="font-medium text-[#2A211B]">
                            {item.preferredVariant.attributes?.size ? `Size ${item.preferredVariant.attributes.size}` : ''}
                            {item.preferredVariant.attributes?.color?.name ? ` • ${item.preferredVariant.attributes.color.name}` : ''}
                          </span>
                        </p>
                      )}

                      {/* Pricing */}
                      <div className="flex items-baseline gap-2 pt-1">
                        <span className="text-base font-bold text-[#2A211B]">
                          ₹{item.price.toLocaleString('en-IN')}
                        </span>
                        {item.mrp > item.price && (
                          <span className="text-xs text-[#6F6963] line-through">
                            ₹{item.mrp.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Move to Bag Action Button */}
                  <div className="p-4 pt-0">
                    <button
                      onClick={() => handleMoveToCart(item)}
                      disabled={!inStock || isUnavailable || movingId === item.productId}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>{movingId === item.productId ? 'Moving to Bag...' : 'Move to Shopping Bag'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto text-center border-t border-[#E7DED5] py-6 px-4">
        <p className="text-xs text-[#6F6963]">
          LuxeCart &copy; 2026. Single-Vendor Fashion & Lifestyle.
        </p>
      </footer>
    </div>
  );
}
