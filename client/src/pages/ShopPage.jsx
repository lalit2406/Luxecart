import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import SEO from '../components/common/SEO';
import { productApi } from '../features/products/api/productApi';
import { categoryApi } from '../features/categories/api/categoryApi';
import { Filter, Search, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';

export default function ShopPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const [selectedSort, setSelectedSort] = useState('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Category Tree
  useEffect(() => {
    categoryApi.getCategories()
      .then((res) => setCategories(res?.data?.categories || []))
      .catch(() => {});
  }, []);

  // Fetch Products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pagination.page,
        limit: 12,
        sort: selectedSort,
      };

      if (selectedCategory) params.category = selectedCategory;
      if (selectedGender) params.gender = selectedGender;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (inStockOnly) params.inStock = 'true';
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await productApi.getProducts(params);
      setProducts(res?.data || []);
      if (res?.meta?.pagination) {
        setPagination(res.meta.pagination);
      }
    } catch (err) {
      setError(err.message || 'Failed to load catalog products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, selectedSort, selectedCategory, selectedGender, minPrice, maxPrice, inStockOnly, debouncedSearch]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleResetFilters = () => {
    setSelectedCategory('');
    setSelectedGender('');
    setMinPrice('');
    setMaxPrice('');
    setInStockOnly(false);
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedSort('newest');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const activeCategoryObj = categories.find((c) => (c.id || c._id) === selectedCategory);
  const shopTitle = activeCategoryObj
    ? `${activeCategoryObj.name} Collection | LuxeCart`
    : debouncedSearch
    ? `Search: "${debouncedSearch}" | LuxeCart`
    : 'Shop Luxury Designer Collection | LuxeCart';

  const shopDescription = activeCategoryObj?.description
    ? activeCategoryObj.description
    : 'Discover haute couture, designer apparel, luxury timepieces, and lifestyle essentials at LuxeCart.';

  const shopStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://luxecart.com/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Shop',
        item: 'https://luxecart.com/shop',
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <SEO
        title={shopTitle}
        description={shopDescription}
        canonical={selectedCategory ? `/shop?category=${selectedCategory}` : '/shop'}
        structuredData={shopStructuredData}
      />

      <Navbar />

      <main id="main-content" className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Header Title & Search Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E7DED5] pb-6 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B]">
              Fashion & Lifestyle Catalog
            </h1>
            <p className="text-xs sm:text-sm text-[#6F6963] mt-1">
              Curated luxury apparel, footwear, accessories, and beauty collections
            </p>
          </div>

          {/* Search bar & Sort Controls */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-[#6F6963] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products, brands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-[#E7DED5] text-xs focus:outline-none focus:border-[#9A6A45]"
              />
            </div>

            <select
              value={selectedSort}
              onChange={(e) => {
                setSelectedSort(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="px-3 py-2 rounded-xl bg-white border border-[#E7DED5] text-xs font-medium text-[#2A211B] focus:outline-none focus:border-[#9A6A45]"
            >
              <option value="newest">Newest Arrivals</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Top Rated</option>
              <option value="discount">Biggest Discount</option>
            </select>

            <button
              onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
              className="md:hidden p-2 rounded-xl bg-white border border-[#E7DED5] text-[#2A211B]"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Layout (Sidebar Filters + Product Grid) */}
        <div className="flex gap-8 items-start">
          {/* Desktop Filter Sidebar */}
          <aside className={`w-64 shrink-0 bg-white border border-[#E7DED5] rounded-2xl p-5 space-y-6 ${
            mobileFilterOpen ? 'fixed inset-4 z-50 overflow-y-auto block shadow-2xl' : 'hidden md:block'
          }`}>
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
                  <button onClick={() => setMobileFilterOpen(false)} className="md:hidden p-1">
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
                  onClick={() => {
                    setSelectedCategory('');
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className={`w-full text-left px-2 py-1 rounded-md transition-colors cursor-pointer ${
                    !selectedCategory ? 'bg-[#F7F3EE] font-bold text-[#2A211B]' : 'text-[#6F6963] hover:text-[#2A211B]'
                  }`}
                >
                  All Categories
                </button>
                {categories.map((cat) => (
                  <div key={cat.id} className="space-y-1">
                    <button
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setPagination((prev) => ({ ...prev, page: 1 }));
                      }}
                      className={`w-full text-left px-2 py-1 rounded-md transition-colors cursor-pointer ${
                        selectedCategory === cat.id ? 'bg-[#F7F3EE] font-bold text-[#2A211B]' : 'text-[#6F6963] hover:text-[#2A211B]'
                      }`}
                    >
                      {cat.name}
                    </button>
                    {cat.children && cat.children.length > 0 && (
                      <div className="pl-3 space-y-1">
                        {cat.children.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => {
                              setSelectedCategory(sub.id);
                              setPagination((prev) => ({ ...prev, page: 1 }));
                            }}
                            className={`w-full text-left px-2 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                              selectedCategory === sub.id ? 'bg-[#F7F3EE] font-bold text-[#2A211B]' : 'text-[#6F6963] hover:text-[#2A211B]'
                            }`}
                          >
                            • {sub.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Gender Filter */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">Department</h3>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {['', 'MEN', 'WOMEN', 'UNISEX'].map((g) => (
                  <button
                    key={g || 'ALL'}
                    onClick={() => {
                      setSelectedGender(g);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-center font-medium transition-colors cursor-pointer ${
                      selectedGender === g
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
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-[#E7DED5] bg-[#F7F3EE] text-xs"
                />
                <span className="text-[#6F6963]">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-[#E7DED5] bg-[#F7F3EE] text-xs"
                />
              </div>
            </div>

            {/* Availability */}
            <div className="pt-2 border-t border-[#E7DED5]">
              <label className="flex items-center gap-2 text-xs font-medium text-[#2A211B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => {
                    setInStockOnly(e.target.checked);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  className="rounded border-[#E7DED5] text-[#9A6A45] focus:ring-[#9A6A45]"
                />
                <span>In Stock Only</span>
              </label>
            </div>
          </aside>

          {/* Product Grid Area */}
          <div className="flex-1">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 text-[#9A6A45] animate-spin" />
                <p className="text-xs text-[#6F6963]">Loading products...</p>
              </div>
            ) : error ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-[#E7DED5] space-y-3">
                <p className="text-sm font-semibold text-red-600">{error}</p>
                <button
                  onClick={fetchProducts}
                  className="px-4 py-2 rounded-xl bg-[#2A211B] text-white text-xs font-medium"
                >
                  Retry
                </button>
              </div>
            ) : products.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-[#E7DED5] space-y-4">
                <h3 className="text-lg font-serif font-bold text-[#2A211B]">No products found</h3>
                <p className="text-xs text-[#6F6963]">
                  Try adjusting your search criteria or resetting filters.
                </p>
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2A211B] text-white text-xs font-semibold hover:bg-[#9A6A45] transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Product Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
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
                        onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                        disabled={!pagination.hasPreviousPage}
                        className="p-2 rounded-lg border border-[#E7DED5] bg-white text-[#2A211B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F7F3EE] transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                        disabled={!pagination.hasNextPage}
                        className="p-2 rounded-lg border border-[#E7DED5] bg-white text-[#2A211B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F7F3EE] transition-colors cursor-pointer"
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

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto text-center border-t border-[#E7DED5] py-6 px-4">
        <p className="text-xs text-[#6F6963]">
          LuxeCart &copy; 2026. Single-Vendor Fashion & Lifestyle E-Commerce.
        </p>
      </footer>
    </div>
  );
}
