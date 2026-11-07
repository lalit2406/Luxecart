import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, X, Loader2, ArrowRight, Tag } from 'lucide-react';
import { productApi } from '../../features/products/api/productApi';
import { getOptimizedImageUrl, LUXE_PLACEHOLDER_IMAGE } from '../../utils/image';

/**
 * Resolves selling price from priceSummary or variants
 */
function resolveProductPrice(product) {
  if (typeof product.priceSummary?.minPrice === 'number' && product.priceSummary.minPrice > 0) {
    return product.priceSummary.minPrice;
  }
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const prices = product.variants
      .map((v) => Number(v.price))
      .filter((p) => !isNaN(p) && p > 0);
    if (prices.length > 0) return Math.min(...prices);
  }
  return 0;
}

export default function LiveSearchDropdown({
  onClose,
  isMobileOverlay = false,
  placeholder = 'Search designer apparel, footwear, beauty...',
  autoFocus = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // Read search query from URL if currently on /shop
  const urlSearch = new URLSearchParams(location.search).get('search') || '';

  const [query, setQuery] = useState(urlSearch);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listboxRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Sync with URL when route changes to/from /shop
  useEffect(() => {
    if (location.pathname === '/shop') {
      const current = new URLSearchParams(location.search).get('search') || '';
      setQuery(current);
    }
  }, [location.pathname, location.search]);

  // Click outside listener to dismiss suggestions
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Autofocus if requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Scroll active suggestion into view during arrow key navigation
  useEffect(() => {
    if (highlightedIndex >= 0 && listboxRef.current) {
      const items = listboxRef.current.querySelectorAll('[data-suggestion-item]');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  // Debounced search query handler
  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      setSuggestions([]);
      setIsOpen(false);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const res = await productApi.getProducts({
          search: trimmed,
          limit: 6,
        });

        const items = res?.data || [];
        setSuggestions(items);
        setIsOpen(true);
        setHighlightedIndex(-1);
        setHasSearched(true);
      } catch (err) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          setSuggestions([]);
          setHasSearched(true);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  // Navigate to full search results on ShopPage
  const goToFullSearch = useCallback(
    (searchQuery) => {
      const targetQuery = (searchQuery ?? query).trim();
      setIsOpen(false);
      onClose?.();
      if (targetQuery) {
        navigate(`/shop?search=${encodeURIComponent(targetQuery)}`);
      } else {
        navigate('/shop');
      }
    },
    [query, navigate, onClose]
  );

  // Navigate to specific product detail page
  const goToProduct = useCallback(
    (product) => {
      setIsOpen(false);
      onClose?.();
      const productSlug = product.slug || product.id || product._id;
      navigate(`/products/${productSlug}`);
    },
    [navigate, onClose]
  );

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      if (suggestions.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev < suggestions.length - 1 ? prev + 1 : 0;
          return next;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : suggestions.length - 1;
          return next;
        });
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
          goToProduct(suggestions[highlightedIndex]);
        } else {
          goToFullSearch();
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;

      default:
        break;
    }
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  const showDropdown = isOpen && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Container */}
      <div className="relative flex items-center w-full">
        <Search
          className={`w-4 h-4 text-[#705E51] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
            isOpen ? 'text-[#9A6A45]' : ''
          }`}
          aria-hidden="true"
        />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls="live-search-suggestions"
          aria-activedescendant={
            highlightedIndex >= 0 && suggestions[highlightedIndex]
              ? `search-suggestion-${suggestions[highlightedIndex].id || suggestions[highlightedIndex]._id}`
              : undefined
          }
          className={`w-full pl-10 ${
            query ? 'pr-16' : 'pr-4'
          } py-2.5 rounded-full bg-[#F7F3EE] border border-[#E7DED5] text-xs text-[#2A211B] placeholder-[#705E51] focus:bg-white focus:outline-none focus:border-[#9A6A45] focus:ring-1 focus:ring-[#9A6A45]/30 transition-all shadow-xs`}
        />

        {/* Right Action Icons: Spinner and/or Clear button */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {loading && (
            <Loader2 className="w-3.5 h-3.5 text-[#9A6A45] animate-spin shrink-0" aria-label="Searching..." />
          )}
          {query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search input"
              className="p-1 rounded-full text-[#705E51] hover:text-[#2A211B] hover:bg-[#E7DED5]/60 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Live Suggestions Dropdown Popover */}
      {showDropdown && (
        <div
          id="live-search-suggestions"
          ref={listboxRef}
          role="listbox"
          aria-label="Product suggestions"
          className={`absolute left-0 right-0 mt-2 bg-white border border-[#E7DED5] rounded-2xl shadow-xl overflow-hidden z-50 transition-all ${
            isMobileOverlay ? 'max-h-[60vh]' : 'max-h-[460px]'
          } flex flex-col`}
        >
          {suggestions.length > 0 ? (
            <>
              {/* Header Label */}
              <div className="px-4 py-2 bg-[#FAF7F2] border-b border-[#E7DED5] flex items-center justify-between text-[11px] font-semibold text-[#705E51] uppercase tracking-wider">
                <span>Suggested Products</span>
                <span>{suggestions.length} items</span>
              </div>

              {/* Suggestions List */}
              <div className="overflow-y-auto divide-y divide-[#E7DED5]/60">
                {suggestions.map((product, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  const price = resolveProductPrice(product);
                  const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0];
                  const rawImageUrl = primaryImage?.url || LUXE_PLACEHOLDER_IMAGE;
                  const thumbUrl = getOptimizedImageUrl(rawImageUrl, {
                    width: 90,
                    height: 110,
                    crop: 'fill',
                    quality: 'auto:good',
                  });

                  return (
                    <div
                      key={product.id || product._id || idx}
                      id={`search-suggestion-${product.id || product._id}`}
                      data-suggestion-item
                      role="option"
                      aria-selected={isHighlighted}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => goToProduct(product)}
                      className={`flex items-center gap-3.5 p-3 px-4 cursor-pointer transition-colors ${
                        isHighlighted
                          ? 'bg-[#F7F3EE] text-[#2A211B]'
                          : 'hover:bg-[#FAF7F2] text-[#2A211B]'
                      }`}
                    >
                      {/* Product Thumbnail */}
                      <div className="w-12 h-14 rounded-lg bg-[#F7F3EE] border border-[#E7DED5] overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          src={thumbUrl}
                          alt={product.name || 'Product Thumbnail'}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = LUXE_PLACEHOLDER_IMAGE;
                          }}
                        />
                      </div>

                      {/* Product Information */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-[10px] font-bold text-[#9A6A45] uppercase tracking-wider truncate">
                          {product.brand || 'LuxeCart'}
                        </p>
                        <p className="text-xs font-semibold text-[#2A211B] truncate">
                          {product.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-[#2A211B]">
                            ₹{price > 0 ? price.toLocaleString('en-IN') : 'N/A'}
                          </span>
                          {product.category?.name && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[#705E51] bg-[#F7F3EE] px-1.5 py-0.2 rounded">
                              <Tag className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[100px]">{product.category.name}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <ArrowRight
                        className={`w-4 h-4 text-[#705E51] transition-transform ${
                          isHighlighted ? 'translate-x-1 text-[#9A6A45]' : 'opacity-40'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* View All Search Results Footer */}
              <button
                type="button"
                onClick={() => goToFullSearch()}
                className="w-full py-3 px-4 bg-[#FAF7F2] hover:bg-[#F7F3EE] border-t border-[#E7DED5] text-xs font-semibold text-[#2A211B] flex items-center justify-between transition-colors cursor-pointer group"
              >
                <span>
                  View all results for <strong className="text-[#9A6A45]">"{query.trim()}"</strong>
                </span>
                <span className="inline-flex items-center gap-1 text-[#9A6A45] group-hover:translate-x-0.5 transition-transform">
                  <span>Explore catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            </>
          ) : hasSearched && !loading ? (
            <div className="p-6 text-center space-y-2">
              <p className="text-xs font-medium text-[#705E51]">
                No matching products found for <strong className="text-[#2A211B]">"{query.trim()}"</strong>
              </p>
              <button
                type="button"
                onClick={() => goToFullSearch()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A6A45] hover:underline"
              >
                <span>Browse all catalog products</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
