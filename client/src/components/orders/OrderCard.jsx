import React from 'react';
import { Link } from 'react-router-dom';
import { getStatusConfig } from '../../features/orders/constants/orderStatus';
import { ChevronRight, Package, Banknote, Calendar } from 'lucide-react';

export default function OrderCard({ order }) {
  if (!order) return null;

  const statusConfig = getStatusConfig(order.status);
  const items = order.items || [];
  const previewItems = items.slice(0, 3);
  const remainingCount = items.length - previewItems.length;

  const formattedDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  const grandTotalRupees = ((order.pricing?.grandTotal || 0) / 100).toLocaleString('en-IN');

  return (
    <div className="bg-white border border-[#E7DED5] rounded-3xl p-5 sm:p-6 transition-all hover:shadow-xs hover:border-[#9A6A45]/40 space-y-4">
      {/* Header: Order Number, Date & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7DED5] pb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#6F6963]">Order</span>
            <span className="font-mono font-bold text-xs text-[#2A211B] tracking-wider">
              #{order.orderNumber}
            </span>
          </div>
          {formattedDate && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#6F6963]">
              <Calendar className="w-3.5 h-3.5" />
              <span>Placed on {formattedDate}</span>
            </div>
          )}
        </div>

        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border ${statusConfig.colorClass}`}
        >
          {statusConfig.badgeText}
        </span>
      </div>

      {/* Body: Thumbnail Previews & Items Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {previewItems.map((item, idx) => (
            <div
              key={item._id || item.variantId || idx}
              className="w-14 h-16 rounded-xl bg-[#F7F3EE] border border-[#E7DED5] overflow-hidden shrink-0 relative"
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name || 'Product'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-[#6F6963]">
                  <Package className="w-4 h-4 text-[#9A6A45]" />
                </div>
              )}
            </div>
          ))}

          {remainingCount > 0 && (
            <div className="w-14 h-16 rounded-xl bg-[#F7F3EE] border border-[#E7DED5] flex items-center justify-center text-xs font-bold text-[#6F6963] shrink-0">
              +{remainingCount}
            </div>
          )}

          <div className="pl-1 sm:pl-3 space-y-0.5">
            <p className="text-xs font-semibold text-[#2A211B]">
              {items.length} {items.length === 1 ? 'item' : 'items'}
              {order.pricing?.totalUnits && ` · ${order.pricing.totalUnits} units`}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-[#6F6963]">
              <Banknote className="w-3.5 h-3.5 text-[#9A6A45]" />
              <span>Cash on Delivery</span>
            </div>
          </div>
        </div>

        {/* Amount & CTA */}
        <div className="flex items-center justify-between sm:justify-end sm:gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#E7DED5]">
          <div className="text-left sm:text-right">
            <span className="text-[10px] uppercase tracking-wider text-[#6F6963] font-semibold block">
              Total Amount
            </span>
            <span className="text-sm font-bold text-[#2A211B]">₹{grandTotalRupees}</span>
          </div>

          <Link
            to={`/orders/${order.orderNumber}`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors"
          >
            <span>View Order</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
