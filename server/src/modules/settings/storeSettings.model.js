import mongoose from 'mongoose';

export const SINGLETON_KEY = 'STORE_SETTINGS_PRIMARY';

const storeSettingsSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: SINGLETON_KEY,
      immutable: true,
    },
    storeName: {
      type: String,
      required: true,
      trim: true,
      default: 'LuxeCart',
      maxlength: 100,
    },
    tagline: {
      type: String,
      trim: true,
      default: 'Curated Luxury Fashion & Lifestyle',
      maxlength: 250,
    },
    logoUrlLight: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    logoUrlDark: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    faviconUrl: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    supportEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      maxlength: 150,
    },
    supportPhone: {
      type: String,
      trim: true,
      default: '',
      maxlength: 30,
    },
    operatingHours: {
      type: String,
      trim: true,
      default: '',
      maxlength: 100,
    },
    address: {
      street: { type: String, trim: true, default: '', maxlength: 200 },
      city: { type: String, trim: true, default: '', maxlength: 100 },
      state: { type: String, trim: true, default: '', maxlength: 100 },
      postalCode: { type: String, trim: true, default: '', maxlength: 20 },
      country: { type: String, trim: true, default: '', maxlength: 50 },
    },
    currency: {
      code: { type: String, default: 'INR', immutable: true },
      symbol: { type: String, default: '₹', immutable: true },
      name: { type: String, default: 'Indian Rupee' },
      locale: { type: String, default: 'en-IN' },
    },
    shipping: {
      standardFeePaise: {
        type: Number,
        required: true,
        default: 20000, // ₹200
        min: 0,
      },
      enableFreeShippingThreshold: {
        type: Boolean,
        default: false,
      },
      freeShippingThresholdPaise: {
        type: Number,
        default: 500000, // ₹5,000
        min: 0,
      },
      deliveryEstimateDays: {
        min: { type: Number, default: 3, min: 1, max: 60 },
        max: { type: Number, default: 7, min: 1, max: 60 },
      },
    },
    payment: {
      isCodEnabled: {
        type: Boolean,
        default: true,
      },
      maxCodOrderPaise: {
        type: Number,
        default: 10000000, // ₹1,00,000
        min: 0,
      },
    },
    returns: {
      isReturnsEnabled: {
        type: Boolean,
        default: true,
      },
      returnWindowDays: {
        type: Number,
        default: 7,
        min: 0,
        max: 90,
      },
    },
    maintenance: {
      isMaintenanceMode: {
        type: Boolean,
        default: false,
      },
      maintenanceMessage: {
        type: String,
        trim: true,
        default: 'The store is currently undergoing scheduled maintenance. Please check back shortly.',
        maxlength: 500,
      },
    },
    socialLinks: {
      instagram: { type: String, trim: true, default: '', maxlength: 300 },
      facebook: { type: String, trim: true, default: '', maxlength: 300 },
      twitter: { type: String, trim: true, default: '', maxlength: 300 },
      pinterest: { type: String, trim: true, default: '', maxlength: 300 },
    },
    seo: {
      metaTitle: {
        type: String,
        trim: true,
        default: 'LuxeCart — Curated Luxury Fashion & Lifestyle',
        maxlength: 150,
      },
      metaDescription: {
        type: String,
        trim: true,
        default: 'Discover premier luxury fashion, accessories, and curated lifestyle collections on LuxeCart.',
        maxlength: 300,
      },
      keywords: {
        type: [String],
        default: ['luxury fashion', 'designer wear', 'curated apparel', 'premium lifestyle'],
      },
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save guard to enforce singleton pattern and protect immutable fields
storeSettingsSchema.pre('save', function (next) {
  if (this.singletonKey !== SINGLETON_KEY) {
    this.singletonKey = SINGLETON_KEY;
  }
  if (this.currency && this.currency.code !== 'INR') {
    this.currency.code = 'INR';
  }
  if (this.currency && this.currency.symbol !== '₹') {
    this.currency.symbol = '₹';
  }
  // Cash on Delivery is currently the only supported payment method and cannot be disabled
  if (this.payment && this.payment.isCodEnabled === false) {
    this.payment.isCodEnabled = true;
  }
  next();
});

const StoreSettings = mongoose.model('StoreSettings', storeSettingsSchema);

export default StoreSettings;
