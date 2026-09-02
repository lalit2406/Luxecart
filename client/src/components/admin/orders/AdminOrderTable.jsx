import React from 'react';
import { Link } from 'react-router-dom';
import { getStatusConfig } from '../../../features/orders/constants/orderStatus';
import { Eye, Package, Banknote } from 'lucide-react';

export default function AdminOrderTable({ orders = [] }) {
  if (!orders || orders.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-[#E7DED5] rounded-3xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-[#2A211B]">
          <thead className="bg-[#F7F3EE] border-b border-[#E7DED5] uppercase text-[10px] font-bold tracking-wider text-[#6F6963]">
            <tr>
              <th className="py-3.5 px-4 sm:px-6">Order Details</th>
              <th className="py-3.5 px-4">Customer</th>
              <th className="py-3.5 px-4">Items</th>
              <th className="py-3.5 px-4">Grand Total</th>
              <th className="py-3.5 px-4">Payment</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E7DED5]">
            {orders.map((order) => {
              const statusConfig = getStatusConfig(order.status);
              const formattedDate = order.createdAt
                ? new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';

              const grandTotalRupees = (
                (order.pricing?.grandTotal || 0) / 100
              ).toLocaleString('en-IN');

              const items = order.items || [];
              const previewItem = items[0];

              return (
                <tr
                  key={order._id || order.orderNumber}
                  className="hover:bg-[#F7F3EE]/50 transition-colors"
                >
                  {/* Order Column */}
                  <td className="py-4 px-4 sm:px-6 space-y-0.5">
                    <div className="font-mono font-bold text-[#2A211B] tracking-wider">
                      {order.orderNumber}
                    </div>
                    <div className="text-[11px] text-[#6F6963]">{formattedDate}</div>
                  </td>

                  {/* Customer Column */}
                  <td className="py-4 px-4 space-y-0.5 max-w-[180px]">
                    <div className="font-semibold text-[#2A211B] truncate">
                      {order.customer?.name || 'Customer'}
                    </div>
                    <div className="text-[11px] text-[#6F6963] truncate">
                      {order.customer?.email}
                    </div>
                    {order.customer?.phone && order.customer?.phone !== 'N/A' && (
                      <div className="text-[10px] text-[#9A6A45] font-mono">
                        +91 {order.customer.phone}
                      </div>
                    )}
                  </td>

                  {/* Items Preview Column */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-12 rounded-lg bg-[#F7F3EE] border border-[#E7DED5] overflow-hidden shrink-0 flex items-center justify-center">
                        {previewItem?.image ? (
                          <img
                            src={previewItem.image}
                            alt={previewItem.name || 'Product'}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-4 h-4 text-[#9A6A45]" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <span className="font-semibold block">
                          {items.length} {items.length === 1 ? 'item' : 'items'}
                        </span>
                        <span className="text-[11px] text-[#6F6963] block">
                          {order.pricing?.totalUnits || items.length} total units
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Grand Total Column */}
                  <td className="py-4 px-4">
                    <span className="font-bold text-[#2A211B] text-sm">
                      ₹{grandTotalRupees}
                    </span>
                  </td>

                  {/* Payment Column */}
                  <td className="py-4 px-4 space-y-0.5">
                    <div className="flex items-center gap-1.5 font-medium text-[#2A211B]">
                      <Banknote className="w-3.5 h-3.5 text-[#9A6A45]" />
                      <span>COD</span>
                    </div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        order.payment?.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {order.payment?.status === 'PAID' ? 'Collected' : 'Pending'}
                    </span>
                  </td>

                  {/* Status Column */}
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusConfig.colorClass}`}
                    >
                      {statusConfig.badgeText}
                    </span>
                  </td>

                  {/* Action Column */}
                  <td className="py-4 px-4 sm:px-6 text-right">
                    <Link
                      to={`/admin/orders/${order.orderNumber}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors shadow-xs"
                      title="Inspect Order Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
