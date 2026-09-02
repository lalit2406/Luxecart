import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import {
  LayoutDashboard,
  Package,
  Layers,
  UploadCloud,
  ShoppingBag,
  RotateCcw,
  MessageSquare,
  LifeBuoy,
  Tag,
  LogOut,
  ExternalLink,
  Menu,
  X,
  LayoutTemplate,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronRight as BreadcrumbSeparator,
  ArrowLeft,
} from 'lucide-react';
import SkipToContent from '../components/common/SkipToContent';
import AdminErrorBoundary from '../components/common/AdminErrorBoundary';
import Logo from '../components/common/Logo';

const STORAGE_KEY = 'luxecart_admin_sidebar_collapsed';

export default function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Collapsible sidebar state initialized from localStorage
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
      } catch {
        // Safe fallback if localStorage is restricted
      }
      return next;
    });
  };

  // Close mobile drawer on escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'Orders & Fulfillment', path: '/admin/orders', icon: ShoppingBag },
    { label: 'Returns Management', path: '/admin/returns', icon: RotateCcw },
    { label: 'Customer Support', path: '/admin/support', icon: LifeBuoy },
    { label: 'Customer Reviews', path: '/admin/reviews', icon: MessageSquare },
    { label: 'Coupons & Promotions', path: '/admin/coupons', icon: Tag },
    { label: 'Content & CMS', path: '/admin/content', icon: LayoutTemplate },
    { label: 'Products', path: '/admin/products', icon: Package },
    { label: 'Bulk Import', path: '/admin/products/import', icon: UploadCloud },
    { label: 'Categories', path: '/admin/categories', icon: Layers },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Derive dynamic breadcrumbs and optional back button from URL
  const { breadcrumbs, backLink } = useMemo(() => {
    const p = location.pathname;
    const crumbs = [{ label: 'Dashboard', path: '/admin' }];
    let back = null;

    if (p === '/admin') {
      return { breadcrumbs: crumbs, backLink: null };
    }

    if (p.startsWith('/admin/products/new')) {
      crumbs.push({ label: 'Products', path: '/admin/products' });
      crumbs.push({ label: 'Create Product', path: null });
      back = { label: 'Back to Products', path: '/admin/products' };
    } else if (p.startsWith('/admin/products/import')) {
      crumbs.push({ label: 'Products', path: '/admin/products' });
      crumbs.push({ label: 'Bulk Import', path: null });
      back = { label: 'Back to Products', path: '/admin/products' };
    } else if (p.includes('/admin/products/') && p.endsWith('/edit')) {
      crumbs.push({ label: 'Products', path: '/admin/products' });
      crumbs.push({ label: 'Edit Product', path: null });
      back = { label: 'Back to Products', path: '/admin/products' };
    } else if (p === '/admin/products') {
      crumbs.push({ label: 'Products', path: null });
    } else if (p.startsWith('/admin/orders/')) {
      const orderNum = p.split('/admin/orders/')[1];
      crumbs.push({ label: 'Orders & Fulfillment', path: '/admin/orders' });
      crumbs.push({ label: `Order #${orderNum}`, path: null });
      back = { label: 'Back to Orders', path: '/admin/orders' };
    } else if (p === '/admin/orders') {
      crumbs.push({ label: 'Orders & Fulfillment', path: null });
    } else if (p.startsWith('/admin/returns/')) {
      const retNum = p.split('/admin/returns/')[1];
      crumbs.push({ label: 'Returns Management', path: '/admin/returns' });
      crumbs.push({ label: `Return #${retNum}`, path: null });
      back = { label: 'Back to Returns', path: '/admin/returns' };
    } else if (p === '/admin/returns') {
      crumbs.push({ label: 'Returns Management', path: null });
    } else if (p.startsWith('/admin/support/tickets/')) {
      const tNum = p.split('/admin/support/tickets/')[1];
      crumbs.push({ label: 'Customer Support', path: '/admin/support' });
      crumbs.push({ label: `Ticket #${tNum}`, path: null });
      back = { label: 'Back to Support', path: '/admin/support' };
    } else if (p === '/admin/support') {
      crumbs.push({ label: 'Customer Support', path: null });
    } else if (p === '/admin/reviews') {
      crumbs.push({ label: 'Customer Reviews', path: null });
    } else if (p === '/admin/coupons') {
      crumbs.push({ label: 'Coupons & Promotions', path: null });
    } else if (p === '/admin/content') {
      crumbs.push({ label: 'Content & CMS', path: null });
    } else if (p === '/admin/categories') {
      crumbs.push({ label: 'Categories', path: null });
    }

    return { breadcrumbs: crumbs, backLink: back };
  }, [location.pathname]);

  return (
    <>
      <SkipToContent targetId="main-content" />
      <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col md:flex-row">
        {/* Mobile Top Navigation Header */}
        <header className="md:hidden flex items-center justify-between h-16 px-4 bg-[#2A211B] text-white border-b border-[#3D3128] sticky top-0 z-50 shadow-xs">
          <Link
            to="/admin"
            aria-label="LuxeCart Admin Dashboard"
            className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] rounded-lg"
          >
            <Logo variant="dark" className="h-8 w-auto" alt="LuxeCart Admin" priority />
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 text-[#E7DED5] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] rounded-lg cursor-pointer transition-colors"
            aria-label={mobileOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
            aria-expanded={mobileOpen}
            aria-controls="admin-sidebar"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </header>

        {/* Mobile Backdrop Overlay */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
            aria-hidden="true"
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          id="admin-sidebar"
          aria-label="Admin Navigation Sidebar"
          className={`fixed md:sticky top-0 left-0 h-screen bg-[#2A211B] text-[#E7DED5] flex flex-col justify-between z-40 transition-all duration-300 ease-in-out border-r border-[#3D3128] ${
            collapsed ? 'md:w-20' : 'md:w-64'
          } ${mobileOpen ? 'w-68 translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        >
          {/* Top Section */}
          <div className="flex flex-col min-h-0">
            {/* Brand Header & Toggle */}
            <div
              className={`flex items-center border-b border-[#3D3128] p-4 transition-all duration-300 ${
                collapsed ? 'justify-center' : 'justify-between'
              }`}
            >
              <Link
                to="/admin"
                aria-label="LuxeCart Management Portal"
                className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] rounded-xl group overflow-hidden"
              >
                {collapsed ? (
                  <Logo variant="icon" className="h-9 w-9 object-contain group-hover:scale-105 transition-transform" alt="LuxeCart" />
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <Logo variant="dark" className="h-7 w-auto object-contain" alt="LuxeCart" priority />
                    <span className="block text-[9px] text-[#9A6A45] font-bold uppercase tracking-wider pl-0.5">
                      Management Portal
                    </span>
                  </div>
                )}
              </Link>

              {/* Desktop Toggle Button */}
              <button
                onClick={toggleCollapsed}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="hidden md:flex p-1.5 rounded-lg text-[#6F6963] hover:text-white hover:bg-[#3D3128] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45]"
              >
                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>

            {/* Navigation Links */}
            <nav
              aria-label="Admin Navigation Links"
              className="overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin scrollbar-thumb-[#3D3128]"
            >
              {!collapsed && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6F6963] px-3 mb-2">
                  Navigation
                </p>
              )}

              {navItems.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  (item.path !== '/admin' && location.pathname.startsWith(item.path));
                const Icon = item.icon;

                return (
                  <div key={item.path} className="relative group">
                    <Link
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={item.label}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] ${
                        collapsed ? 'justify-center' : ''
                      } ${
                        isActive
                          ? 'bg-[#9A6A45] text-white shadow-xs'
                          : 'text-[#E7DED5]/80 hover:bg-[#3D3128] hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>

                    {/* Floating Tooltip in Collapsed State */}
                    {collapsed && (
                      <div
                        role="tooltip"
                        className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-lg bg-[#171513] text-[#E7DED5] text-xs font-medium whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-[#3D3128]"
                      >
                        {item.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* User Info & Storefront Link */}
          <div className="border-t border-[#3D3128] p-3 space-y-2 shrink-0">
            {/* View Storefront Link */}
            <div className="relative group">
              <Link
                to="/"
                target="_blank"
                rel="noreferrer"
                aria-label="View public storefront in new tab"
                className={`flex items-center px-3 py-2 rounded-xl bg-[#3D3128] text-xs text-[#E7DED5] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9A6A45] ${
                  collapsed ? 'justify-center' : 'justify-between'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-[#9A6A45] shrink-0" />
                  {!collapsed && <span className="truncate">Storefront</span>}
                </span>
                {!collapsed && <span className="text-[10px] text-[#6F6963]">↗</span>}
              </Link>

              {collapsed && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-lg bg-[#171513] text-[#E7DED5] text-xs font-medium whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-[#3D3128]"
                >
                  View Storefront ↗
                </div>
              )}
            </div>

            {/* Admin User Profile & Sign Out */}
            <div
              className={`flex items-center pt-1 ${
                collapsed ? 'justify-center' : 'justify-between px-1'
              }`}
            >
              {!collapsed && (
                <div className="truncate mr-2">
                  <p className="text-xs font-semibold text-white truncate">{user?.name || 'Administrator'}</p>
                  <p className="text-[10px] text-[#9A6A45] font-mono uppercase">{user?.role || 'ADMIN'}</p>
                </div>
              )}
              <div className="relative group">
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  aria-label="Sign out of admin portal"
                  className="p-2 text-[#6F6963] hover:text-red-400 rounded-lg hover:bg-[#3D3128] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                >
                  <LogOut className="w-4 h-4" />
                </button>
                {collapsed && (
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-lg bg-[#171513] text-red-400 text-xs font-medium whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 border border-[#3D3128]"
                  >
                    Sign Out
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          {/* Top Bar Header with Breadcrumbs & Contextual Actions */}
          <header className="bg-white border-b border-[#E7DED5] px-4 sm:px-8 py-3.5 sticky top-0 z-30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {/* Back Button for Detail Pages */}
              {backLink && (
                <Link
                  to={backLink.path}
                  aria-label={backLink.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] hover:bg-white text-xs font-semibold text-[#2A211B] transition-colors shadow-2xs shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-[#9A6A45]" />
                  <span className="hidden sm:inline">{backLink.label}</span>
                  <span className="sm:hidden">Back</span>
                </Link>
              )}

              {/* Breadcrumb Path */}
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#6F6963] truncate">
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={crumb.label + idx}>
                    {idx > 0 && <BreadcrumbSeparator className="w-3 h-3 text-[#B3A89D] shrink-0" />}
                    {crumb.path ? (
                      <Link
                        to={crumb.path}
                        className="hover:text-[#2A211B] transition-colors truncate font-medium"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-[#2A211B] font-semibold truncate">
                        {crumb.label}
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            </div>

            {/* Quick Actions / Storefront indicator */}
            <div className="flex items-center gap-3 shrink-0">
              <Link
                to="/"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-[#6F6963] hover:text-[#2A211B] transition-colors"
              >
                <span>Storefront</span>
                <ExternalLink className="w-3 h-3 text-[#9A6A45]" />
              </Link>
              <div className="w-2 h-2 rounded-full bg-emerald-500" title="Admin Session Active" />
            </div>
          </header>

          <main id="main-content" className="flex-1 p-4 sm:p-8 lg:p-10 max-w-7xl w-full mx-auto space-y-8">
            <AdminErrorBoundary>
              {children}
            </AdminErrorBoundary>
          </main>

          <footer className="border-t border-[#E7DED5] bg-white py-4 px-6 sm:px-10 text-xs text-[#6F6963] flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>LuxeCart Single-Vendor Management &copy; 2026</span>
            <span className="font-mono text-[11px]">Phase 5A Production Core</span>
          </footer>
        </div>
      </div>
    </>
  );
}
