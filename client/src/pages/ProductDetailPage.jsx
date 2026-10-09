import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { productApi } from '../features/products/api/productApi';
import { reviewApi } from '../features/reviews/api/reviewApi';
import { useCart } from '../features/cart/context/CartContext';
import { useWishlist } from '../features/wishlist/context/WishlistContext';
import { useAuth } from '../features/auth/hooks/useAuth';
import RatingStars from '../components/reviews/RatingStars';
import ReviewSummary from '../components/reviews/ReviewSummary';
import ReviewCard from '../components/reviews/ReviewCard';
import ReviewFormModal from '../components/reviews/ReviewFormModal';
import SEO from '../components/common/SEO';
import { isWebGLSupported } from '../utils/webgl';
import { getOptimizedImageUrl, LUXE_PLACEHOLDER_IMAGE } from '../utils/image';
import ThreeErrorBoundary from '../components/home/three/ThreeErrorBoundary';
import {
  Star,
  ShieldCheck,
  Truck,
  RefreshCw,
  ChevronRight,
  Check,
  Heart,
  ShoppingBag,
  Plus,
  Minus,
  AlertTriangle,
  CheckCircle,
  Filter,
  ArrowUpDown,
  Box,
  Camera,
} from 'lucide-react';

const Product3DViewer = lazy(() => import('../components/product/three/Product3DViewer'));

