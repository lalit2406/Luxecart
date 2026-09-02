import React from 'react';
import { Banknote, ShieldCheck, Truck } from 'lucide-react';

export default function OrderPriceSummary({ pricing, payment }) {
  if (!pricing) return null;

  const totalMrpRupees = ((pricing.totalMrp || 0) / 100).toLocaleString('en-IN');
  const totalSavingsRupees = ((pricing.totalSavings || 0) / 100).toLocaleString('en-IN');
  const subtotalRupees = ((pricing.subtotal || 0) / 100).toLocaleString('en-IN');
  const grandTotalRupees = ((pricing.grandTotal || 0) / 100).toLocaleString('en-IN');

  return (
    <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 space-y-6 shadow-xs">
      <h3 className="text-base font-serif font-bold text-[#2A211B] border-b border-[#E7DED5] pb-3">
        Payment & Price Breakdown
      </h3>

      <div className="space-y-3 text-xs text-[#6F6963]">
        <div className="flex justify-between">
          <span>Total MRP</span>
          <span className="font-semibold text-[#2A211B]">₹{totalMrpRupees}</span>
        </div>

        {pricing.totalSavings > 0 && (
          <div className="flex justify-between text-emerald-700">
            <span>Bag Savings</span>
            <span className="font-semibold">- ₹{totalSavingsRupees}</span>
          </div>
        )}

        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="font-semibold text-[#2A211B]">₹{subtotalRupees}</span>
        </div>

        <div className="flex justify-between">
          <span>Delivery Fee</span>
          <span className="font-semibold text-emerald-700 uppercase">FREE</span>
        </div>

        <div className="flex justify-between">
          <span>Estimated Tax</span>
          <span className="font-semibold text-[#2A211B]">₹0</span>
        </div>

        <div className="border-t border-[#E7DED5] pt-3 flex justify-between text-sm font-bold text-[#2A211B]">
          <span>Total Amount</span>
          <span>₹{grandTotalRupees}</span>
        </div>
      </div>

      {/* COD Payment Method Badge */}
      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs space-y-1.5">
        <div className="flex items-center justify-between font-bold">
          <div className="flex items-center gap-1.5">
            <Banknote className="w-4 h-4 text-amber-700" />
            <span>Cash on Delivery</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-800 text-[10px] uppercase tracking-wider">
            {payment?.status === 'PAID' ? 'Collected' : 'Pending Handover'}
          </span>
        </div>
        <p className="text-[11px] text-amber-800/90">
          Payment of ₹{grandTotalRupees} will be collected via cash or UPI when your parcel arrives.
        </p>
      </div>

      {/* Trust Badges */}
      <div className="pt-2 border-t border-[#E7DED5] space-y-2 text-[11px] text-[#6F6963]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#9A6A45]" />
          <span>100% Genuine Luxury Guarantee</span>
        </div>
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-[#9A6A45]" />
          <span>Complimentary Express Shipping</span>
        </div>
      </div>
    </div>
  );
}
