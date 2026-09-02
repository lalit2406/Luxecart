import React from 'react';
import RatingStars from './RatingStars';
import { CheckCircle2, User, Edit3, Trash2 } from 'lucide-react';

export default function ReviewCard({
  review,
  isOwner = false,
  onEdit = () => {},
  onDelete = () => {},
  deleting = false,
}) {
  if (!review) return null;

  const formattedDate = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-7 space-y-4 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E7DED5] pb-3">
        {/* Customer & Rating Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#F7F3EE] border border-[#E7DED5] flex items-center justify-center text-[#9A6A45] shrink-0 font-bold text-xs">
              {review.customer?.name?.[0] || 'C'}
            </div>
            <span className="font-bold text-xs text-[#2A211B]">
              {review.customer?.name || 'Verified Customer'}
            </span>

            {review.isVerifiedPurchase && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Verified Buyer</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <RatingStars rating={review.rating} size="sm" />
            <span className="text-[11px] text-[#6F6963] font-mono">· {formattedDate}</span>
          </div>
        </div>

        {/* Owner Controls (Edit & Delete) */}
        {isOwner && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-[#F7F3EE] text-[#2A211B] hover:bg-[#E7DED5] text-xs font-semibold transition-colors cursor-pointer"
              title="Edit Review"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#9A6A45]" />
              <span>Edit</span>
            </button>
            <button
              onClick={onDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              title="Delete Review"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{deleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Review Content */}
      <div className="space-y-1.5">
        <h4 className="text-sm font-bold text-[#2A211B]">{review.title}</h4>
        <p className="text-xs text-[#6F6963] leading-relaxed whitespace-pre-line">
          {review.comment}
        </p>
      </div>
    </div>
  );
}
