import mongoose from 'mongoose';
import Coupon from './coupon.model.js';
import Order from '../orders/order.model.js';
import Product from '../products/product.model.js';
import Cart from '../cart/cart.model.js';

class CouponService {
  /**
   * Find coupon by normalized uppercase code
   * @param {string} code
   * @returns {Promise<Coupon|null>}
   */
  async getCouponByCode(code) {
    if (!code || typeof code !== 'string') return null;
    const normalized = code.trim().toUpperCase();
    return Coupon.findOne({ code: normalized });
  }

  /**
   * Authoritatively validate a coupon and calculate eligible discount in paise
   * @param {string} code
   * @param {object} options
   * @param {string|mongoose.Types.ObjectId} options.userId
   * @param {Array} [options.cartItems] - Optional pre-hydrated items; if omitted, fetched from live Cart
   * @param {number} [options.subtotalPaise] - Optional verified subtotal in paise
   * @returns {Promise<{ isValid: boolean, coupon: object, discountPaise: number, eligibleSubtotalPaise: number, originalSubtotalPaise: number, newSubtotalPaise: number }>}
   */
  async validateAndCalculateCoupon(code, { userId, cartItems = null, subtotalPaise = null } = {}) {
    if (!code || typeof code !== 'string') {
      const error = new Error('Coupon code is required');
      error.statusCode = 400;
      error.code = 'COUPON_CODE_REQUIRED';
      throw error;
    }

    const normalizedCode = code.trim().toUpperCase();
    const coupon = await Coupon.findOne({ code: normalizedCode });

    if (!coupon) {
      const error = new Error(`Coupon code '${normalizedCode}' does not exist`);
      error.statusCode = 404;
      error.code = 'COUPON_NOT_FOUND';
      throw error;
    }

    // 1. Status Check
    if (!coupon.isActive) {
      const error = new Error('This coupon is currently inactive');
      error.statusCode = 400;
      error.code = 'COUPON_INACTIVE';
      throw error;
    }

    const now = new Date();

    // 2. Date Window Checks
    if (coupon.startDate && now < coupon.startDate) {
      const error = new Error('This coupon promotion has not started yet');
      error.statusCode = 400;
      error.code = 'COUPON_NOT_STARTED';
      throw error;
    }

    if (coupon.expirationDate && now > coupon.expirationDate) {
      const error = new Error('This coupon has expired');
      error.statusCode = 400;
      error.code = 'COUPON_EXPIRED';
      throw error;
    }

    // 3. Global Usage Limit Check
    if (coupon.totalUsageLimit !== null && coupon.usedCount >= coupon.totalUsageLimit) {
      const error = new Error('This coupon has reached its maximum total usage limit');
      error.statusCode = 400;
      error.code = 'COUPON_USAGE_LIMIT_REACHED';
      throw error;
    }

    // 4. Per-User Limit Check
    if (userId && coupon.perUserLimit) {
      const userUsageCount = await Order.countDocuments({
        userId,
        'coupon.code': normalizedCode,
        status: { $ne: 'CANCELLED' },
      });

      if (userUsageCount >= coupon.perUserLimit) {
        const error = new Error(`You have already reached the maximum usage limit (${coupon.perUserLimit}) for this coupon`);
        error.statusCode = 400;
        error.code = 'USER_COUPON_LIMIT_REACHED';
        throw error;
      }
    }

    // 5. Fetch and Revalidate Cart Items if not passed
    let validatedItems = cartItems;
    let actualSubtotalPaise = subtotalPaise;

    if (!validatedItems || actualSubtotalPaise === null) {
      const cart = await Cart.findOne({ userId });
      if (!cart || !cart.items || cart.items.length === 0) {
        const error = new Error('Your shopping bag is empty');
        error.statusCode = 400;
        error.code = 'CART_EMPTY';
        throw error;
      }

      const productIds = cart.items.map((i) => i.productId);
      const products = await Product.find({ _id: { $in: productIds }, status: 'ACTIVE' }).lean();
      const productMap = new Map(products.map((p) => [p._id.toString(), p]));

      validatedItems = [];
      actualSubtotalPaise = 0;

      for (const item of cart.items) {
        const prod = productMap.get(item.productId.toString());
        if (prod) {
          const variant = prod.variants.find((v) => v._id.toString() === item.variantId.toString());
          if (variant && variant.isActive !== false && variant.inventory?.stock > 0) {
            const qty = Math.min(item.quantity, variant.inventory.stock);
            const lineSubtotal = variant.price * 100 * qty; // in paise
            actualSubtotalPaise += lineSubtotal;
            validatedItems.push({
              productId: prod._id,
              category: prod.category,
              categoryTree: prod.categoryTree || [prod.category],
              quantity: qty,
              pricePaise: variant.price * 100,
              lineSubtotalPaise: lineSubtotal,
            });
          }
        }
      }
    }

    if (!validatedItems || validatedItems.length === 0) {
      const error = new Error('No eligible items available in your shopping bag');
      error.statusCode = 400;
      error.code = 'NO_ELIGIBLE_ITEMS';
      throw error;
    }

    // 6. Category / Product Eligibility Filtering
    const hasProductRestrictions = coupon.eligibleProducts && coupon.eligibleProducts.length > 0;
    const hasCategoryRestrictions = coupon.eligibleCategories && coupon.eligibleCategories.length > 0;

    let eligibleSubtotalPaise = 0;
    let eligibleItemCount = 0;

    for (const item of validatedItems) {
      const pIdStr = item.productId.toString();
      const cIdStr = item.category?.toString();
      const treeIds = (item.categoryTree || []).map((c) => c.toString());

      let isEligible = true;

      if (hasProductRestrictions) {
        const matchesProduct = coupon.eligibleProducts.some((ep) => ep.toString() === pIdStr);
        if (!matchesProduct) isEligible = false;
      }

      if (hasCategoryRestrictions) {
        const matchesCategory = coupon.eligibleCategories.some(
          (ec) => ec.toString() === cIdStr || treeIds.includes(ec.toString())
        );
        if (!matchesCategory) isEligible = false;
      }

      if (isEligible) {
        eligibleSubtotalPaise += item.lineSubtotalPaise || (item.unitPrice * item.quantity);
        eligibleItemCount += item.quantity;
      }
    }

    if (eligibleSubtotalPaise === 0) {
      const error = new Error('This coupon is not applicable to any items in your shopping bag');
      error.statusCode = 400;
      error.code = 'COUPON_NOT_APPLICABLE';
      throw error;
    }

    // 7. Minimum Order Value Check (compared against eligible subtotal or overall subtotal)
    if (coupon.minOrderValue > 0 && actualSubtotalPaise < coupon.minOrderValue) {
      const error = new Error(
        `Minimum order value of ₹${(coupon.minOrderValue / 100).toLocaleString('en-IN')} required for this coupon`
      );
      error.statusCode = 400;
      error.code = 'MIN_ORDER_VALUE_NOT_MET';
      throw error;
    }

    // 8. Authoritative Discount Calculation
    let calculatedDiscountPaise = 0;

    if (coupon.discountType === 'PERCENTAGE') {
      calculatedDiscountPaise = Math.round(eligibleSubtotalPaise * (coupon.discountValue / 100));
      if (coupon.maxDiscountAmount !== null && coupon.maxDiscountAmount > 0) {
        calculatedDiscountPaise = Math.min(calculatedDiscountPaise, coupon.maxDiscountAmount);
      }
    } else if (coupon.discountType === 'FIXED') {
      calculatedDiscountPaise = coupon.discountValue; // Fixed value in paise
    }

    // Hard ceiling: discount cannot exceed eligible subtotal
    calculatedDiscountPaise = Math.min(calculatedDiscountPaise, eligibleSubtotalPaise);

    const newSubtotalPaise = Math.max(0, actualSubtotalPaise - calculatedDiscountPaise);

    return {
      isValid: true,
      coupon: {
        id: coupon._id.toString(),
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minOrderValue: coupon.minOrderValue,
        maxDiscountAmount: coupon.maxDiscountAmount,
        expirationDate: coupon.expirationDate,
      },
      discountPaise: calculatedDiscountPaise,
      eligibleSubtotalPaise,
      originalSubtotalPaise: actualSubtotalPaise,
      newSubtotalPaise,
    };
  }

