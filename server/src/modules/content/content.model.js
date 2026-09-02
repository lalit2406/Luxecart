import mongoose from 'mongoose';
import { ALLOWED_CONTENT_TYPES } from './content.constants.js';

const contentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, 'Content type is required'],
      enum: {
        values: ALLOWED_CONTENT_TYPES,
        message: 'Invalid content type: {VALUE}',
      },
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: [500, 'Subtitle cannot exceed 500 characters'],
      default: '',
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    mobileImageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    ctaText: {
      type: String,
      trim: true,
      maxlength: [100, 'CTA text cannot exceed 100 characters'],
      default: '',
    },
    ctaLink: {
      type: String,
      trim: true,
      maxlength: [500, 'CTA link cannot exceed 500 characters'],
      default: '',
    },
    displayOrder: {
      type: Number,
      default: 0,
      min: [0, 'Display order cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    targetCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    targetProductIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for public and admin query optimization
contentSchema.index({ isActive: 1, type: 1, displayOrder: 1 });
contentSchema.index({ isActive: 1, startDate: 1, endDate: 1, displayOrder: 1 });

const Content = mongoose.model('Content', contentSchema);
export default Content;
