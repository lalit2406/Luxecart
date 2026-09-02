import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Variant ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      trim: true,
    },
    image: {
      type: String,
      default: '',
    },
    color: {
      name: { type: String, default: '' },
      hex: { type: String, default: '' },
    },
    size: {
      type: String,
      default: '',
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price in paise is required'],
      min: [0, 'Unit price cannot be negative'],
    },
    unitMrp: {
      type: Number,
      required: [true, 'Unit MRP in paise is required'],
      min: [0, 'Unit MRP cannot be negative'],
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lineSubtotal: {
      type: Number,
      required: [true, 'Line subtotal in paise is required'],
      min: [0, 'Line subtotal cannot be negative'],
    },
    lineMrp: {
      type: Number,
      required: [true, 'Line MRP in paise is required'],
      min: [0, 'Line MRP cannot be negative'],
    },
    lineSavings: {
      type: Number,
      default: 0,
      min: [0, 'Line savings cannot be negative'],
    },
  },
  { _id: true }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, default: '', trim: true },
    landmark: { type: String, default: '', trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, default: 'India', trim: true },
    addressType: { type: String, default: 'HOME' },
  },
  { _id: false }
);

const statusHistoryEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: {
        values: ['PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
        message: '{VALUE} is not a valid order status',
      },
      required: [true, 'Status is required for history event'],
    },
    changedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    note: {
      type: String,
      trim: true,
      maxlength: [500, 'Note cannot exceed 500 characters'],
      default: '',
    },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
        message: '{VALUE} is not a valid order status',
      },
      default: 'PLACED',
      index: true,
    },
    statusHistory: {
      type: [statusHistoryEventSchema],
      default: [],
    },
    payment: {
      method: {
        type: String,
        enum: {
          values: ['CASH_ON_DELIVERY'],
          message: 'Only CASH_ON_DELIVERY is supported',
        },
        default: 'CASH_ON_DELIVERY',
      },
      status: {
        type: String,
        enum: {
          values: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
          message: '{VALUE} is not a valid payment status',
        },
        default: 'PENDING',
      },
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: [true, 'Shipping address snapshot is required'],
    },
    items: {
      type: [orderItemSchema],
      required: [true, 'Order items are required'],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    pricing: {
      totalUnits: { type: Number, required: true, min: 1 },
      itemCount: { type: Number, required: true, min: 1 },
      subtotal: { type: Number, required: true, min: 0 },
      totalMrp: { type: Number, required: true, min: 0 },
      totalSavings: { type: Number, default: 0, min: 0 },
      shipping: { type: Number, default: 0, min: 0 },
      estimatedTax: { type: Number, default: 0, min: 0 },
      couponDiscount: { type: Number, default: 0, min: 0 },
      grandTotal: { type: Number, required: true, min: 0 },
    },
    coupon: {
      code: { type: String, uppercase: true, trim: true, default: null },
      discountType: { type: String, enum: ['PERCENTAGE', 'FIXED', null], default: null },
      discountValue: { type: Number, default: null },
      discountAmount: { type: Number, default: 0, min: 0 },
    },
    idempotencyKey: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ 'coupon.code': 1, userId: 1 });
orderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

const Order = mongoose.model('Order', orderSchema);
export default Order;
