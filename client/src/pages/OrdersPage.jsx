import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import OrderCard from '../components/orders/OrderCard';
import { orderApi } from '../features/orders/api/orderApi';
import {
  ShoppingBag,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Package,
} from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await orderApi.getMyOrders({ page, limit: 10 });
      setOrders(res?.data?.orders || []);
      setPagination(res?.data?.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      setError(err.message || 'Unable to load your orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(1);
  }, [fetchOrders]);

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full flex-1">
        {/* Page Header */}
        <div className="border-b border-[#E7DED5] pb-6 mb-8 space-y-1">
          <div className="flex items-center gap-2 text-xs text-[#6F6963] mb-2">
            <Link to="/" className="hover:text-[#2A211B]">
              Home
            </Link>
            <span>/</span>
            <span className="text-[#2A211B] font-semibold">My Orders</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B]">
                My Orders
              </h1>
              <p className="text-xs text-[#6F6963] mt-1">
                View your LuxeCart purchases and track their progress.
              </p>
            </div>

            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors"
            >
              <span>Explore Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Loading State: Skeletons */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white border border-[#E7DED5] rounded-3xl p-6 space-y-4 animate-pulse"
              >
                <div className="flex justify-between items-center border-b border-[#E7DED5] pb-4">
                  <div className="h-4 bg-[#E7DED5] rounded w-1/4" />
                  <div className="h-6 bg-[#E7DED5] rounded-full w-20" />
                </div>
                <div className="flex gap-3 items-center">
                  <div className="w-14 h-16 bg-[#E7DED5] rounded-xl" />
                  <div className="w-14 h-16 bg-[#E7DED5] rounded-xl" />
                  <div className="space-y-2 flex-1 pl-2">
                    <div className="h-3 bg-[#E7DED5] rounded w-1/3" />
                    <div className="h-3 bg-[#E7DED5] rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          /* Error State */
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-10 text-center space-y-4 max-w-md mx-auto shadow-xs">
            <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h2 className="text-base font-serif font-bold text-[#2A211B]">
              Unable to Load Orders
            </h2>
            <p className="text-xs text-[#6F6963]">{error}</p>
            <button
              onClick={() => fetchOrders(pagination.page)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          </div>
        ) : orders.length === 0 ? (
          /* Empty State */
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-12 text-center space-y-5 max-w-lg mx-auto shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#F7F3EE] border border-[#E7DED5] text-[#9A6A45] flex items-center justify-center mx-auto">
              <Package className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-[#2A211B]">No Orders Yet</h2>
              <p className="text-xs text-[#6F6963] mt-1 max-w-sm mx-auto">
                Your next favourite luxury piece is waiting for you. Explore our handcrafted collection.
              </p>
            </div>
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold uppercase tracking-wider transition-colors shadow-xs"
            >
              <span>Start Shopping</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          /* Orders List */
          <div className="space-y-6">
            <div className="space-y-4">
              {orders.map((order) => (
                <OrderCard key={order._id || order.orderNumber} order={order} />
              ))}
            </div>

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-[#E7DED5] pt-6 text-xs text-[#6F6963]">
                <p>
                  Showing page <strong className="text-[#2A211B]">{pagination.page}</strong> of{' '}
                  <strong className="text-[#2A211B]">{pagination.pages}</strong>
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchOrders(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="p-2 rounded-lg border border-[#E7DED5] bg-white hover:bg-[#F7F3EE] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => fetchOrders(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                    className="p-2 rounded-lg border border-[#E7DED5] bg-white hover:bg-[#F7F3EE] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    aria-label="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
