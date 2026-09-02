import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useCart } from '../features/cart/context/CartContext';
import { useWishlist } from '../features/wishlist/context/WishlistContext';
import { ShoppingBag, Heart, LogOut, Compass, LogIn, MapPin, Package } from 'lucide-react';
import SkipToContent from './common/SkipToContent';

import Logo from './common/Logo';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { totalUnits } = useCart();
  const { itemCount: wishlistCount } = useWishlist();

  return (
    <>
      <SkipToContent targetId="main-content" />
      <nav
        aria-label="Main Navigation"
        className="border-b border-[#E7DED5] bg-[#FFFFFF]/90 backdrop-blur-md sticky top-0 z-40"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Brand Logo */}
            <div className="flex items-center gap-8">
              <Link
                to="/"
                aria-label="LuxeCart Home"
                className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] rounded-lg py-1"
              >
                <Logo variant="light" className="h-8 sm:h-10 w-auto" priority alt="LuxeCart" />
              </Link>

              {/* Navigation Links */}
              <div className="hidden md:flex items-center gap-6 text-sm font-medium">
                <Link
                  to="/shop"
                  className="text-[#6F6963] hover:text-[#2A211B] transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] rounded-lg px-2 py-1"
                >
                  <Compass className="w-4 h-4 text-[#9A6A45]" />
                  <span>Explore Catalog</span>
                </Link>
              </div>
            </div>

            {/* Right Action Icons */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Wishlist Link & Badge */}
              <Link
                to="/wishlist"
                className="relative p-2 rounded-lg text-[#2A211B] hover:text-[#9A6A45] hover:bg-[#F7F3EE] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45]"
                title="Saved Items"
                aria-label={`Saved items (${wishlistCount})`}
              >
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#9A6A45] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
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
                  <span className="absolute -top-1 -right-1 bg-[#2A211B] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {totalUnits > 99 ? '99+' : totalUnits}
                  </span>
                )}
              </Link>

              {isAuthenticated ? (
                <div className="flex items-center gap-2 sm:gap-3 border-l border-[#E7DED5] pl-3">
                  {/* My Orders Link */}
                  <Link
                    to="/orders"
                    className="p-2 rounded-lg text-[#2A211B] hover:text-[#9A6A45] hover:bg-[#F7F3EE] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45]"
                    title="My Orders"
                    aria-label="My Orders"
                  >
                    <Package className="w-5 h-5" />
                  </Link>

                  {/* Saved Addresses Link */}
                  <Link
                    to="/account/addresses"
                    className="p-2 rounded-lg text-[#2A211B] hover:text-[#9A6A45] hover:bg-[#F7F3EE] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45]"
                    title="Saved Delivery Addresses"
                    aria-label="Saved Delivery Addresses"
                  >
                    <MapPin className="w-5 h-5" />
                  </Link>

                  <div className="hidden sm:flex flex-col text-right">
                    <span className="text-xs font-semibold text-[#2A211B]">{user.name}</span>
                    <span className="text-[10px] text-[#9A6A45] font-bold uppercase">{user.role}</span>
                  </div>
                  <button
                    onClick={logout}
                    title="Log out"
                    aria-label="Log out of account"
                    className="p-2 rounded-lg text-[#6F6963] hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 border-l border-[#E7DED5] pl-3">
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
      </nav>
    </>
  );
}
