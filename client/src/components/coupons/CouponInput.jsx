import React, { useState } from 'react';
import { Tag, Check, X, RefreshCw, AlertCircle } from 'lucide-react';

export default function CouponInput({
  appliedCoupon = null,
  onApplyCoupon = () => {},
  onRemoveCoupon = () => {},
  loading = false,
  error = null,
  disabled = false,
}) {
  const [code, setCode] = useState('');

  const handleApply = async (e) => {
    e.preventDefault();
    if (!code.trim() || loading || disabled) return;
    await onApplyCoupon(code.trim().toUpperCase());
    setCode('');
  };

  if (appliedCoupon) {
    return (
      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 animate-in fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
              <Tag className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-xs text-emerald-900 uppercase tracking-wider">
                  {appliedCoupon.code}
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-200 text-emerald-800 text-[10px] font-bold">
                  Applied
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                {appliedCoupon.description || 'Promotional coupon applied to your order'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRemoveCoupon}
            disabled={disabled}
            className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors cursor-pointer p-1"
            title="Remove Coupon"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleApply} className="flex gap-2">
        <div className="relative flex-1">
          <Tag className="w-4 h-4 text-[#6F6963] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter promo coupon code"
            disabled={disabled || loading}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:bg-white focus:outline-hidden focus:border-[#9A6A45] text-xs font-mono uppercase text-[#2A211B] transition-colors disabled:opacity-50"
          />
        </div>

        <button
          type="submit"
          disabled={!code.trim() || loading || disabled}
          className="px-5 py-2.5 rounded-xl bg-[#2A211B] hover:bg-[#9A6A45] text-white text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center shrink-0 gap-1.5"
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <span>Apply</span>
          )}
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 pl-1 animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
