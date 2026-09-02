import mongoose from 'mongoose';

const ancestorSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      minlength: [2, 'Category name must be at least 2 characters long'],
      maxlength: [80, 'Category name cannot exceed 80 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Category slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    ancestors: {
      type: [ancestorSchema],
      default: [],
    },
    level: {
      type: Number,
      default: 0,
      min: [0, 'Level cannot be negative'],
      max: [3, 'Category hierarchy cannot exceed 3 levels deep'],
    },
    image: {
      url: { type: String, default: '' },
      alt: { type: String, default: '' },
      publicId: { type: String, default: '' },
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    seo: {
      metaTitle: { type: String, trim: true, maxlength: 100 },
      metaDescription: { type: String, trim: true, maxlength: 200 },
      keywords: [{ type: String, trim: true }],
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

// Compound Indexes for fast hierarchy and sorting lookups
categorySchema.index({ parentId: 1, displayOrder: 1, isActive: 1 });
categorySchema.index({ 'ancestors._id': 1 });

const Category = mongoose.model('Category', categorySchema);

export default Category;
