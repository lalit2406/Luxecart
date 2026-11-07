import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, Shield, User, Phone, Mail, Calendar, ShoppingBag, ShieldAlert, CheckCircle2, XCircle, Clock } from 'lucide-react';

/**
 * Returns visual styling configuration for account status badges
 */
export const getCustomerStatusBadge = (status) => {
  switch (status) {
    case 'ACTIVE':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: CheckCircle2,
        label: 'Active',
      };
    case 'SUSPENDED':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        icon: XCircle,
        label: 'Suspended',
      };
    case 'INACTIVE':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: Clock,
        label: 'Inactive',
      };
    default:
      return {
        bg: 'bg-stone-50',
        text: 'text-stone-700',
        border: 'border-stone-200',
        icon: User,
        label: status || 'Unknown',
      };
  }
};

export default function AdminCustomerTable({
  customers = [],
  loading = false,
  onOpenStatusModal,
}) {
  if (loading) {
    return (
      <div className="bg-white border border-[#E7DED5] rounded-3xl overflow-hidden shadow-xs">
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E7DED5]/60 shrink-0" />
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-[#E7DED5]/60 rounded-md" />
                  <div className="h-3 w-44 bg-[#E7DED5]/40 rounded-md" />
                </div>
              </div>
              <div className="hidden sm:block h-4 w-28 bg-[#E7DED5]/40 rounded-md" />
              <div className="hidden md:block h-4 w-24 bg-[#E7DED5]/40 rounded-md" />
              <div className="h-6 w-20 bg-[#E7DED5]/40 rounded-full" />
              <div className="h-8 w-16 bg-[#E7DED5]/50 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!customers || customers.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-[#E7DED5] rounded-3xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-[#2A211B]" aria-label="Customer Accounts Table">
          <thead className="bg-[#F7F3EE] border-b border-[#E7DED5] uppercase text-[10px] font-bold tracking-wider text-[#6F6963]">
            <tr>
              <th scope="col" className="py-3.5 px-4 sm:px-6">Customer</th>
              <th scope="col" className="py-3.5 px-4">Contact</th>
              <th scope="col" className="py-3.5 px-4">Joined Date</th>
              <th scope="col" className="py-3.5 px-4">Orders & Lifetime Spend</th>
              <th scope="col" className="py-3.5 px-4">Status</th>
              <th scope="col" className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#E7DED5]">
            {customers.map((customer) => {
              const statusBadge = getCustomerStatusBadge(customer.status);
              const StatusIcon = statusBadge.icon;

              const joinedDateFormatted = customer.createdAt
                ? new Date(customer.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—';

              const totalOrders = customer.totalOrders ?? 0;
              const totalSpentRupees = (
                (customer.totalSpentPaise || 0) / 100
              ).toLocaleString('en-IN');

              // Initials avatar
              const initials = (customer.name || 'C')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <tr
                  key={customer.id}
                  className="hover:bg-[#F7F3EE]/50 transition-colors"
                >
                  {/* Customer Identity */}
                  <td className="py-4 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#2A211B] text-[#FAF7F2] flex items-center justify-center font-bold text-xs tracking-wider shrink-0 shadow-xs">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <Link
                          to={`/admin/customers/${customer.id}`}
                          className="font-semibold text-[#2A211B] hover:text-[#9A6A45] transition-colors truncate block max-w-[200px]"
                        >
                          {customer.name}
                        </Link>
                        <div className="text-[11px] text-[#6F6963] truncate max-w-[200px] flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-[#9A6A45] shrink-0" />
                          <span>{customer.email}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Contact Column */}
                  <td className="py-4 px-4">
                    {customer.phone ? (
                      <div className="text-xs font-mono text-[#2A211B] flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-[#6F6963] shrink-0" />
                        <span>{customer.phone.startsWith('+91') ? customer.phone : `+91 ${customer.phone}`}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#6F6963] italic">No phone registered</span>
                    )}
                  </td>

                  {/* Joined Date */}
                  <td className="py-4 px-4 text-[11px] text-[#6F6963]">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#9A6A45] shrink-0" />
                      <span>{joinedDateFormatted}</span>
                    </div>
                  </td>

                  {/* Orders & Lifetime Spend */}
                  <td className="py-4 px-4">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-[#2A211B] flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3 text-[#9A6A45]" />
                        <span>{totalOrders} {totalOrders === 1 ? 'order' : 'orders'}</span>
                      </div>
                      <div className="text-[11px] text-[#6F6963]">
                        ₹{totalSpentRupees} lifetime
                      </div>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-4 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                    >
                      <StatusIcon className="w-3 h-3 shrink-0" />
                      <span>{statusBadge.label}</span>
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-4 sm:px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onOpenStatusModal && (
                        <button
                          type="button"
                          onClick={() => onOpenStatusModal(customer)}
                          aria-label={`Change status for ${customer.name}`}
                          className="px-2.5 py-1.5 rounded-xl border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] hover:border-[#9A6A45] text-xs font-medium transition-colors cursor-pointer"
                        >
                          Status
                        </button>
                      )}
                      <Link
                        to={`/admin/customers/${customer.id}`}
                        aria-label={`View customer details for ${customer.name}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2A211B] text-[#FAF7F2] hover:bg-[#9A6A45] text-xs font-semibold transition-colors shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </Link>
                    </div>
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
