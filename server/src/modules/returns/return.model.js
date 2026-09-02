import mongoose from 'mongoose';

/**
 * Return Item subdocument schema preserving historical order snapshots
 */
const returnItemSchema = new mongoose.Schema(
  {
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Order item ID is required'],
    },
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
      default: '',
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
    purchasedQuantity: {
      type: Number,
      required: [true, 'Purchased quantity is required'],
      min: [1, 'Purchased quantity must be at least 1'],
    },
    requestedQuantity: {
      type: Number,
      required: [true, 'Requested return quantity is required'],
      min: [1, 'Requested return quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price in paise is required'],
      min: [0, 'Unit price cannot be negative'],
    },
    calculatedRefundAmount: {
      type: Number,
      required: [true, 'Calculated refund amount in paise is required'],
      min: [0, 'Calculated refund amount cannot be negative'],
    },
    reason: {
      type: String,
      required: [true, 'Return reason is required'],
      enum: {
        values: [
          'WRONG_PRODUCT',
          'DAMAGED_PRODUCT',
          'DEFECTIVE_PRODUCT',
          'SIZE_FIT_ISSUE',
          'NOT_AS_EXPECTED',
          'OTHER',
        ],
        message: '{VALUE} is not a valid return reason',
      },
    },
    customerNote: {
      type: String,
      trim: true,
      maxlength: [500, 'Customer note cannot exceed 500 characters'],
      default: '',
    },
    itemStatus: {
      type: String,
      enum: {
        values: ['PENDING', 'ACCEPTED', 'REJECTED', 'RESTOCKED'],
        message: '{VALUE} is not a valid return item status',
      },
      default: 'PENDING',
    },
  },
  { _id: true }
);

/**
 * Return Status History event subdocument schema
 */
const returnStatusHistoryEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: {
        values: ['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'RECEIVED', 'REFUNDED', 'REJECTED'],
        message: '{VALUE} is not a valid return status',
      },
      required: [true, 'Status is required for return status history event'],
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
      maxlength: [500, 'Status note cannot exceed 500 characters'],
      default: '',
    },
  },
  { _id: true }
);

/**
 * Pickup address snapshot subdocument schema
 */
const pickupAddressSchema = new mongoose.Schema(
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
  },
  { _id: false }
);

/**
 * Pickup logistics details subdocument schema
 */
const pickupDetailsSchema = new mongoose.Schema(
  {
    courierName: { type: String, trim: true, default: '' },
    trackingNumber: { type: String, trim: true, default: '' },
    scheduledDate: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * Refund financial recording subdocument schema
 */
const refundDetailsSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: {
        values: ['COD_CASH_REFUND', 'BANK_TRANSFER', 'STORE_CREDIT'],
        message: '{VALUE} is not a valid refund method',
      },
      default: 'COD_CASH_REFUND',
    },
    referenceNumber: { type: String, trim: true, default: '' },
    refundedAt: { type: Date, default: null },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { _id: false }
);

/**
 * Root Return Schema
 */
const returnSchema = new mongoose.Schema(
  {
    returnNumber: {
      type: String,
      required: [true, 'Return number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
      index: true,
    },
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
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
    items: {
      type: [returnItemSchema],
      required: [true, 'Return items are required'],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'Return must contain at least one item',
      },
    },
    totalRequestedUnits: {
      type: Number,
      required: [true, 'Total requested units is required'],
      min: [1, 'Total requested units must be at least 1'],
    },
    totalRefundAmount: {
      type: Number,
      required: [true, 'Total refund amount in paise is required'],
      min: [0, 'Total refund amount cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: ['REQUESTED', 'APPROVED', 'PICKUP_SCHEDULED', 'RECEIVED', 'REFUNDED', 'REJECTED'],
        message: '{VALUE} is not a valid return status',
      },
      default: 'REQUESTED',
      index: true,
    },
    pickupAddress: {
      type: pickupAddressSchema,
      required: [true, 'Pickup address snapshot is required'],
    },
    pickupDetails: {
      type: pickupDetailsSchema,
      default: () => ({}),
    },
    refundDetails: {
      type: refundDetailsSchema,
      default: () => ({}),
    },
    inventoryRestored: {
      type: Boolean,
      default: false,
      index: true,
    },
    statusHistory: {
      type: [returnStatusHistoryEventSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes for high-frequency queries
returnSchema.index({ status: 1, createdAt: -1 });
returnSchema.index({ status: 1, updatedAt: -1 });
returnSchema.index({ userId: 1, createdAt: -1 });
returnSchema.index({ orderNumber: 1, status: 1 });
returnSchema.index({ orderId: 1, status: 1 });

const Return = mongoose.model('Return', returnSchema);

export default Return;
