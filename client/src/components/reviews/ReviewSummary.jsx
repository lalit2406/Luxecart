import React from 'react';
import RatingStars from './RatingStars';
import { PenSquare, Star, Sparkles } from 'lucide-react';

export default function ReviewSummary({
  breakdown = {},
  onWriteReview = () => {},
  hasReviewed = false,
  isLoggedIn = false,
  selectedRatingFilter = null,
  onFilterRating = () => {},
}) {
  const average = breakdown.average || 0;
  const count = breakdown.count || 0;
  const distribution = breakdown.distribution || {
    5: { count: 0, percent: 0 },
    4: { count: 0, percent: 0 },
    3: { count: 0, percent: 0 },
    2: { count: 0, percent: 0 },
    1: { count: 0, percent: 0 },
  };

  return (
    <div className="bg-[#F7F3EE] border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        {/* Left Column: Big Average Score */}
        <div className="md:col-span-4 text-center md:text-left space-y-3 border-b md:border-b-0 md:border-r border-[#E7DED5] pb-6 md:pb-0 md:pr-6">
          <div className="flex items-baseline justify-center md:justify-start gap-2">
            <span className="text-4xl sm:text-5xl font-serif font-bold text-[#2A211B]">
              {average.toFixed(1)}
            </span>
            <span className="text-sm font-semibold text-[#6F6963]">/ 5.0</span>
          </div>

          <div className="flex justify-center md:justify-start">
            <RatingStars rating={average} size="md" />
          </div>

          <p className="text-xs text-[#6F6963]">
            Based on <strong className="text-[#2A211B]">{count}</strong> verified customer {count === 1 ? 'review' : 'reviews'}
          </p>

          <button
            onClick={onWriteReview}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors shadow-xs cursor-pointer mt-2"
          >
            <PenSquare className="w-4 h-4" />
            <span>{hasReviewed ? 'Edit Your Review' : 'Write a Review'}</span>
          </button>
        </div>

        {/* Right Column: Star Breakdown Progress Bars */}
        <div className="md:col-span-8 space-y-2.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const data = distribution[star] || { count: 0, percent: 0 };
            const isSelected = selectedRatingFilter === star;

            return (
              <button
                key={star}
                type="button"
                onClick={() => onFilterRating(isSelected ? null : star)}
                className={`w-full flex items-center gap-3 text-xs p-1.5 rounded-xl transition-colors cursor-pointer text-left ${
                  isSelected ? 'bg-white shadow-xs' : 'hover:bg-white/60'
                }`}
              >
                <div className="flex items-center gap-1 w-12 shrink-0 font-bold text-[#2A211B]">
                  <span>{star}</span>
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                </div>

                <div className="flex-1 h-2.5 rounded-full bg-[#E7DED5] overflow-hidden">
                  <div
                    className="h-full bg-[#9A6A45] rounded-full transition-all duration-500"
                    style={{ width: `${data.percent}%` }}
                  />
                </div>

                <span className="w-16 text-right text-[11px] text-[#6F6963] font-mono shrink-0">
                  {data.count} ({data.percent}%)
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
