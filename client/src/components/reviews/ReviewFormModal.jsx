import React, { useState, useEffect } from 'react';
import RatingStars from './RatingStars';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';

export default function ReviewFormModal({
  isOpen = false,
  onClose = () => {},
  onSubmit = () => {},
  initialData = null,
  loading = false,
  isEdit = false,
  error = null,
}) {
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (initialData) {
      setRating(initialData.rating || 5);
      setTitle(initialData.title || '');
      setComment(initialData.comment || '');
    } else {
      setRating(5);
      setTitle('');
      setComment('');
    }
    setFormError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError(null);

    if (!rating || rating < 1 || rating > 5) {
      setFormError('Please select a star rating from 1 to 5');
      return;
    }

    if (!title.trim()) {
      setFormError('Please enter a review title');
      return;
    }

    if (title.trim().length > 100) {
      setFormError('Review title cannot exceed 100 characters');
      return;
    }

    if (!comment.trim()) {
      setFormError('Please enter your review comments');
      return;
    }

    if (comment.trim().length > 2000) {
      setFormError('Review comment cannot exceed 2000 characters');
      return;
    }

    onSubmit({
      rating,
      title: title.trim(),
      comment: comment.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-xl space-y-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E7DED5] pb-4">
          <div>
            <h3 className="text-base font-serif font-bold text-[#2A211B]">
              {isEdit ? 'Edit Your Review' : 'Write a Product Review'}
            </h3>
            <p className="text-xs text-[#6F6963] mt-0.5">
              Share your genuine experience with other connoisseurs.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F7F3EE] hover:bg-[#E7DED5] flex items-center justify-center text-[#6F6963] hover:text-[#2A211B] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {(formError || error) && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{formError || error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Star Rating Picker */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#2A211B]">
              Your Overall Rating <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-3 p-3 bg-[#F7F3EE] rounded-2xl border border-[#E7DED5]">
              <RatingStars
                rating={rating}
                interactive={true}
                onChange={(val) => setRating(val)}
                size="lg"
              />
              <span className="text-xs font-bold text-[#9A6A45]">
                {rating === 5
                  ? 'Exceptional'
                  : rating === 4
                  ? 'Very Good'
                  : rating === 3
                  ? 'Average'
                  : rating === 2
                  ? 'Below Expectation'
                  : 'Disappointing'}
              </span>
            </div>
          </div>

          {/* Title Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold uppercase tracking-wider text-[#2A211B]">
                Review Title <span className="text-red-500">*</span>
              </label>
              <span className="text-[#6F6963] text-[11px] font-mono">
                {title.length}/100
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Magnificent craftsmanship and pure silk feel"
              maxLength={100}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:bg-white focus:outline-hidden focus:border-[#9A6A45] text-xs transition-colors"
            />
          </div>

          {/* Comment Textarea */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold uppercase tracking-wider text-[#2A211B]">
                Detailed Review <span className="text-red-500">*</span>
              </label>
              <span className="text-[#6F6963] text-[11px] font-mono">
                {comment.length}/2000
              </span>
            </div>
            <textarea
              rows={5}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you like or dislike? How is the fit, material quality, and finishing?"
              maxLength={2000}
              className="w-full px-4 py-2.5 rounded-xl border border-[#E7DED5] bg-[#F7F3EE] focus:bg-white focus:outline-hidden focus:border-[#9A6A45] text-xs transition-colors resize-none leading-relaxed"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E7DED5]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-[#F7F3EE] hover:bg-[#E7DED5] text-xs font-semibold text-[#2A211B] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-[#2A211B] hover:bg-[#9A6A45] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Submitting...' : isEdit ? 'Update Review' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
