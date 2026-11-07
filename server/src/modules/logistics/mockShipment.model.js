import mongoose from 'mongoose';

/**
 * Checkpoint schema for simulated package transit milestones
 */
const checkpointSchema = new mongoose.Schema(
  {
    milestone: {
      type: String,
      enum: {
        values: [
          'MANIFESTED',
          'PICKED_UP',
          'IN_TRANSIT',
          'OUT_FOR_DELIVERY',
          'DELIVERED',
          'DELIVERY_ATTEMPT_FAILED',
          'RTO_INITIATED',
          'RTO_DELIVERED',
        ],
        message: '{VALUE} is not a valid logistics milestone',
      },
      required: [true, 'Milestone is required'],
    },
    title: {
      type: String,
      required: [true, 'Checkpoint title is required'],
      trim: true,
    },
    location: {
      type: String,
      required: [true, 'Checkpoint location is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Checkpoint description is required'],
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: true }
);

/**
 * Simulated notification schema for mock SMS and Email communications
 */
const simulatedNotificationSchema = new mongoose.Schema(
  {
    channel: {
      type: String,
      enum: ['SMS', 'EMAIL'],
      required: [true, 'Notification channel is required'],
    },
    recipient: {
      type: String,
      required: [true, 'Recipient identifier is required'],
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
      default: '',
    },
    message: {
      type: String,
      required: [true, 'Message body is required'],
      trim: true,
    },
    isSimulated: {
      type: Boolean,
      default: true,
      immutable: true,
    },
    tag: {
      type: String,
      default: '[DEMO SIMULATION]',
      immutable: true,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

/**
 * MockShipment Schema
 * Represents a simulated courier dispatch record isolated from core order pricing.
 */
const mockShipmentSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: [true, 'Order ID is required'],
      unique: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    isSimulated: {
      type: Boolean,
      default: true,
      immutable: true,
    },
    carrier: {
      id: {
        type: String,
        required: [true, 'Carrier ID is required'],
        trim: true,
      },
      name: {
        type: String,
        required: [true, 'Carrier name is required'],
        trim: true,
      },
      serviceType: {
        type: String,
        required: [true, 'Service type is required'],
        trim: true,
      },
    },
    awbNumber: {
      type: String,
      required: [true, 'AWB number is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [
        /^MOCK-[A-Z0-9-]+$/,
        'AWB number must begin with MOCK- and contain only uppercase alphanumeric characters and hyphens',
      ],
      index: true,
    },
    parcel: {
      weightTier: {
        type: String,
        enum: ['500G', '1KG'],
        default: '500G',
        required: true,
      },
      weightGrams: {
        type: Number,
        default: 500,
        required: true,
      },
      dimensionsCm: {
        length: { type: Number, default: 20 },
        width: { type: Number, default: 15 },
        height: { type: Number, default: 10 },
      },
    },
    pricing: {
      customerShippingPaise: {
        type: Number,
        default: 20000,
        immutable: true,
      },
      simulatedCarrierCostPaise: {
        type: Number,
        required: [true, 'Simulated carrier cost is required'],
        min: 0,
      },
      codCollectionPaise: {
        type: Number,
        required: [true, 'COD collection amount is required'],
        min: 0,
      },
    },
    currentMilestone: {
      type: String,
      enum: [
        'MANIFESTED',
        'PICKED_UP',
        'IN_TRANSIT',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'DELIVERY_ATTEMPT_FAILED',
        'RTO_INITIATED',
        'RTO_DELIVERED',
      ],
      default: 'MANIFESTED',
    },
    checkpoints: {
      type: [checkpointSchema],
      default: [],
    },
    simulatedNotifications: {
      type: [simulatedNotificationSchema],
      default: [],
    },
    deliveryEstimate: {
      type: String,
      default: 'Within 7 business days after order confirmation',
      immutable: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const MockShipment = mongoose.models.MockShipment || mongoose.model('MockShipment', mockShipmentSchema);

export default MockShipment;