export default function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { addItem: addToCart, loading: cartLoading } = useCart();
  const { addItem: addToWishlist, removeItem: removeFromWishlist, isWishlisted } = useWishlist();
  const { isAuthenticated, user } = useAuth();

  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [galleryMode, setGalleryMode] = useState('2D');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [cartSuccess, setCartSuccess] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Review states
  const [reviews, setReviews] = useState([]);
  const [reviewBreakdown, setReviewBreakdown] = useState(null);
  const [reviewPagination, setReviewPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [ratingFilter, setRatingFilter] = useState(null);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);

  // Customer review modal states
  const [myReview, setMyReview] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [deletingReview, setDeletingReview] = useState(false);

  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await productApi.getProductBySlug(slug);
      const prod = res?.data?.product;
      setProduct(prod);
      if (prod?.variants?.length > 0) {
        const initialVariant = prod.variants.find((v) => (v.inventory?.stock || 0) > 0) || prod.variants[0];
        setSelectedVariant(initialVariant);
      }
      setSelectedImageIndex(0);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const fetchReviews = useCallback(async (productId, pageNum = 1, filterRating = ratingFilter, sortF = sortBy, sortO = sortOrder) => {
    if (!productId) return;
    try {
      setReviewsLoading(true);
      const params = {
        page: pageNum,
        limit: 10,
        sortBy: sortF,
        sortOrder: sortO,
      };
      if (filterRating) params.rating = filterRating;

      const res = await reviewApi.getReviews(productId, params);
      const data = res?.data?.data || res?.data;
      setReviews(data?.reviews || []);
      setReviewPagination(data?.pagination || { page: 1, pages: 1, total: 0 });
      if (data?.breakdown) {
        setReviewBreakdown(data.breakdown);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setReviewsLoading(false);
    }
  }, [ratingFilter, sortBy, sortOrder]);

  const fetchMyReview = useCallback(async (productId) => {
    if (!productId || !isAuthenticated) {
      setMyReview(null);
      return;
    }
    try {
      const res = await reviewApi.getMyReview(productId);
      const data = res?.data?.data || res?.data;
      setMyReview(data?.review || null);
    } catch (err) {
      // 404 or unauthenticated are safely handled
      setMyReview(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  useEffect(() => {
    if (product?._id) {
      fetchReviews(product._id, page, ratingFilter, sortBy, sortOrder);
      fetchMyReview(product._id);
    }
  }, [product?._id, page, ratingFilter, sortBy, sortOrder, fetchReviews, fetchMyReview]);

  // Active colorway determined by selected variant
  const selectedColorName = selectedVariant?.attributes?.color?.name || '';

  // Filter gallery images to the active colorway.
  // Computed unconditionally to preserve React Hook execution order.
  const colorFilteredImages = React.useMemo(() => {
    if (!product || !product.images || product.images.length === 0) {
      return [{ url: LUXE_PLACEHOLDER_IMAGE, alt: product?.name || 'LuxeCart' }];
    }
    if (selectedColorName) {
      const matchingColorImages = product.images.filter(
        (img) => img.color && img.color.toLowerCase() === selectedColorName.toLowerCase()
      );
      if (matchingColorImages.length > 0) {
        return matchingColorImages;
      }
      // If variant has images directly attached
      if (selectedVariant?.images && selectedVariant.images.length > 0) {
        return selectedVariant.images.map((url, idx) => ({
          url,
          alt: `${product.name} - ${selectedColorName} View ${idx + 1}`,
          color: selectedColorName,
        }));
      }
      // Clean luxury fallback for colors without photography yet
      return [{ url: LUXE_PLACEHOLDER_IMAGE, alt: `${product.name} - ${selectedColorName} (Photography Pending)` }];
    }
    return product.images;
  }, [product, selectedColorName, selectedVariant?.images]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F3EE] flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
          <RefreshCw className="w-8 h-8 text-[#9A6A45] animate-spin" />
          <p className="text-xs text-[#6F6963]">Retrieving luxury piece...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-[#F7F3EE] flex flex-col justify-between">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4 text-center max-w-md mx-auto">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-serif font-bold text-[#2A211B]">Product Unavailable</h2>
          <p className="text-xs text-[#6F6963]">{error || 'The requested product could not be located in our catalog.'}</p>
          <Link
            to="/shop"
            className="px-6 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors"
          >
            Explore Catalog
          </Link>
        </div>
      </div>
    );
  }

  const images = colorFilteredImages;
  const activeImage = images[selectedImageIndex] || images[0];

  const currentPrice = selectedVariant ? selectedVariant.price : (product.priceSummary?.minPrice || 0);
  const currentMrp = selectedVariant ? selectedVariant.mrp : (product.priceSummary?.minMrp || currentPrice);
  const discountPercent = currentMrp > currentPrice
    ? Math.round(((currentMrp - currentPrice) / currentMrp) * 100)
    : 0;

  const currentStock = selectedVariant?.inventory?.stock || 0;
  const isOutOfStock = currentStock <= 0;
  const isLowStock = currentStock > 0 && currentStock <= (selectedVariant?.inventory?.lowStockThreshold || 5);

  const availableColors = Array.from(
    new Set((product.variants || []).map((v) => v.attributes?.color?.name).filter(Boolean))
  ).map((name) => {
    const v = product.variants.find((item) => item.attributes?.color?.name === name);
    return { name, hex: v?.attributes?.color?.hex || '#000000' };
  });

  const availableSizes = Array.from(
    new Set((product.variants || []).map((v) => v.attributes?.size).filter(Boolean))
  );

  const handleColorSelect = (colorName) => {
    const matching = product.variants.find(
      (v) => v.attributes?.color?.name === colorName && (selectedVariant ? v.attributes?.size === selectedVariant.attributes?.size : true)
    ) || product.variants.find((v) => v.attributes?.color?.name === colorName);

    if (matching) {
      setSelectedVariant(matching);
      setQuantity(1);
      // Reset gallery to the primary shot (index 0) of the newly selected colorway
      setSelectedImageIndex(0);
    }
  };

  const handleSizeSelect = (sizeValue) => {
    const matching = product.variants.find(
      (v) => v.attributes?.size === sizeValue && (selectedVariant ? v.attributes?.color?.name === selectedVariant.attributes?.color?.name : true)
    ) || product.variants.find((v) => v.attributes?.size === sizeValue);

    if (matching) {
      setSelectedVariant(matching);
      setQuantity(1);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedVariant || isOutOfStock) return;
    setActionError(null);
    setCartSuccess(false);

    try {
      const primaryImg =
        product.images?.find((img) => img.isPrimary)?.url ||
        product.images?.[0]?.url ||
        '';
      const variantImg = selectedVariant.images?.[0] || primaryImg;

      const variantPrice = typeof selectedVariant.price === 'number' ? selectedVariant.price : 0;
      const variantMrp = typeof selectedVariant.mrp === 'number' ? selectedVariant.mrp : variantPrice;
      const variantDiscount =
        variantMrp > variantPrice
          ? Math.round(((variantMrp - variantPrice) / variantMrp) * 100)
          : 0;

      const metadata = {
        name: product.name,
        slug: product.slug,
        brand: product.brand || 'LuxeCart',
        sku: selectedVariant.sku || 'UNKNOWN',
        image: variantImg,
        price: variantPrice,
        mrp: variantMrp,
        discountPercent: variantDiscount,
        selectedAttributes: {
          color: selectedVariant.attributes?.color || {},
          size: selectedVariant.attributes?.size || '',
          custom: selectedVariant.attributes?.custom || {},
        },
        isAvailable: true,
        availableStock: selectedVariant.inventory?.stock || 0,
      };

      await addToCart(
        product._id,
        selectedVariant.id || selectedVariant._id,
        quantity,
        metadata
      );
      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 5000);
    } catch (err) {
      setActionError(err.message || 'Failed to add item to bag');
    }
  };

  const wishlisted = isWishlisted(product._id, selectedVariant?.id || selectedVariant?._id);

  const handleToggleWishlist = async () => {
    if (!selectedVariant) return;
    setActionError(null);
    setActionMessage(null);

    const variantId = selectedVariant.id || selectedVariant._id;
    if (wishlisted) {
      const res = await removeFromWishlist(product._id, variantId);
      if (res.success) {
        setActionMessage('Removed from your wishlist');
        setTimeout(() => setActionMessage(null), 3000);
      } else {
        setActionError(res.message || 'Failed to update wishlist');
      }
    } else {
      const res = await addToWishlist(product._id, variantId);
      if (res.success) {
        setActionMessage('Saved to your wishlist');
        setTimeout(() => setActionMessage(null), 3000);
      } else {
        setActionError(res.message || 'Failed to save to wishlist');
      }
    }
  };

  // Review actions
  const handleOpenWriteReview = () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleReviewSubmit = async (formData) => {
    setModalLoading(true);
    setModalError(null);

    try {
      if (myReview) {
        await reviewApi.updateMyReview(product._id, formData);
      } else {
        await reviewApi.createReview(product._id, formData);
      }

      setIsModalOpen(false);
      // Refresh reviews, my review, and product rating metrics
      await Promise.all([
        fetchReviews(product._id, 1, ratingFilter, sortBy, sortOrder),
        fetchMyReview(product._id),
        fetchProduct(),
      ]);
    } catch (err) {
      setModalError(err?.response?.data?.message || err?.message || 'Failed to submit review');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!window.confirm('Are you sure you wish to delete your review?')) return;
    setDeletingReview(true);
    try {
      await reviewApi.deleteMyReview(product._id);
      setMyReview(null);
      await Promise.all([
        fetchReviews(product._id, 1, ratingFilter, sortBy, sortOrder),
        fetchProduct(),
      ]);
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to delete review');
    } finally {
      setDeletingReview(false);
    }
  };

  // Structured Data Schema.org Product & BreadcrumbList
  const pdpStructuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description,
      image: images.map((img) => img.url),
      brand: {
        '@type': 'Brand',
        name: product.brand,
      },
      sku: selectedVariant?.sku || product.variants?.[0]?.sku || `SKU-${product._id || product.id}`,
      offers: {
        '@type': 'Offer',
        price: ((selectedVariant?.price ?? product.priceSummary?.minPrice ?? 0) / 100).toFixed(2),
        priceCurrency: 'INR',
        availability: isOutOfStock
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
        url: window.location.href,
        itemCondition: 'https://schema.org/NewCondition',
      },
      ...(product.ratings?.count > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: product.ratings.average,
              reviewCount: product.ratings.count,
            },
          }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://luxecart.com/' },
        { '@type': 'ListItem', position: 2, name: 'Shop', item: 'https://luxecart.com/shop' },
        ...(product.category?.ancestors || []).map((anc, idx) => ({
          '@type': 'ListItem',
          position: 3 + idx,
          name: anc.name,
          item: `https://luxecart.com/shop?category=${anc.slug || anc._id}`,
        })),
        ...(product.category
          ? [
              {
                '@type': 'ListItem',
                position: 3 + (product.category.ancestors?.length || 0),
                name: product.category.name,
                item: `https://luxecart.com/shop?category=${product.category.slug || product.category._id}`,
              },
            ]
          : []),
        {
          '@type': 'ListItem',
          position: 4 + (product.category?.ancestors?.length || 0),
          name: product.name,
          item: `https://luxecart.com/products/${product.slug}`,
        },
      ],
    },
  ];

  const pdpTitle =
    product.seo?.metaTitle || `${product.name} | ${product.brand} — LuxeCart`;
  const pdpDescription =
    product.seo?.metaDescription ||
    product.shortDescription ||
    product.description?.substring(0, 160) ||
    'Luxury handcrafted product at LuxeCart.';

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <SEO
        title={pdpTitle}
        description={pdpDescription}
        canonical={`/products/${product.slug}`}
        image={activeImage?.url}
        type="product"
        structuredData={pdpStructuredData}
      />

      <Navbar />

      <main id="main-content" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs text-[#6F6963] overflow-x-auto">
          <Link to="/" className="hover:text-[#2A211B]">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link to="/shop" className="hover:text-[#2A211B]">Shop</Link>
          {product.category?.ancestors?.map((anc) => (
            <React.Fragment key={anc._id}>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="hover:text-[#2A211B]">{anc.name}</span>
            </React.Fragment>
          ))}
          {product.category && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[#2A211B] font-semibold">{product.category.name}</span>
            </>
          )}
        </nav>

        {/* Global Action Messages */}
        {cartSuccess && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Added to your Shopping Bag successfully!</span>
            </div>
            <Link to="/cart" className="font-bold underline hover:text-emerald-950">
              View Bag →
            </Link>
          </div>
        )}

        {actionMessage && (
          <div className="p-4 rounded-xl bg-[#F7F3EE] border border-[#9A6A45] text-[#2A211B] text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-[#9A6A45] shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {actionError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Product Showcase (Images + Details) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-10 shadow-xs">
          {/* Left Column: Image / 3D Gallery */}
          <div className="lg:col-span-7 space-y-3">
            {/* Mode Switcher: 2D Photos ↔ 3D View (Only when 3D model is configured) */}
            {product?.model3d?.enabled && product?.model3d?.url && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGalleryMode('2D')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    galleryMode === '2D'
                      ? 'bg-[#171513] text-white shadow-xs'
                      : 'bg-[#F7F3EE] text-[#705E51] border border-[#E7DED5] hover:bg-white'
                  }`}
                  aria-label="Return to 2D product photos"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>2D Photos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGalleryMode('3D')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    galleryMode === '3D'
                      ? 'bg-[#171513] text-white shadow-xs'
                      : 'bg-[#F7F3EE] text-[#705E51] border border-[#E7DED5] hover:bg-white'
                  }`}
                  aria-label="View product in 3D"
                >
                  <Box className="w-3.5 h-3.5 text-[#9A6A45]" />
                  <span>3D View</span>
                </button>
              </div>
            )}

            {galleryMode === '3D' && product?.model3d?.enabled && product?.model3d?.url ? (
              <ThreeErrorBoundary
                fallback={
                  <div className="aspect-4/5 rounded-2xl overflow-hidden bg-[#F7F3EE] border border-[#E7DED5] relative flex flex-col items-center justify-center p-6 text-center text-xs text-[#705E51]">
                    <img
                      src={product.model3d?.posterUrl || activeImage.url}
                      alt={product.name}
                      className="w-full h-full object-cover rounded-xl"
                    />
                    <span className="absolute bottom-4 left-4 bg-white/90 px-2.5 py-1 rounded text-[11px] font-semibold border border-[#E7DED5]">
                      3D View Unavailable — Showing Photo
                    </span>
                  </div>
                }
              >
                <Suspense
                  fallback={
                    <div className="w-full h-[380px] sm:h-[480px] rounded-2xl bg-[#F7F3EE] border border-[#E7DED5] flex flex-col items-center justify-center gap-2 text-xs text-[#705E51] animate-pulse">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#9A6A45]" />
                      <span>Loading 3D Product Experience...</span>
                    </div>
                  }
                >
                  <Product3DViewer
                    modelUrl={product.model3d?.url}
                    posterUrl={product.model3d?.posterUrl || activeImage.url}
                    productTitle={product.name}
                    onFallback={() => setGalleryMode('2D')}
                  />
                </Suspense>
              </ThreeErrorBoundary>
            ) : (
              <div className="flex flex-col-reverse sm:flex-row gap-4">
                {/* Thumbnail Switcher */}
                {images.length > 1 && (
                  <div className="flex sm:flex-col gap-2.5 overflow-x-auto sm:overflow-y-auto max-h-[480px]">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`relative w-16 h-20 shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                          selectedImageIndex === idx ? 'border-[#9A6A45]' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={getOptimizedImageUrl(img.url, { width: 160, quality: 'auto:good' })}
                          alt={img.alt || `Thumbnail ${idx + 1}`}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Main Stage Image */}
                <div className="flex-1 aspect-4/5 rounded-2xl overflow-hidden bg-[#F7F3EE] border border-[#E7DED5] relative">
                  <img
                    src={getOptimizedImageUrl(activeImage.url, { width: 1000, quality: 'auto:good' })}
                    alt={activeImage.alt || product.name}
                    className="w-full h-full object-cover object-center"
                    fetchPriority="high"
                    decoding="async"
                  />
                  {discountPercent > 0 && (
                    <div className="absolute top-4 left-4 bg-[#9A6A45] text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-md">
                      {discountPercent}% OFF
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Buying Information */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-2 border-b border-[#E7DED5] pb-5">
              <p className="text-xs font-bold uppercase tracking-widest text-[#9A6A45]">
                {product.brand}
              </p>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B]">
                {product.name}
              </h1>

              {product.ratings?.count > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <RatingStars rating={product.ratings.average} size="sm" showScore={true} />
                  <span className="text-xs text-[#6F6963]">
                    ({product.ratings.count} {product.ratings.count === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              )}
            </div>

            {/* Pricing Section */}
            <div className="space-y-1">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold font-serif text-[#2A211B]">
                  ₹{currentPrice.toLocaleString('en-IN')}
                </span>
                {currentMrp > currentPrice && (
                  <span className="text-base text-[#6F6963] line-through">
                    ₹{currentMrp.toLocaleString('en-IN')}
                  </span>
                )}
                {discountPercent > 0 && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Save {discountPercent}%
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#6F6963]">
                Inclusive of all taxes. Free shipping on all luxury orders.
              </p>
            </div>

            {/* Color Variant Selector */}
            {availableColors.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                  Color: <span className="text-[#2A211B] font-semibold">{selectedVariant?.attributes?.color?.name || 'Default'}</span>
                </label>
                <div className="flex items-center gap-2.5">
                  {availableColors.map(({ name, hex }) => {
                    const isSelected = selectedVariant?.attributes?.color?.name === name;
                    return (
                      <button
                        key={name}
                        onClick={() => handleColorSelect(name)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#9A6A45] bg-[#9A6A45]/10 text-[#2A211B] font-bold shadow-xs'
                            : 'border-[#E7DED5] bg-white text-[#6F6963] hover:border-[#2A211B]'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: hex }} />
                        <span>{name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Variant Selector */}
            {availableSizes.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                  Size: <span className="text-[#2A211B] font-semibold">{selectedVariant?.attributes?.size || 'Standard'}</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {availableSizes.map((size) => {
                    const isSelected = selectedVariant?.attributes?.size === size;
                    return (
                      <button
                        key={size}
                        onClick={() => handleSizeSelect(size)}
                        className={`min-w-10 h-10 px-3 rounded-xl border text-xs font-medium flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#9A6A45] bg-[#2A211B] text-white font-bold shadow-xs'
                            : 'border-[#E7DED5] bg-white text-[#2A211B] hover:border-[#2A211B]'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Selector & Stock Info */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                  Quantity
                </label>
                {isOutOfStock ? (
                  <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                    Out of Stock
                  </span>
                ) : isLowStock ? (
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    Only {currentStock} left in stock
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-emerald-700">
                    In Stock ({currentStock} available)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center border border-[#E7DED5] rounded-xl bg-[#F7F3EE] p-1">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1 || isOutOfStock}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-[#2A211B] transition-colors disabled:opacity-30 cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-10 text-center text-xs font-bold font-mono">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(currentStock, q + 1))}
                    disabled={quantity >= currentStock || isOutOfStock}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-[#2A211B] transition-colors disabled:opacity-30 cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <span className="text-[11px] text-[#6F6963]">
                  SKU: <strong className="font-mono text-[#2A211B]">{selectedVariant?.sku || 'N/A'}</strong>
                </span>
              </div>
            </div>

            {/* Actions: Add to Bag & Wishlist */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-3">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock || cartLoading}
                className="sm:col-span-8 py-3.5 px-6 rounded-2xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-xs font-semibold flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cartLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ShoppingBag className="w-4 h-4" />
                )}
                <span>{isOutOfStock ? 'Currently Unavailable' : 'Add to Shopping Bag'}</span>
              </button>

              <button
                onClick={handleToggleWishlist}
                className={`sm:col-span-4 py-3.5 px-4 rounded-2xl border transition-colors text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer ${
                  wishlisted
                    ? 'border-[#9A6A45] bg-[#9A6A45]/10 text-[#9A6A45]'
                    : 'border-[#E7DED5] bg-white text-[#2A211B] hover:border-[#2A211B]'
                }`}
                title={wishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
                aria-label={wishlisted ? 'Saved to Wishlist' : 'Add to Wishlist'}
              >
                <Heart className={`w-4 h-4 ${wishlisted ? 'fill-[#9A6A45] text-[#9A6A45]' : ''}`} />
                <span>{wishlisted ? 'Saved' : 'Wishlist'}</span>
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#E7DED5] text-xs text-[#6F6963]">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#9A6A45]" />
                <span>Pan-India Cash on Delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#9A6A45]" />
                <span>100% Certified Authentic</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details & Specifications */}
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-10 shadow-xs space-y-6">
          <div className="space-y-3">
            <h2 className="text-xl font-serif font-bold text-[#2A211B]">
              Product Overview & Specifications
            </h2>
            <p className="text-sm text-[#6F6963] leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          </div>

          {product.specifications?.length > 0 && (
            <div className="pt-4 border-t border-[#E7DED5]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#2A211B] mb-3">
                Key Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {product.specifications.map((spec, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#F7F3EE] border border-[#E7DED5] text-xs">
                    <p className="text-[#6F6963] font-medium">{spec.name}</p>
                    <p className="font-semibold text-[#2A211B] mt-0.5">{spec.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Phase 9: Ratings & Customer Reviews Section */}
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-10 shadow-xs space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7DED5] pb-6">
            <div>
              <h2 className="text-xl font-serif font-bold text-[#2A211B]">
                Customer Ratings & Reviews
              </h2>
              <p className="text-xs text-[#6F6963] mt-0.5">
                Authentic impressions from verified LuxeCart buyers
              </p>
            </div>
          </div>

          {/* Rating Summary Card */}
          <ReviewSummary
            breakdown={reviewBreakdown || { average: product.ratings?.average || 0, count: product.ratings?.count || 0 }}
            onWriteReview={handleOpenWriteReview}
            hasReviewed={Boolean(myReview)}
            isLoggedIn={isAuthenticated}
            selectedRatingFilter={ratingFilter}
            onFilterRating={(val) => {
              setRatingFilter(val);
              setPage(1);
            }}
          />

          {/* Customer's Own Review (if exists) */}
          {myReview && (
            <div className="space-y-3 p-5 rounded-3xl bg-[#F7F3EE] border border-[#9A6A45]/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#9A6A45] uppercase tracking-wider">
                  Your Review on Record
                </span>
              </div>
              <ReviewCard
                review={myReview}
                isOwner={true}
                onEdit={handleOpenWriteReview}
                onDelete={handleDeleteReview}
                deleting={deletingReview}
              />
            </div>
          )}

          {/* Review Filter & Sort Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-b border-[#E7DED5] pb-4">
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-4 h-4 text-[#9A6A45]" />
              <span className="font-bold text-[#2A211B]">Filter:</span>
              <button
                onClick={() => {
                  setRatingFilter(null);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  ratingFilter === null
                    ? 'bg-[#2A211B] text-white'
                    : 'bg-[#F7F3EE] text-[#6F6963] hover:bg-[#E7DED5]'
                }`}
              >
                All Stars
              </button>
              {[5, 4, 3, 2, 1].map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRatingFilter(ratingFilter === r ? null : r);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    ratingFilter === r
                      ? 'bg-[#9A6A45] text-white'
                      : 'bg-[#F7F3EE] text-[#6F6963] hover:bg-[#E7DED5]'
                  }`}
                >
                  {r} ★
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#6F6963]" />
              <span className="text-[#6F6963]">Sort by:</span>
              <select
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [f, o] = e.target.value.split(':');
                  setSortBy(f);
                  setSortOrder(o);
                  setPage(1);
                }}
                className="px-3 py-1.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] text-xs text-[#2A211B] focus:outline-hidden focus:border-[#9A6A45]"
              >
                <option value="createdAt:desc">Newest First</option>
                <option value="createdAt:asc">Oldest First</option>
                <option value="rating:desc">Highest Rating</option>
                <option value="rating:asc">Lowest Rating</option>
              </select>
            </div>
          </div>

          {/* Reviews List */}
          {reviewsLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-6 h-6 text-[#9A6A45] animate-spin" />
              <p className="text-xs text-[#6F6963]">Loading customer feedback...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-12 text-center space-y-3 border border-dashed border-[#E7DED5] rounded-3xl">
              <div className="w-10 h-10 rounded-full bg-[#F7F3EE] text-[#9A6A45] flex items-center justify-center mx-auto">
                <Star className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-[#2A211B]">No Reviews Found</h4>
              <p className="text-xs text-[#6F6963] max-w-sm mx-auto">
                {ratingFilter
                  ? `There are currently no ${ratingFilter}-star reviews for this piece.`
                  : 'Be the first connoisseur to share an impression of this exquisite creation.'}
              </p>
              <button
                onClick={handleOpenWriteReview}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors"
              >
                Write a Review
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev) => (
                <ReviewCard
                  key={rev._id || rev.id}
                  review={rev}
                  isOwner={Boolean(user && (rev.customer?.id === user.id || rev.userId === user.id))}
                  onEdit={handleOpenWriteReview}
                  onDelete={handleDeleteReview}
                  deleting={deletingReview}
                />
              ))}

              {/* Pagination Controls */}
              {reviewPagination.pages > 1 && (
                <div className="flex items-center justify-between pt-6 border-t border-[#E7DED5] text-xs">
                  <span className="text-[#6F6963]">
                    Showing Page {reviewPagination.page} of {reviewPagination.pages} ({reviewPagination.total} reviews)
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] hover:bg-white disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(reviewPagination.pages, p + 1))}
                      disabled={page >= reviewPagination.pages}
                      className="px-3 py-1.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] hover:bg-white disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Review Form Modal */}
      <ReviewFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleReviewSubmit}
        initialData={myReview}
        loading={modalLoading}
        isEdit={Boolean(myReview)}
        error={modalError}
      />

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto text-center border-t border-[#E7DED5] py-6 px-4">
        <p className="text-xs text-[#6F6963]">
          LuxeCart &copy; 2026. Single-Vendor Fashion & Lifestyle.
        </p>
      </footer>
    </div>
  );
}
