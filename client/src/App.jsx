import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './features/auth/hooks/useAuth';
import { CartProvider } from './features/cart/context/CartContext';
import { WishlistProvider } from './features/wishlist/context/WishlistContext';
import { AddressProvider } from './features/addresses/context/AddressContext';
import { CheckoutProvider } from './features/checkout/context/CheckoutContext';
import { OrderProvider } from './features/orders/context/OrderContext';
import ProtectedRoute from './components/ProtectedRoute';
import PageLoader from './components/common/PageLoader';

// Customer Pages (Lazy-Loaded for Fast Storefront Paint)
const HomePage = lazy(() => import('./pages/HomePage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const ProductDetailPage = lazy(() => import('./pages/ProductDetailPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const AddressesPage = lazy(() => import('./pages/AddressesPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrderDetailPage = lazy(() => import('./pages/OrderDetailPage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const SupportTicketDetailPage = lazy(() => import('./pages/SupportTicketDetailPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));

// Admin Pages (Isolated into Dedicated Lazy Admin Bundle)
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage'));
const AdminOrderDetailPage = lazy(() => import('./pages/admin/AdminOrderDetailPage'));
const AdminReviewsPage = lazy(() => import('./pages/admin/AdminReviewsPage'));
const AdminCouponsPage = lazy(() => import('./pages/admin/AdminCouponsPage'));
const AdminReturnsPage = lazy(() => import('./pages/admin/AdminReturnsPage'));
const AdminReturnDetailPage = lazy(() => import('./pages/admin/AdminReturnDetailPage'));
const AdminSupportPage = lazy(() => import('./pages/admin/AdminSupportPage'));
const AdminSupportTicketDetailPage = lazy(() => import('./pages/admin/AdminSupportTicketDetailPage'));
const AdminProductsPage = lazy(() => import('./pages/admin/AdminProductsPage'));
const AdminProductCreatePage = lazy(() => import('./pages/admin/AdminProductCreatePage'));
const AdminProductEditPage = lazy(() => import('./pages/admin/AdminProductEditPage'));
const AdminProductImportPage = lazy(() => import('./pages/admin/AdminProductImportPage'));
const AdminCategoriesPage = lazy(() => import('./pages/admin/AdminCategoriesPage'));
const AdminContentPage = lazy(() => import('./pages/admin/AdminContentPage'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <AddressProvider>
              <CheckoutProvider>
                <OrderProvider>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      {/* Storefront Customer Routes */}
                      <Route path="/" element={<HomePage />} />
                      <Route path="/shop" element={<ShopPage />} />
                      <Route path="/products/:slug" element={<ProductDetailPage />} />
                      <Route path="/cart" element={<CartPage />} />
                      <Route path="/wishlist" element={<WishlistPage />} />
                      <Route
                        path="/account/addresses"
                        element={
                          <ProtectedRoute>
                            <AddressesPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/checkout"
                        element={
                          <ProtectedRoute>
                            <CheckoutPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/orders/success/:orderNumber"
                        element={
                          <ProtectedRoute>
                            <OrderSuccessPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/orders"
                        element={
                          <ProtectedRoute>
                            <OrdersPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/orders/:orderNumber"
                        element={
                          <ProtectedRoute>
                            <OrderDetailPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/support"
                        element={
                          <ProtectedRoute>
                            <SupportPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/support/tickets/:ticketNumber"
                        element={
                          <ProtectedRoute>
                            <SupportTicketDetailPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

                      {/* Admin Portal Routes (Protected: ADMIN Role Required) */}
                      <Route
                        path="/admin"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminDashboardPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/orders"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminOrdersPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/orders/:orderNumber"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminOrderDetailPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/reviews"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminReviewsPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/coupons"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminCouponsPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/content"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminContentPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/returns"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminReturnsPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/returns/:returnNumber"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminReturnDetailPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/support"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminSupportPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/support/tickets/:ticketNumber"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminSupportTicketDetailPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/products"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminProductsPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/products/new"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminProductCreatePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/products/import"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminProductImportPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/products/:id/edit"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminProductEditPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/categories"
                        element={
                          <ProtectedRoute requiredRole="ADMIN">
                            <AdminCategoriesPage />
                          </ProtectedRoute>
                        }
                      />
                    </Routes>
                  </Suspense>
                </OrderProvider>
              </CheckoutProvider>
            </AddressProvider>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
