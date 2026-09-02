import React, { useState } from 'react';
import { Star } from 'lucide-react';

export default function RatingStars({
  rating = 0,
  interactive = false,
  onChange = () => {},
  size = 'md',
  showScore = false,
}) {
  const [hoverRating, setHoverRating] = useState(0);

  const starSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };

  const effectiveRating = interactive && hoverRating > 0 ? hoverRating : rating;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= effectiveRating;

          return (
            <button
              key={star}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onChange(star)}
              onMouseEnter={() => interactive && setHoverRating(star)}
              onMouseLeave={() => interactive && setHoverRating(0)}
              aria-label={interactive ? `Rate ${star} out of 5 stars` : undefined}
              className={`${
                interactive ? 'cursor-pointer hover:scale-110 transition-transform p-0.5' : 'cursor-default'
              }`}
            >
              <Star
                className={`${starSizes[size] || starSizes.md} transition-colors ${
                  isFilled
                    ? 'fill-amber-400 text-amber-400'
                    : 'fill-transparent text-[#E7DED5]'
                }`}
              />
            </button>
          );
        })}
      </div>

      {showScore && (
        <span className="text-xs font-bold text-[#2A211B] ml-1">
          {Number(rating).toFixed(1)}
        </span>
      )}
    </div>
  );
}
