import mongoose from 'mongoose';
import Review from './review.model.js';
import Product from '../products/product.model.js';
import Order from '../orders/order.model.js';
import User from '../users/user.model.js';

class ReviewService {
  /**
   * Recalculate and persist average rating and count on the Product model
   * @param {string|mongoose.Types.ObjectId} productId
   * @returns {Promise<{ average: number, count: number }>}
   */
  async recalculateProductRatings(productId) {
    const validProductId = new mongoose.Types.ObjectId(productId);

    const stats = await Review.aggregate([
      {
        $match: {
          productId: validProductId,
          status: 'APPROVED',
        },
      },
      {
        $group: {
          _id: '$productId',
          count: { $sum: 1 },
          avgRating: { $avg: '$rating' },
        },
      },
    ]);

    const count = stats[0]?.count || 0;
    const average = stats[0]?.avgRating
      ? Math.round(stats[0].avgRating * 10) / 10
      : 0;

    await Product.updateOne(
      { _id: validProductId },
      {
        $set: {
          'ratings.average': average,
          'ratings.count': count,
        },
      }
    );

    return { average, count };
  }

  /**
   * Aggregate star rating distribution and percentages for a product
   * @param {string|mongoose.Types.ObjectId} productId
   * @returns {Promise<object>}
   */
  async getRatingBreakdown(productId) {
    const validProductId = new mongoose.Types.ObjectId(productId);

    const [distributionStats, product] = await Promise.all([
      Review.aggregate([
        {
          $match: {
            productId: validProductId,
            status: 'APPROVED',
          },
        },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
          },
        },
      ]),
      Product.findById(validProductId).select('ratings').lean(),
    ]);

    const totalCount = product?.ratings?.count || 0;
    const average = product?.ratings?.average || 0;

    const distribution = {
      5: { count: 0, percent: 0 },
      4: { count: 0, percent: 0 },
      3: { count: 0, percent: 0 },
      2: { count: 0, percent: 0 },
      1: { count: 0, percent: 0 },
    };

    distributionStats.forEach((stat) => {
      if (distribution[stat._id]) {
        distribution[stat._id].count = stat.count;
        distribution[stat._id].percent =
          totalCount > 0 ? Math.round((stat.count / totalCount) * 100) : 0;
      }
    });

    return {
      average,
      count: totalCount,
      distribution,
    };
  }

  /**
   * Submit a new customer review with verified purchase verification
   * @param {string} productId
   * @param {object} payload
   * @param {number} payload.rating
   * @param {string} payload.title
   * @param {string} payload.comment
   * @param {string} userId
   * @returns {Promise<Review>}
   */
  async createReview(productId, { rating, title, comment }, userId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      const error = new Error('Invalid product ID');
      error.statusCode = 400;
      error.code = 'INVALID_PRODUCT_ID';
      throw error;
    }

    const product = await Product.findById(productId).select('_id name').lean();
    if (!product) {
      const error = new Error('Product not found');
      error.statusCode = 404;
      error.code = 'PRODUCT_NOT_FOUND';
      throw error;
    }

    // 1. One review per customer per product invariant
    const existingReview = await Review.findOne({ productId, userId });
    if (existingReview) {
      const error = new Error('You have already submitted a review for this product');
      error.statusCode = 409;
      error.code = 'DUPLICATE_REVIEW';
      throw error;
    }

    // 2. Verified Purchase check: User has at least one DELIVERED order containing this product
    const deliveredOrder = await Order.findOne({
      userId,
      'items.productId': productId,
      status: 'DELIVERED',
    }).lean();

    const isVerifiedPurchase = Boolean(deliveredOrder);

    // 3. Create Review
    const review = new Review({
      productId,
      userId,
      rating,
      title,
      comment,
      isVerifiedPurchase,
      status: 'APPROVED',
    });

    await review.save();

    // 4. Recalculate Product Aggregates
    await this.recalculateProductRatings(productId);

    return Review.findById(review._id).populate('userId', 'name').lean();
  }

  /**
   * Retrieve the authenticated customer's review for a given product
   * @param {string} productId
   * @param {string} userId
   * @returns {Promise<{ review: object|null, isEligible: boolean, isVerified: boolean }>}
   */
  async getMyReview(productId, userId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      const error = new Error('Invalid product ID');
      error.statusCode = 400;
      error.code = 'INVALID_PRODUCT_ID';
      throw error;
    }

    const [review, deliveredOrder] = await Promise.all([
      Review.findOne({ productId, userId }).populate('userId', 'name').lean(),
      Order.findOne({
        userId,
        'items.productId': productId,
        status: 'DELIVERED',
      }).lean(),
    ]);

    return {
      review: review || null,
      isEligible: true,
      isVerified: Boolean(deliveredOrder),
    };
  }

  /**
   * Update the authenticated customer's existing review
   * @param {string} productId
   * @param {object} updates
   * @param {string} userId
   * @returns {Promise<Review>}
   */
  async updateMyReview(productId, updates = {}, userId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      const error = new Error('Invalid product ID');
      error.statusCode = 400;
      error.code = 'INVALID_PRODUCT_ID';
      throw error;
    }

    const review = await Review.findOne({ productId, userId });
    if (!review) {
      const error = new Error('Review not found');
      error.statusCode = 404;
      error.code = 'REVIEW_NOT_FOUND';
      throw error;
    }

    if (updates.rating !== undefined) review.rating = updates.rating;
    if (updates.title !== undefined) review.title = updates.title;
    if (updates.comment !== undefined) review.comment = updates.comment;

    await review.save();

    // Recalculate aggregates if rating changed
    await this.recalculateProductRatings(productId);

    return Review.findById(review._id).populate('userId', 'name').lean();
  }

  /**
   * Delete the authenticated customer's review
   * @param {string} productId
   * @param {string} userId
   * @returns {Promise<{ success: boolean }>}
   */
  async deleteMyReview(productId, userId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      const error = new Error('Invalid product ID');
      error.statusCode = 400;
      error.code = 'INVALID_PRODUCT_ID';
      throw error;
    }

    const review = await Review.findOneAndDelete({ productId, userId });
    if (!review) {
      const error = new Error('Review not found');
      error.statusCode = 404;
      error.code = 'REVIEW_NOT_FOUND';
      throw error;
    }

    // Recalculate Product Aggregates
    await this.recalculateProductRatings(productId);

    return { success: true };
  }

  /**
   * Retrieve paginated public reviews for a product with rating filter and breakdown
   * @param {string} productId
   * @param {object} options
   * @returns {Promise<{ reviews: Array, pagination: object, breakdown: object }>}
   */
  async getProductReviews(
    productId,
    { page = 1, limit = 10, rating, sortBy = 'createdAt', sortOrder = 'desc' } = {}
  ) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      const error = new Error('Invalid product ID');
      error.statusCode = 400;
      error.code = 'INVALID_PRODUCT_ID';
      throw error;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const filter = {
      productId: new mongoose.Types.ObjectId(productId),
      status: 'APPROVED',
    };

    if (rating) {
      filter.rating = rating;
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [reviews, total, breakdown] = await Promise.all([
      Review.find(filter)
        .populate('userId', 'name')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Review.countDocuments(filter),
      this.getRatingBreakdown(productId),
    ]);

    const formattedReviews = reviews.map((r) => ({
      _id: r._id,
      id: r._id,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      isVerifiedPurchase: r.isVerifiedPurchase,
      helpfulVotes: r.helpfulVotes,
      customer: {
        id: r.userId?._id || r.userId,
        name: r.userId?.name || 'Verified Buyer',
      },
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return {
      reviews: formattedReviews,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        limit: limitNum,
      },
      breakdown,
    };
  }

  /**
   * Retrieve paginated reviews for the admin moderation dashboard
   * @param {object} options
   * @returns {Promise<{ reviews: Array, pagination: object, metrics: object }>}
   */
  async getAdminReviews({
    page = 1,
    limit = 20,
    status,
    productId,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      filter.productId = new mongoose.Types.ObjectId(productId);
    }

    if (search && search.trim().length > 0) {
      const sanitizedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(sanitizedSearch, 'i');

      const matchedUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }],
      })
        .select('_id')
        .lean();

      const userIds = matchedUsers.map((u) => u._id);

      filter.$or = [
        { title: searchRegex },
        { comment: searchRegex },
        ...(userIds.length > 0 ? [{ userId: { $in: userIds } }] : []),
      ];
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [reviews, total, metricsAggregation] = await Promise.all([
      Review.find(filter)
        .populate('userId', 'name email')
        .populate('productId', 'name slug images brand')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Review.countDocuments(filter),
      Review.aggregate([
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, 1, 0] } },
            hidden: { $sum: { $cond: [{ $eq: ['$status', 'HIDDEN'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
            verifiedPurchases: { $sum: { $cond: ['$isVerifiedPurchase', 1, 0] } },
          },
        },
      ]),
    ]);

    const metrics = metricsAggregation[0] || {
      totalReviews: 0,
      approved: 0,
      hidden: 0,
      rejected: 0,
      verifiedPurchases: 0,
    };
    delete metrics._id;

    return {
      reviews,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
        limit: limitNum,
      },
      metrics,
    };
  }

  /**
   * Moderate review status by admin (e.g. APPROVED, HIDDEN, REJECTED)
   * @param {string} reviewId
   * @param {string} status
   * @returns {Promise<Review>}
   */
  async updateReviewStatus(reviewId, status) {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      const error = new Error('Invalid review ID');
      error.statusCode = 400;
      error.code = 'INVALID_REVIEW_ID';
      throw error;
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      const error = new Error('Review not found');
      error.statusCode = 404;
      error.code = 'REVIEW_NOT_FOUND';
      throw error;
    }

    review.status = status;
    await review.save();

    // Recalculate product rating aggregates (hidden/rejected reviews are excluded)
    await this.recalculateProductRatings(review.productId);

    return Review.findById(review._id)
      .populate('userId', 'name email')
      .populate('productId', 'name slug images brand')
      .lean();
  }

  /**
   * Hard delete review by admin
   * @param {string} reviewId
   * @returns {Promise<{ success: boolean }>}
   */
  async deleteReviewByAdmin(reviewId) {
    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      const error = new Error('Invalid review ID');
      error.statusCode = 400;
      error.code = 'INVALID_REVIEW_ID';
      throw error;
    }

    const review = await Review.findByIdAndDelete(reviewId);
    if (!review) {
      const error = new Error('Review not found');
      error.statusCode = 404;
      error.code = 'REVIEW_NOT_FOUND';
      throw error;
    }

    // Recalculate product rating aggregates
    await this.recalculateProductRatings(review.productId);

    return { success: true };
  }
}

export default new ReviewService();
