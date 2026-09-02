import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters long'],
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Please enter a valid 10-digit Indian mobile number'],
    },
    addressLine1: {
      type: String,
      required: [true, 'Address Line 1 is required'],
      trim: true,
      maxlength: [200, 'Address Line 1 cannot exceed 200 characters'],
    },
    addressLine2: {
      type: String,
      trim: true,
      maxlength: [200, 'Address Line 2 cannot exceed 200 characters'],
      default: '',
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: [100, 'Landmark cannot exceed 100 characters'],
      default: '',
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters'],
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      maxlength: [100, 'State cannot exceed 100 characters'],
    },
    postalCode: {
      type: String,
      required: [true, 'PIN code is required'],
      trim: true,
      match: [/^\d{6}$/, 'Please enter a valid 6-digit Indian PIN code'],
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      default: 'India',
      enum: {
        values: ['India'],
        message: 'LuxeCart currently delivers to India only',
      },
    },
    addressType: {
      type: String,
      enum: {
        values: ['HOME', 'WORK', 'OTHER'],
        message: 'Address type must be HOME, WORK, or OTHER',
      },
      default: 'HOME',
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret.__v;
        delete ret.userId;
        return ret;
      },
    },
  }
);

// Compound index for user addresses
addressSchema.index({ userId: 1, isDefault: -1, createdAt: -1 });

const Address = mongoose.model('Address', addressSchema);
export default Address;
