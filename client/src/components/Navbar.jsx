import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useCart } from '../features/cart/context/CartContext';
import { useWishlist } from '../features/wishlist/context/WishlistContext';
import {
  ShoppingBag,
  Heart,
  LogOut,
  LogIn,
  MapPin,
  Package,
  Search,
  Shield,
  Menu,
  X,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import SkipToContent from './common/SkipToContent';
import Logo from './common/Logo';
import LiveSearchDropdown from './search/LiveSearchDropdown';
import { useStoreSettings } from '../features/settings/context/useStoreSettings';

export default function Navbar() {
  const { settings } = useStoreSettings();
  const storeName = settings?.storeName || 'LuxeCart';
  const { user, isAuthenticated, logout } = useAuth();
  const { totalUnits } = useCart();
  const { itemCount: wishlistCount } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [drawerTop, setDrawerTop] = useState(null);

  const headerRef = useRef(null);
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const searchInputRef = useRef(null);
  const prevFocusedElement = useRef(null);

  // Dynamic header bottom measurement to avoid reliance on hardcoded pixel offsets
  const updateDrawerPosition = useCallback(() => {
    if (headerRef.current) {
      const bottom = headerRef.current.getBoundingClientRect().bottom;
      setDrawerTop(Math.max(0, Math.round(bottom)));
    }
  }, []);

  // Close drawer and search overlay on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname, location.search]);

  // Position recalculation on resize / scroll
  useEffect(() => {
    if (mobileMenuOpen) {
      updateDrawerPosition();
      window.addEventListener('resize', updateDrawerPosition);
      window.addEventListener('scroll', updateDrawerPosition, { passive: true });
      return () => {
        window.removeEventListener('resize', updateDrawerPosition);
        window.removeEventListener('scroll', updateDrawerPosition);
      };
    }
  }, [mobileMenuOpen, updateDrawerPosition]);

  // Accessible keyboard trap, Escape handling, and focus management
  useEffect(() => {
    if (!mobileMenuOpen && !mobileSearchOpen) return;

    prevFocusedElement.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const timer = setTimeout(() => {
      if (searchInputRef.current && mobileMenuOpen) {
        searchInputRef.current.focus();
      } else if (drawerRef.current && mobileMenuOpen) {
        const firstFocusable = drawerRef.current.querySelector(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (mobileSearchOpen) {
          setMobileSearchOpen(false);
        } else if (mobileMenuOpen) {
          setMobileMenuOpen(false);
          menuButtonRef.current?.focus();
        }
        return;
      }

      if (e.key === 'Tab' && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || !drawerRef.current.contains(document.activeElement)) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement || !drawerRef.current.contains(document.activeElement)) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (menuButtonRef.current) {
        menuButtonRef.current.focus();
      } else if (prevFocusedElement.current && typeof prevFocusedElement.current.focus === 'function') {
        prevFocusedElement.current.focus();
      }
    };
  }, [mobileMenuOpen]);

  // Primary navigation categories required by design specification
  const navItems = [
    { label: 'New In', path: '/shop?isNewArrival=true', badge: 'New' },
    { label: 'Men', path: '/shop?gender=MEN' },
    { label: 'Women', path: '/shop?gender=WOMEN' },
    { label: 'Footwear', path: '/shop?category=footwear' },
    { label: 'Beauty', path: '/shop?category=beauty' },
    { label: 'Accessories', path: '/shop?category=accessories' },
    { label: 'Lifestyle', path: '/shop?category=lifestyle' },
  ];

  const isCurrentActive = (path) => {
    return location.pathname + location.search === path;
  };

  return (
    <>
      <SkipToContent targetId="main-content" />
      <header ref={headerRef} className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E7DED5] transition-all">
        {/* Main Header Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
            {/* Left: Mobile Menu Toggle & Brand Logo */}
            <div className="flex items-center gap-3 sm:gap-6">
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => {
                  setMobileSearchOpen(false);
                  setMobileMenuOpen(!mobileMenuOpen);
                }}
                className="lg:hidden p-2 -ml-2 rounded-lg text-[#2A211B] hover:bg-[#F7F3EE] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45]"
                aria-label={mobileMenuOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation-drawer"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>

              <Link
                to="/"
                aria-label={`${storeName} Home`}
                className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] rounded-lg py-1"
              >
                <Logo variant="light" className="h-7 sm:h-9 w-auto" priority alt={storeName} />
              </Link>
            </div>

            {/* Center: Search Bar (Desktop / Tablet) */}
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <LiveSearchDropdown />
            </div>

            {/* Right: Actions, Wishlist, Cart, Account, Admin */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Mobile Search Icon Trigger */}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setMobileSearchOpen(true);
                }}
                className="md:hidden p-2 rounded-lg text-[#2A211B] hover:text-[#9A6A45] hover:bg-[#F7F3EE] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] cursor-pointer"
                title="Search Catalog"
                aria-label="Search Catalog"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Location / Delivery Pin */}
              <Link
                to="/account/addresses"
                className="hidden sm:inline-flex p-2 rounded-lg text-[#2A211B] hover:text-[#9A6A45] hover:bg-[#F7F3EE] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45]"
                title="Delivery Locations"
                aria-label="Delivery Locations"
              >
                <MapPin className="w-5 h-5" />
              </Link>

              {/* Wishlist Link & Badge */}
              <Link
                to="/wishlist"
                className="relative p-2 rounded-lg text-[#2A211B] hover:text-[#9A6A45] hover:bg-[#F7F3EE] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45]"
                title="Saved Items"
                aria-label={`Saved items (${wishlistCount})`}
              >
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute top-1 right-1 bg-[#9A6A45] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {wishlistCount > 9 ? '9+' : wishlistCount}
                  </span>
                )}
              </Link>

              {/* Shopping Bag Link & Badge */}
              <Link
                to="/cart"
                className="relative p-2 rounded-lg text-[#2A211B] hover:text-[#9A6A45] hover:bg-[#F7F3EE] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45]"
                title="Shopping Bag"
                aria-label={`Shopping bag (${totalUnits} items)`}
              >
                <ShoppingBag className="w-5 h-5" />
                {totalUnits > 0 && (
                  <span className="absolute top-1 right-1 bg-[#2A211B] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {totalUnits > 99 ? '99+' : totalUnits}
                  </span>
                )}
              </Link>

              {/* Admin Portal Shortcut (If user has ADMIN role) */}
              {isAuthenticated && user?.role === 'ADMIN' && (
                <Link
                  to="/admin"
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#2A211B] text-[#E7DED5] hover:bg-[#9A6A45] hover:text-white transition-colors text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45]"
                  title="Admin Dashboard"
                >
                  <Shield className="w-3.5 h-3.5 text-[#E7DED5]" />
                  <span>Admin</span>
                </Link>
              )}

              {/* Authentication Controls */}
              {isAuthenticated ? (
                <div className="flex items-center gap-1.5 sm:gap-2 border-l border-[#E7DED5] pl-2 sm:pl-3">
                  <Link
                    to="/orders"
                    className="hidden sm:inline-flex p-2 rounded-lg text-[#2A211B] hover:text-[#9A6A45] hover:bg-[#F7F3EE] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45]"
                    title="My Orders"
                    aria-label="My Orders"
                  >
                    <Package className="w-5 h-5" />
                  </Link>

                  <div className="hidden lg:flex flex-col text-right pr-1">
                    <span className="text-xs font-semibold text-[#2A211B] line-clamp-1 max-w-[120px]">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-[#9A6A45] font-bold uppercase tracking-wider">
                      {user.role}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={logout}
                    title="Log out"
                    aria-label="Log out of account"
                    className="p-2 rounded-lg text-[#705E51] hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 border-l border-[#E7DED5] pl-2 sm:pl-3">
                  <Link
                    to="/login"
                    aria-label="Sign in to your account"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45]"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Category Navigation Bar */}
        <div className="hidden lg:block border-t border-[#E7DED5]/80 bg-[#FAF7F2]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center justify-between h-11 text-xs font-semibold uppercase tracking-wider">
              <div className="flex items-center gap-8">
                {navItems.map((item) => {
                  const active = isCurrentActive(item.path);
                  return (
                    <Link
                      key={item.label}
                      to={item.path}
                      className={`relative py-3 transition-colors flex items-center gap-1.5 ${
                        active
                          ? 'text-[#9A6A45] font-bold border-b-2 border-[#9A6A45]'
                          : 'text-[#2A211B] hover:text-[#9A6A45]'
                      }`}
                    >
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.2 rounded bg-[#9A6A45] text-white text-[9px] font-bold uppercase tracking-normal">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              <Link
                to="/shop"
                className="text-[#705E51] hover:text-[#9A6A45] transition-colors font-medium text-[11px] flex items-center gap-1 normal-case tracking-normal"
              >
                <span>View Full Catalog</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </nav>
          </div>
        </div>

        {/* Mobile & Tablet Horizontally-Scrollable Category Strip */}
        <div className="lg:hidden border-t border-[#E7DED5] bg-[#FAF7F2] overflow-x-auto scrollbar-none py-2 px-4">
          <div className="flex items-center gap-2 whitespace-nowrap min-w-max">
            {navItems.map((item) => (
              <Link
                key={item.label}
                to={item.path}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-[#E7DED5] text-xs font-semibold text-[#2A211B] hover:border-[#9A6A45] hover:text-[#9A6A45] transition-colors"
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9A6A45]" />
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div
            id="mobile-navigation-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
            style={{ top: drawerTop !== null ? `${drawerTop}px` : undefined }}
            onClick={(e) => {
              if (e.target === drawerRef.current) {
                setMobileMenuOpen(false);
              }
            }}
            className="lg:hidden fixed inset-x-0 bottom-0 bg-[#171513]/60 backdrop-blur-xs z-50 overflow-y-auto"
          >
            <div className="bg-white border-b border-[#E7DED5] p-5 space-y-6 max-h-[85vh] overflow-y-auto shadow-2xl">
              {/* Mobile Drawer Live Search */}
              <div className="relative">
                <LiveSearchDropdown
                  isMobileOverlay
                  onClose={() => setMobileMenuOpen(false)}
                />
              </div>

              {/* Navigation Categories */}
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-[#705E51] uppercase tracking-wider px-2 pb-1">
                  Shop Departments
                </p>
                {navItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold text-[#2A211B] hover:bg-[#F7F3EE] hover:text-[#9A6A45] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded bg-[#9A6A45] text-white text-[9px] font-bold uppercase">
                          {item.badge}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#705E51]" />
                  </Link>
                ))}
              </div>

              {/* Account & Service Links */}
              <div className="space-y-1 pt-4 border-t border-[#E7DED5]">
                <p className="text-[11px] font-bold text-[#705E51] uppercase tracking-wider px-2 pb-1">
                  Customer Concierge
                </p>
                {isAuthenticated ? (
                  <>
                    {user?.role === 'ADMIN' && (
                      <Link
                        to="/admin"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#2A211B] hover:bg-[#F7F3EE]"
                      >
                        <Shield className="w-4 h-4 text-[#9A6A45]" />
                        <span>Admin Dashboard</span>
                      </Link>
                    )}
                    <Link
                      to="/orders"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#2A211B] hover:bg-[#F7F3EE]"
                    >
                      <Package className="w-4 h-4 text-[#9A6A45]" />
                      <span>My Orders</span>
                    </Link>
                    <Link
                      to="/account/addresses"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#2A211B] hover:bg-[#F7F3EE]"
                    >
                      <MapPin className="w-4 h-4 text-[#9A6A45]" />
                      <span>Saved Addresses</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#2A211B] hover:bg-[#F7F3EE]"
                  >
                    <LogIn className="w-4 h-4 text-[#9A6A45]" />
                    <span>Sign In or Register</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Mobile Search Overlay */}
        {mobileSearchOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Product Search"
            className="md:hidden fixed inset-0 z-50 bg-[#171513]/70 backdrop-blur-xs flex flex-col justify-start"
          >
            <div className="bg-white border-b border-[#E7DED5] p-4 shadow-2xl space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <LiveSearchDropdown
                    autoFocus
                    isMobileOverlay
                    onClose={() => setMobileSearchOpen(false)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSearchOpen(false)}
                  className="px-3 py-2 text-xs font-semibold text-[#705E51] hover:text-[#2A211B] rounded-xl hover:bg-[#F7F3EE] transition-colors cursor-pointer shrink-0"
                >
                  Cancel
                </button>
              </div>
            </div>
            {/* Backdrop click to dismiss */}
            <div
              className="flex-1 cursor-pointer"
              onClick={() => setMobileSearchOpen(false)}
              aria-hidden="true"
            />
          </div>
        )}
      </header>
    </>
  );
}
