import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import SEO from '../components/common/SEO';
import PortfolioFooter from '../components/common/PortfolioFooter';
import {
  buildShopBreadcrumbs,
  findActiveCategoryInTree,
  formatShopHeading,
} from '../features/settings/utils/seoUtils';
import { useStoreSettings } from '../features/settings/context/useStoreSettings';
import { productApi } from '../features/products/api/productApi';
import { categoryApi } from '../features/categories/api/categoryApi';
import { Filter, Search, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  let settings = null;
  try {
    const settingsContext = useStoreSettings();
    settings = settingsContext?.settings;
  } catch {
    settings = null;
  }
  const storeName = settings?.storeName || 'LuxeCart';

  // Derived filter state directly from URL search parameters (Single Source of Truth)
  const currentCategory = searchParams.get('category') || '';
  const currentGender = searchParams.get('gender') || '';
  const currentSort = searchParams.get('sort') || 'newest';
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const currentSearch = searchParams.get('search') || '';
  const currentInStock = searchParams.get('inStock') === 'true';
  const currentIsNewArrival = searchParams.get('isNewArrival') === 'true';
  const currentIsFeatured = searchParams.get('isFeatured') === 'true';
  const currentMinPrice = searchParams.get('minPrice') || '';
  const currentMaxPrice = searchParams.get('maxPrice') || '';

  // Local inputs for smooth typing before debounced URL update
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [minPriceInput, setMinPriceInput] = useState(currentMinPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(currentMaxPrice);

  const gridContainerRef = useRef(null);
  const isInitialMount = useRef(true);

  // Smooth scroll to product grid when pagination page changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (gridContainerRef.current) {
      gridContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage]);

  // Sync local inputs when URL parameters change externally (e.g. Back/Forward navigation)
  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    setMinPriceInput(currentMinPrice);
  }, [currentMinPrice]);

  useEffect(() => {
    setMaxPriceInput(currentMaxPrice);
  }, [currentMaxPrice]);

  // Generic URL filter update helper: sets or deletes parameters
  const updateFilters = useCallback(
    (updates) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, val]) => {
          if (val === undefined || val === null || val === '' || val === false) {
            next.delete(key);
          } else {
            next.set(key, String(val));
          }
        });
        return next;
      });
    },
    [setSearchParams]
  );

  // Debounced search query synchronization with URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed !== currentSearch) {
        updateFilters({ search: trimmed, page: 1 });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, currentSearch, updateFilters]);

  // Debounced price range synchronization with URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const minTrim = minPriceInput.trim();
      const maxTrim = maxPriceInput.trim();
      if (minTrim !== currentMinPrice || maxTrim !== currentMaxPrice) {
        updateFilters({ minPrice: minTrim, maxPrice: maxTrim, page: 1 });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [minPriceInput, maxPriceInput, currentMinPrice, currentMaxPrice, updateFilters]);

  // Fetch Category Tree once on mount
  useEffect(() => {
    categoryApi
      .getCategories()
      .then((res) => setCategories(res?.data?.categories || []))
      .catch(() => {});
  }, []);

  // Fetch Catalog Products based strictly on searchParams (single source of truth)
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        limit: 12,
        sort: currentSort,
      };

      if (currentCategory) params.category = currentCategory;
      if (currentGender) params.gender = currentGender;
      if (currentSearch) params.search = currentSearch;
      if (currentIsNewArrival) params.isNewArrival = 'true';
      if (currentIsFeatured) params.isFeatured = 'true';
      if (currentInStock) params.inStock = 'true';
      if (currentMinPrice) params.minPrice = currentMinPrice;
      if (currentMaxPrice) params.maxPrice = currentMaxPrice;

      const res = await productApi.getProducts(params);
      setProducts(res?.data || []);
      if (res?.meta?.pagination) {
        setPagination(res.meta.pagination);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load catalog products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    currentSort,
    currentCategory,
    currentGender,
    currentSearch,
    currentIsNewArrival,
    currentIsFeatured,
    currentInStock,
    currentMinPrice,
    currentMaxPrice,
  ]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleResetFilters = () => {
    setSearchInput('');
    setMinPriceInput('');
    setMaxPriceInput('');
    setSearchParams({});
  };

  // Find active category object recursively across all tree levels (matches by ObjectId or slug)
  const activeCategoryObj = useMemo(() => {
    return findActiveCategoryInTree(categories, currentCategory);
  }, [categories, currentCategory]);

  const shopTitle = activeCategoryObj
    ? `${activeCategoryObj.name} Collection | ${storeName}`
    : currentSearch
    ? `Search: "${currentSearch}" | ${storeName}`
    : `Shop Luxury Designer Collection | ${storeName}`;

  const shopDescription = activeCategoryObj?.description
    ? activeCategoryObj.description
    : settings?.seo?.metaDescription ||
      `Discover handcrafted luxury apparel, artisanal footwear, cosmetics, and lifestyle essentials at ${storeName}.`;

  const { items: shopBreadcrumbs, jsonLd: shopStructuredData } = useMemo(
    () => buildShopBreadcrumbs(categories, currentCategory),
    [categories, currentCategory]
  );
  const { heading: shopHeading, subtitle: shopSubtitle } = formatShopHeading({
    activeCategory: activeCategoryObj,
    categoryParam: currentCategory,
    search: currentSearch,
    gender: currentGender,
    isNewArrival: currentIsNewArrival,
    isFeatured: currentIsFeatured,
  });

  const canonicalCategorySlug = activeCategoryObj ? activeCategoryObj.slug || currentCategory : '';

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <SEO
        title={shopTitle}
        description={shopDescription}
        keywords={settings?.seo?.keywords}
        canonical={canonicalCategorySlug ? `/shop?category=${encodeURIComponent(canonicalCategorySlug)}` : '/shop'}
        structuredData={shopStructuredData}
      />

      <Navbar />

      <main id="main-content" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Visible Accessible Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-[#6F6963] overflow-x-auto pb-4"
        >
          {shopBreadcrumbs.map((crumb, idx) => {
            const isLast = idx === shopBreadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.to}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0 text-[#B3A89D]" aria-hidden="true" />}
                {isLast ? (
                  <span aria-current="page" className="text-[#2A211B] font-semibold truncate">
                    {crumb.label}
                  </span>
                ) : (
                  <Link to={crumb.to} className="hover:text-[#2A211B] transition-colors shrink-0">
                    {crumb.label}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>

        {/* Header Title & Search Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E7DED5] pb-6 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B]">
              {shopHeading}
            </h1>
            <p className="text-xs sm:text-sm text-[#6F6963] mt-1">
              {shopSubtitle}
            </p>
          </div>

          {/* Search bar & Sort Controls */}
          <div className="flex items-center gap-3">
            {/* Search bar with inline clear button */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-[#6F6963] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products, brands..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className={`w-full pl-9 ${searchInput ? 'pr-8' : 'pr-3'} py-2 rounded-xl bg-white border border-[#E7DED5] text-xs focus:outline-none focus:border-[#9A6A45]`}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    updateFilters({ search: '', page: 1 });
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#6F6963] hover:text-[#2A211B] rounded-full hover:bg-[#F7F3EE] transition-colors cursor-pointer"
                  title="Clear search input"
                  aria-label="Clear search input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={currentSort}
              onChange={(e) => updateFilters({ sort: e.target.value, page: 1 })}
              className="px-3 py-2 rounded-xl bg-white border border-[#E7DED5] text-xs font-medium text-[#2A211B] focus:outline-none focus:border-[#9A6A45] cursor-pointer"
            >
              <option value="newest">Newest Arrivals</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Top Rated</option>
              <option value="discount">Biggest Discount</option>
            </select>

            <button
              onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
              className="md:hidden p-2 rounded-xl bg-white border border-[#E7DED5] text-[#2A211B] cursor-pointer"
              aria-label="Toggle Catalog Filters"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Layout (Sidebar Filters + Product Grid) */}
        <div className="flex gap-8 items-start">
          {/* Desktop Filter Sidebar */}
          <aside
            className={`w-64 shrink-0 bg-white border border-[#E7DED5] rounded-2xl p-5 space-y-6 ${
              mobileFilterOpen ? 'fixed inset-4 z-50 overflow-y-auto block shadow-2xl' : 'hidden md:block'
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#9A6A45]" />
                <h2 className="font-semibold text-sm text-[#2A211B]">Filters</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetFilters}
                  className="text-[11px] font-semibold text-[#9A6A45] hover:underline cursor-pointer"
                >
                  Reset
                </button>
                {mobileFilterOpen && (
                  <button onClick={() => setMobileFilterOpen(false)} className="md:hidden p-1 cursor-pointer">
                    <X className="w-4 h-4 text-[#6F6963]" />
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">Categories</h3>
              <div className="space-y-1 text-xs">
                <button
                  onClick={() => updateFilters({ category: '', page: 1 })}
                  className={`w-full text-left px-2 py-1 rounded-md transition-colors cursor-pointer ${
                    !currentCategory
                      ? 'bg-[#F7F3EE] font-bold text-[#2A211B]'
                      : 'text-[#6F6963] hover:text-[#2A211B]'
                  }`}
                >
                  All Categories
                </button>
                {categories.map((cat) => {
                  const isCatActive =
                    currentCategory === cat.slug ||
                    currentCategory === cat.id ||
                    currentCategory === cat._id;

                  return (
                    <div key={cat.id || cat._id} className="space-y-1">
                      <button
                        onClick={() => updateFilters({ category: cat.slug || cat.id, page: 1 })}
                        className={`w-full text-left px-2 py-1 rounded-md transition-colors cursor-pointer ${
                          isCatActive
                            ? 'bg-[#F7F3EE] font-bold text-[#2A211B]'
                            : 'text-[#6F6963] hover:text-[#2A211B]'
                        }`}
                      >
                        {cat.name}
                      </button>
                      {cat.children && cat.children.length > 0 && (
                        <div className="pl-3 space-y-1">
                          {cat.children.map((sub) => {
                            const isSubActive =
                              currentCategory === sub.slug ||
                              currentCategory === sub.id ||
                              currentCategory === sub._id;

                            return (
                              <button
                                key={sub.id || sub._id}
                                onClick={() => updateFilters({ category: sub.slug || sub.id, page: 1 })}
                                className={`w-full text-left px-2 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                                  isSubActive
                                    ? 'bg-[#F7F3EE] font-bold text-[#2A211B]'
                                    : 'text-[#6F6963] hover:text-[#2A211B]'
                                }`}
                              >
                                • {sub.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gender Filter */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">Department</h3>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {['', 'MEN', 'WOMEN', 'UNISEX'].map((g) => (
                  <button
                    key={g || 'ALL'}
                    onClick={() => updateFilters({ gender: g, page: 1 })}
                    className={`px-2.5 py-1.5 rounded-lg border text-center font-medium transition-colors cursor-pointer ${
                      currentGender === g
                        ? 'bg-[#2A211B] text-white border-[#2A211B]'
                        : 'bg-[#F7F3EE] text-[#6F6963] border-[#E7DED5] hover:border-[#2A211B]'
                    }`}
                  >
                    {g || 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Filter */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">Price Range (₹)</h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={minPriceInput}
                  onChange={(e) => setMinPriceInput(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-[#E7DED5] bg-[#F7F3EE] text-xs"
                />
                <span className="text-[#6F6963]">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPriceInput}
                  onChange={(e) => setMaxPriceInput(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-[#E7DED5] bg-[#F7F3EE] text-xs"
                />
              </div>
            </div>

            {/* Availability */}
            <div className="pt-2 border-t border-[#E7DED5]">
              <label className="flex items-center gap-2 text-xs font-medium text-[#2A211B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentInStock}
                  onChange={(e) => updateFilters({ inStock: e.target.checked ? 'true' : '', page: 1 })}
                  className="rounded border-[#E7DED5] text-[#9A6A45] focus:ring-[#9A6A45]"
                />
                <span>In Stock Only</span>
              </label>
            </div>
          </aside>

          {/* Product Grid Area */}
          <div ref={gridContainerRef} className="flex-1 scroll-mt-24">
            {/* Active Search Indicator Chip */}
            {currentSearch && (
              <div className="mb-4 flex flex-wrap items-center gap-2 p-2.5 px-3.5 bg-white border border-[#E7DED5] rounded-xl text-xs shadow-2xs">
                <span className="text-[#6F6963]">Results for:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F3EE] border border-[#E7DED5] text-[#2A211B] font-semibold">
                  <span>"{currentSearch}"</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      updateFilters({ search: '', page: 1 });
                    }}
                    className="p-0.5 hover:text-red-700 hover:bg-[#E7DED5]/60 rounded-full transition-colors cursor-pointer"
                    title="Clear search query"
                    aria-label="Clear search query"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    updateFilters({ search: '', page: 1 });
                  }}
                  className="text-[11px] font-semibold text-[#9A6A45] hover:underline ml-auto cursor-pointer"
                >
                  Clear Search
                </button>
              </div>
            )}

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 text-[#9A6A45] animate-spin" />
                <p className="text-xs text-[#6F6963]">Loading products...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-[#E7DED5] space-y-3">
                <p className="text-sm font-semibold text-red-600">{error}</p>
                <button
                  onClick={handleResetFilters}
                  className="px-4 py-2 rounded-xl bg-[#2A211B] text-white text-xs font-medium cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-[#E7DED5] space-y-4">
                <h3 className="text-lg font-serif font-bold text-[#2A211B]">
                  {currentSearch
                    ? `No products found matching "${currentSearch}"`
                    : 'No products found'}
                </h3>
                <p className="text-xs text-[#6F6963]">
                  {currentSearch
                    ? 'Check your spelling or try searching for another style, brand, or department.'
                    : 'Try adjusting your search criteria or resetting filters.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  {currentSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput('');
                        updateFilters({ search: '', page: 1 });
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2A211B] text-white text-xs font-semibold hover:bg-[#9A6A45] transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Clear Search</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F7F3EE] border border-[#E7DED5] text-[#2A211B] text-xs font-semibold hover:bg-[#E7DED5] transition-colors cursor-pointer"
                  >
                    <span>Reset All Filters</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Product Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {products.map((product, index) => (
                    <ProductCard key={product.id || product._id} product={product} priority={index < 4} />
                  ))}
                </div>

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-[#E7DED5] pt-6">
                    <p className="text-xs text-[#6F6963]">
                      Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total items)
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateFilters({ page: pagination.page - 1 })}
                        disabled={!pagination.hasPreviousPage}
                        className="p-2 rounded-lg border border-[#E7DED5] bg-white text-[#2A211B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F7F3EE] transition-colors cursor-pointer"
                        aria-label="Previous Page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => updateFilters({ page: pagination.page + 1 })}
                        disabled={!pagination.hasNextPage}
                        className="p-2 rounded-lg border border-[#E7DED5] bg-white text-[#2A211B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F7F3EE] transition-colors cursor-pointer"
                        aria-label="Next Page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <PortfolioFooter />
    </div>
  );
}