  /**
   * Atomically reserve coupon usage during order placement
   * @param {string} code
   * @param {mongoose.ClientSession} [session]
   */
  async reserveCouponUsage(code, session = null) {
    if (!code) return null;
    const normalized = code.trim().toUpperCase();

    const query = {
      code: normalized,
      isActive: true,
      $or: [{ totalUsageLimit: null }, { $expr: { $lt: ['$usedCount', '$totalUsageLimit'] } }],
    };

    const options = { returnDocument: 'after' };
    if (session) options.session = session;

    const updated = await Coupon.findOneAndUpdate(
      query,
      { $inc: { usedCount: 1 } },
      options
    );

    if (!updated) {
      const error = new Error('Coupon usage limit reached or coupon has become inactive');
      error.statusCode = 409;
      error.code = 'COUPON_USAGE_CONFLICT';
      throw error;
    }

    return updated;
  }

  /**
   * Atomically rollback coupon usage when an order is cancelled
   * @param {string} code
   * @param {mongoose.ClientSession} [session]
   */
  async rollbackCouponUsage(code, session = null) {
    if (!code) return;
    const normalized = code.trim().toUpperCase();

    const options = {};
    if (session) options.session = session;

    await Coupon.updateOne(
      { code: normalized, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } },
      options
    );
  }

  // ==========================================
  // ADMIN CRUD METHODS
  // ==========================================

  /**
   * Admin: List coupons with search, filters and pagination
   */
  async getAdminCoupons({
    page = 1,
    limit = 20,
    status,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    const now = new Date();

    if (status === 'ACTIVE') {
      filter.isActive = true;
      filter.expirationDate = { $gte: now };
    } else if (status === 'INACTIVE') {
      filter.isActive = false;
    } else if (status === 'EXPIRED') {
      filter.expirationDate = { $lt: now };
    }

    if (search && search.trim().length > 0) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(sanitized, 'i');
      filter.$or = [{ code: searchRegex }, { description: searchRegex }];
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [coupons, total, metricsAgg] = await Promise.all([
      Coupon.find(filter)
        .populate('eligibleCategories', 'name slug')
        .populate('eligibleProducts', 'name slug brand')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Coupon.countDocuments(filter),
      Coupon.aggregate([
        {
          $group: {
            _id: null,
            totalCoupons: { $sum: 1 },
            activeCoupons: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$isActive', true] }, { $gte: ['$expirationDate', now] }] },
                  1,
                  0,
                ],
              },
            },
            expiredCoupons: {
              $sum: {
                $cond: [{ $lt: ['$expirationDate', now] }, 1, 0],
              },
            },
            totalRedemptions: { $sum: '$usedCount' },
          },
        },
      ]),
    ]);

    const metrics = metricsAgg[0] || {
      totalCoupons: 0,
      activeCoupons: 0,
      expiredCoupons: 0,
      totalRedemptions: 0,
    };
    delete metrics._id;

    return {
      coupons,
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
   * Admin: Create a new coupon
   */
  async createCoupon(data) {
    const existing = await Coupon.findOne({ code: data.code });
    if (existing) {
      const error = new Error(`Coupon with code '${data.code}' already exists`);
      error.statusCode = 409;
      error.code = 'DUPLICATE_COUPON_CODE';
      throw error;
    }

    const coupon = new Coupon(data);
    await coupon.save();
    return Coupon.findById(coupon._id)
      .populate('eligibleCategories', 'name slug')
      .populate('eligibleProducts', 'name slug brand')
      .lean();
  }

  /**
   * Admin: Get coupon by ID
   */
  async getCouponById(couponId) {
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      const error = new Error('Invalid coupon ID');
      error.statusCode = 400;
      error.code = 'INVALID_COUPON_ID';
      throw error;
    }

    const coupon = await Coupon.findById(couponId)
      .populate('eligibleCategories', 'name slug')
      .populate('eligibleProducts', 'name slug brand')
      .lean();

    if (!coupon) {
      const error = new Error('Coupon not found');
      error.statusCode = 404;
      error.code = 'COUPON_NOT_FOUND';
      throw error;
    }

    return coupon;
  }

  /**
   * Admin: Update coupon
   */
  async updateCoupon(couponId, updates) {
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      const error = new Error('Invalid coupon ID');
      error.statusCode = 400;
      error.code = 'INVALID_COUPON_ID';
      throw error;
    }

    if (updates.code) {
      const existing = await Coupon.findOne({ code: updates.code, _id: { $ne: couponId } });
      if (existing) {
        const error = new Error(`Coupon code '${updates.code}' is already in use by another coupon`);
        error.statusCode = 409;
        error.code = 'DUPLICATE_COUPON_CODE';
        throw error;
      }
    }

    const coupon = await Coupon.findByIdAndUpdate(couponId, { $set: updates }, { returnDocument: 'after' })
      .populate('eligibleCategories', 'name slug')
      .populate('eligibleProducts', 'name slug brand')
      .lean();

    if (!coupon) {
      const error = new Error('Coupon not found');
      error.statusCode = 404;
      error.code = 'COUPON_NOT_FOUND';
      throw error;
    }

    return coupon;
  }

  /**
   * Admin: Toggle coupon active status
   */
  async toggleCouponStatus(couponId, isActive) {
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      const error = new Error('Invalid coupon ID');
      error.statusCode = 400;
      error.code = 'INVALID_COUPON_ID';
      throw error;
    }

    const coupon = await Coupon.findByIdAndUpdate(
      couponId,
      { $set: { isActive } },
      { returnDocument: 'after' }
    )
      .populate('eligibleCategories', 'name slug')
      .populate('eligibleProducts', 'name slug brand')
      .lean();

    if (!coupon) {
      const error = new Error('Coupon not found');
      error.statusCode = 404;
      error.code = 'COUPON_NOT_FOUND';
      throw error;
    }

    return coupon;
  }

  /**
   * Admin: Hard delete coupon
   */
  async deleteCoupon(couponId) {
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      const error = new Error('Invalid coupon ID');
      error.statusCode = 400;
      error.code = 'INVALID_COUPON_ID';
      throw error;
    }

    const coupon = await Coupon.findByIdAndDelete(couponId);
    if (!coupon) {
      const error = new Error('Coupon not found');
      error.statusCode = 404;
      error.code = 'COUPON_NOT_FOUND';
      throw error;
    }

    return { success: true };
  }
}

export default new CouponService();
