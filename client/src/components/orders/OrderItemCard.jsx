import React from 'react';
import { Package } from 'lucide-react';

export default function OrderItemCard({ item }) {
  if (!item) return null;

  const unitPriceRupees = ((item.unitPrice || 0) / 100).toLocaleString('en-IN');
  const unitMrpRupees = ((item.unitMrp || 0) / 100).toLocaleString('en-IN');
  const lineSubtotalRupees = ((item.lineSubtotal || 0) / 100).toLocaleString('en-IN');
  const lineMrpRupees = ((item.lineMrp || 0) / 100).toLocaleString('en-IN');
  const lineSavingsRupees = ((item.lineSavings || 0) / 100).toLocaleString('en-IN');

  return (
    <div className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E7DED5] last:border-b-0">
      <div className="flex items-center gap-4 w-full sm:w-auto">
        {/* Product Image Thumbnail */}
        <div className="w-16 h-20 sm:w-20 sm:h-24 rounded-2xl bg-[#F7F3EE] border border-[#E7DED5] overflow-hidden shrink-0 relative flex items-center justify-center">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name || 'Product'}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className="w-full h-full items-center justify-center text-[10px] text-[#6F6963]"
            style={{ display: item.image ? 'none' : 'flex' }}
          >
            <Package className="w-5 h-5 text-[#9A6A45]" />
          </div>
        </div>

        {/* Product Details Snapshot */}
        <div className="space-y-1 flex-1">
          {item.brand && (
            <p className="text-[10px] uppercase font-bold text-[#9A6A45] tracking-wider">
              {item.brand}
            </p>
          )}
          <h4 className="text-sm font-bold text-[#2A211B]">{item.name}</h4>
          {item.sku && (
            <p className="text-[11px] font-mono text-[#6F6963]">SKU: {item.sku}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-[#6F6963] pt-0.5">
            {item.color?.name && (
              <span className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full border border-black/20"
                  style={{ backgroundColor: item.color.hex || '#000000' }}
                />
                <span>{item.color.name}</span>
              </span>
            )}
            {item.size && <span>Size: <strong className="text-[#2A211B]">{item.size}</strong></span>}
            <span>Qty: <strong className="text-[#2A211B]">{item.quantity}</strong></span>
          </div>

          <div className="text-xs text-[#6F6963] pt-0.5">
            <span>Price: ₹{unitPriceRupees}</span>
            {item.unitMrp > item.unitPrice && (
              <span className="ml-2 line-through text-[11px]">₹{unitMrpRupees}</span>
            )}
            {item.discountPercent > 0 && (
              <span className="ml-2 text-emerald-700 font-semibold text-[11px]">
                ({item.discountPercent}% OFF)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Line Subtotal */}
      <div className="text-left sm:text-right w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E7DED5] flex sm:flex-col justify-between sm:justify-center items-center sm:items-end">
        <span className="text-[11px] text-[#6F6963] sm:hidden">Item Subtotal:</span>
        <div>
          <p className="text-sm font-bold text-[#2A211B]">₹{lineSubtotalRupees}</p>
          {item.lineSavings > 0 && (
            <p className="text-[11px] text-emerald-700 font-semibold">
              Saved ₹{lineSavingsRupees}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
