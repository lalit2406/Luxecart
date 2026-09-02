import mongoose from 'mongoose';
import Cart from '../cart/cart.model.js';
import Address from '../addresses/address.model.js';
import Product from '../products/product.model.js';
import couponService from '../coupons/coupon.service.js';

class CheckoutService {
  /**
   * Prepare and revalidate checkout snapshot for the authenticated customer
   * @param {string} userId
   * @param {object} options
   * @param {string} [options.addressId]
   * @param {string} [options.couponCode]
   * @returns {Promise<object>}
   */
  async prepareCheckout(userId, { addressId, couponCode } = {}) {
    // 1. Fetch authenticated user's cart
    const cart = await Cart.findOne({ userId });
    if (!cart || !cart.items || cart.items.length === 0) {
      const error = new Error('Your cart is empty');
      error.statusCode = 400;
      error.code = 'CART_EMPTY';
      throw error;
    }

    // 2. Fetch and validate delivery address
    let address = null;
    if (addressId) {
      if (!mongoose.Types.ObjectId.isValid(addressId)) {
        const error = new Error('Address not found');
        error.statusCode = 404;
        error.code = 'ADDRESS_NOT_FOUND';
        throw error;
      }
      address = await Address.findOne({ _id: addressId, userId }).lean();
      if (!address) {
        const error = new Error('Address not found');
        error.statusCode = 404;
        error.code = 'ADDRESS_NOT_FOUND';
        throw error;
      }
    } else {
      // Find customer default address or most recently created address
      address = await Address.findOne({ userId, isDefault: true }).lean();
      if (!address) {
        address = await Address.findOne({ userId }).sort({ createdAt: -1 }).lean();
      }
      if (!address) {
        const error = new Error('Please add a delivery address to proceed to checkout');
        error.statusCode = 400;
        error.code = 'ADDRESS_REQUIRED';
        throw error;
      }
    }

    // Sanitize address document to remove internal fields
    const sanitizedAddress = {
      _id: address._id.toString(),
      id: address._id.toString(),
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || '',
      landmark: address.landmark || '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country || 'India',
      addressType: address.addressType || 'HOME',
      isDefault: Boolean(address.isDefault),
    };

    // 3. Live Catalog Revalidation
    const productIds = cart.items.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } }).lean();
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const checkoutItems = [];
    const warnings = [];
    let canPlaceOrder = true;

    let subtotalPaise = 0;
    let totalMrpPaise = 0;
    let totalUnits = 0;

    for (const item of cart.items) {
      const product = productMap.get(item.productId.toString());
      const cartItemId = item._id.toString();

      // Case A: Product missing or archived
      if (!product || product.status !== 'ACTIVE') {
        canPlaceOrder = false;
        warnings.push(`Item '${product?.name || 'Product'}' is no longer available.`);
        checkoutItems.push({
          cartItemId,
          productId: item.productId.toString(),
          variantId: item.variantId.toString(),
          name: product?.name || 'Unavailable Product',
          brand: product?.brand || '',
          slug: product?.slug || '',
          sku: 'N/A',
          image: product?.images?.[0]?.url || '',
          color: { name: '', hex: '' },
          size: '',
          quantity: item.quantity,
          unitPrice: 0,
          unitMrp: 0,
          discountPercent: 0,
          lineSubtotal: 0,
          lineMrp: 0,
          lineSavings: 0,
          availableStock: 0,
          isAvailable: false,
          error: 'PRODUCT_NOT_AVAILABLE',
        });
        continue;
      }

      // Case B: Variant missing or deactivated
      const variant = (product.variants || []).find(
        (v) => v._id?.toString() === item.variantId.toString()
      );

      if (!variant || variant.isActive === false) {
        canPlaceOrder = false;
        warnings.push(`The selected variant of '${product.name}' is no longer available.`);
        checkoutItems.push({
          cartItemId,
          productId: product._id.toString(),
          variantId: item.variantId.toString(),
          name: product.name,
          brand: product.brand,
          slug: product.slug,
          sku: variant?.sku || 'N/A',
          image: product.images?.[0]?.url || '',
          color: variant?.attributes?.color || { name: '', hex: '' },
          size: variant?.attributes?.size || '',
          quantity: item.quantity,
          unitPrice: 0,
          unitMrp: 0,
          discountPercent: 0,
          lineSubtotal: 0,
          lineMrp: 0,
          lineSavings: 0,
          availableStock: 0,
          isAvailable: false,
          error: 'VARIANT_NOT_AVAILABLE',
        });
        continue;
      }

      // Case C: Active Variant -> Check stock and compute live pricing
      const stock = variant.inventory?.stock || 0;
      const reserved = variant.inventory?.reserved || 0;
      const availableStock = Math.max(0, stock - reserved);

      const price = variant.price;
      const mrp = variant.mrp || price;

      // Integer paise arithmetic
      const unitPricePaise = Math.round(price * 100);
      const unitMrpPaise = Math.round(mrp * 100);
      const lineSubtotalPaise = unitPricePaise * item.quantity;
      const lineMrpPaise = unitMrpPaise * item.quantity;
      const lineSavingsPaise = Math.max(0, lineMrpPaise - lineSubtotalPaise);
      const discountPercent =
        unitMrpPaise > unitPricePaise
          ? Math.round(((unitMrpPaise - unitPricePaise) / unitMrpPaise) * 100)
          : 0;

      let itemError = null;
      let isItemAvailable = true;

      if (availableStock === 0) {
        canPlaceOrder = false;
        isItemAvailable = false;
        itemError = 'OUT_OF_STOCK';
        warnings.push(`'${product.name}' (${variant.sku}) is currently out of stock.`);
      } else if (availableStock < item.quantity) {
        canPlaceOrder = false;
        isItemAvailable = false;
        itemError = 'INSUFFICIENT_STOCK';
        warnings.push(
          `Only ${availableStock} unit(s) available for '${product.name}'. You have ${item.quantity} in cart.`
        );
      } else {
        // Fully valid item: contribute to totals
        subtotalPaise += lineSubtotalPaise;
        totalMrpPaise += lineMrpPaise;
        totalUnits += item.quantity;
      }

      const primaryImage =
        product.images?.find((img) => img.isPrimary)?.url ||
        product.images?.[0]?.url ||
        '';
      const itemImage = variant.images?.[0] || primaryImage;

      checkoutItems.push({
        cartItemId,
        productId: product._id.toString(),
        variantId: variant._id.toString(),
        name: product.name,
        brand: product.brand,
        slug: product.slug,
        sku: variant.sku,
        image: itemImage,
        color: variant.attributes?.color || { name: '', hex: '' },
        size: variant.attributes?.size || '',
        quantity: item.quantity,
        unitPrice: unitPricePaise,
        unitMrp: unitMrpPaise,
        discountPercent,
        lineSubtotal: lineSubtotalPaise,
        lineMrp: lineMrpPaise,
        lineSavings: lineSavingsPaise,
        availableStock,
        isAvailable: isItemAvailable,
        error: itemError,
      });
    }

    // 4. Financial Calculations in Paise
    const shippingPaise = 0; // Free delivery business rule
    const estimatedTaxPaise = 0; // Tax placeholder
    let couponDiscountPaise = 0;
    let couponSnapshot = null;

    if (couponCode && canPlaceOrder && subtotalPaise > 0) {
      try {
        const couponResult = await couponService.validateAndCalculateCoupon(couponCode, {
          userId,
          cartItems: checkoutItems.filter((i) => i.isAvailable),
          subtotalPaise,
        });
        couponDiscountPaise = couponResult.discountPaise;
        couponSnapshot = {
          code: couponResult.coupon.code,
          discountType: couponResult.coupon.discountType,
          discountValue: couponResult.coupon.discountValue,
          discountAmount: couponDiscountPaise,
          description: couponResult.coupon.description,
        };
      } catch (couponErr) {
        warnings.push(`Coupon warning: ${couponErr.message}`);
      }
    }

    const totalSavingsPaise = Math.max(0, totalMrpPaise - subtotalPaise + couponDiscountPaise);
    const grandTotalPaise = Math.max(0, subtotalPaise + shippingPaise + estimatedTaxPaise - couponDiscountPaise);

    // 5. COD Eligibility
    const payment = {
      method: 'CASH_ON_DELIVERY',
      available: canPlaceOrder,
      reason: canPlaceOrder ? null : 'CHECKOUT_VALIDATION_FAILED',
    };

    return {
      address: sanitizedAddress,
      items: checkoutItems,
      summary: {
        itemCount: checkoutItems.filter((i) => i.isAvailable).length,
        totalUnits,
        totalMrp: totalMrpPaise,
        totalSavings: totalSavingsPaise,
        subtotal: subtotalPaise,
        couponDiscount: couponDiscountPaise,
        coupon: couponSnapshot,
        estimatedTax: estimatedTaxPaise,
        shipping: shippingPaise,
        grandTotal: grandTotalPaise,
      },
      payment,
      canPlaceOrder,
      warnings,
    };
  }
}

export default new CheckoutService();
