import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      uppercase: true,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
      default: null,
    },
    attributes: {
      color: {
        name: { type: String, trim: true, default: '' },
        hex: { type: String, trim: true, default: '' },
      },
      size: { type: String, trim: true, default: '' },
      custom: {
        type: Map,
        of: String,
        default: {},
      },
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [1, 'Price must be at least ₹1'],
    },
    mrp: {
      type: Number,
      required: [true, 'MRP is required'],
      min: [1, 'MRP must be at least ₹1'],
    },
    inventory: {
      stock: {
        type: Number,
        required: true,
        min: [0, 'Stock cannot be negative'],
        default: 0,
      },
      reserved: {
        type: Number,
        default: 0,
        min: [0, 'Reserved quantity cannot be negative'],
      },
      lowStockThreshold: {
        type: Number,
        default: 5,
        min: 0,
      },
    },
    weightInGrams: {
      type: Number,
      default: 250,
      min: 0,
    },
    dimensionsInCm: {
      length: { type: Number, default: 0 },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
    },
    images: [{ type: String, trim: true }],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

const specificationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const productImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    format: { type: String, trim: true, default: null },
    bytes: { type: Number, default: null },
    alt: { type: String, default: '', trim: true },
    isPrimary: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    color: { type: String, trim: true, default: '' },
  }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [150, 'Product name cannot exceed 150 characters'],
      index: true,
    },
    slug: {
      type: String,
      required: [true, 'Product slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    brand: {
      type: String,
      required: [true, 'Brand name is required'],
      trim: true,
      maxlength: [80, 'Brand name cannot exceed 80 characters'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [300, 'Short description cannot exceed 300 characters'],
      default: '',
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Product category is required'],
      index: true,
    },
    categoryTree: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        index: true,
      },
    ],
    gender: {
      type: String,
      enum: {
        values: ['MEN', 'WOMEN', 'UNISEX', 'BOYS', 'GIRLS'],
        message: '{VALUE} is not a valid gender category',
      },
      default: 'UNISEX',
      index: true,
    },
    images: {
      type: [productImageSchema],
      default: [],
    },
    specifications: {
      type: [specificationSchema],
      default: [],
    },
    variants: {
      type: [variantSchema],
      default: [],
    },
    priceSummary: {
      minPrice: { type: Number, default: 0, index: true },
      maxPrice: { type: Number, default: 0 },
      minMrp: { type: Number, default: 0 },
      maxMrp: { type: Number, default: 0 },
      maxDiscountPercent: { type: Number, default: 0, index: true },
      hasStock: { type: Boolean, default: false, index: true },
      totalStock: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: {
        values: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
        message: '{VALUE} is not a valid product status',
      },
      default: 'DRAFT',
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    isNewArrival: {
      type: Boolean,
      default: false,
      index: true,
    },
    isBestseller: {
      type: Boolean,
      default: false,
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5, index: true },
      count: { type: Number, default: 0, min: 0 },
    },
    searchKeywords: {
      type: String,
      select: false,
    },
    seo: {
      metaTitle: { type: String, trim: true, maxlength: 100 },
      metaDescription: { type: String, trim: true, maxlength: 200 },
      keywords: [{ type: String, trim: true }],
    },
    model3d: {
      url: {
        type: String,
        trim: true,
        default: null,
        validate: {
          validator: function (v) {
            if (!v) return true;
            return /^(https:\/\/|\/|\.\/)[^\s]+$/i.test(v);
          },
          message: '3D model URL must use secure HTTPS protocol or valid relative path',
        },
      },
      format: {
        type: String,
        trim: true,
        uppercase: true,
        enum: {
          values: ['GLB', 'GLTF', null],
          message: '{VALUE} is not a supported 3D model format. Allowed: GLB, GLTF',
        },
        default: null,
      },
      posterUrl: {
        type: String,
        trim: true,
        default: null,
        validate: {
          validator: function (v) {
            if (!v) return true;
            return /^(https:\/\/|\/|\.\/)[^\s]+$/i.test(v);
          },
          message: '3D poster URL must use secure HTTPS protocol or valid relative path',
        },
      },
      enabled: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.searchKeywords;
        return ret;
      },
    },
  }
);

/**
 * Recompute priceSummary and stock flags from active variants
 */
productSchema.methods.recalculatePriceSummary = function () {
  const activeVariants = (this.variants || []).filter((v) => v.isActive !== false);

  if (activeVariants.length === 0) {
    this.priceSummary = {
      minPrice: 0,
      maxPrice: 0,
      minMrp: 0,
      maxMrp: 0,
      maxDiscountPercent: 0,
      hasStock: false,
      totalStock: 0,
    };
    return;
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let minMrp = Infinity;
  let maxMrp = -Infinity;
  let maxDiscountPercent = 0;
  let totalStock = 0;

  for (const v of activeVariants) {
    if (v.price < minPrice) minPrice = v.price;
    if (v.price > maxPrice) maxPrice = v.price;
    if (v.mrp < minMrp) minMrp = v.mrp;
    if (v.mrp > maxMrp) maxMrp = v.mrp;

    if (v.mrp > 0 && v.mrp >= v.price) {
      const discount = Math.round(((v.mrp - v.price) / v.mrp) * 100);
      if (discount > maxDiscountPercent) {
        maxDiscountPercent = discount;
      }
    }

    totalStock += v.inventory?.stock || 0;
  }

  this.priceSummary = {
    minPrice: minPrice === Infinity ? 0 : minPrice,
    maxPrice: maxPrice === -Infinity ? 0 : maxPrice,
    minMrp: minMrp === Infinity ? 0 : minMrp,
    maxMrp: maxMrp === -Infinity ? 0 : maxMrp,
    maxDiscountPercent,
    hasStock: totalStock > 0,
    totalStock,
  };
};

/**
 * Generate concatenated search keywords for text index
 */
productSchema.methods.generateSearchKeywords = function () {
  const tokens = [
    this.name || '',
    this.brand || '',
    this.shortDescription || '',
    ...(this.tags || []),
    ...(this.specifications || []).map((s) => `${s.name} ${s.value}`),
    ...(this.variants || []).map((v) => `${v.sku} ${v.attributes?.color?.name || ''} ${v.attributes?.size || ''}`),
  ];

  this.searchKeywords = tokens
    .join(' ')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Pre-save synchronous hook in Mongoose 9
 */
productSchema.pre('save', function () {
  // In-document duplicate SKU detection
  if (this.variants && this.variants.length > 0) {
    const skuSet = new Set();
    for (const v of this.variants) {
      if (!v.sku) continue;
      const normalizedSku = v.sku.toString().trim().toUpperCase();
      v.sku = normalizedSku;

      if (skuSet.has(normalizedSku)) {
        throw new Error(`Duplicate SKU '${normalizedSku}' found within the same product.`);
      }
      skuSet.add(normalizedSku);

      // Price integrity check
      if (v.price && v.mrp && v.price > v.mrp) {
        throw new Error(`Variant ${normalizedSku}: Selling price (₹${v.price}) cannot exceed MRP (₹${v.mrp}).`);
      }
    }
  }

  this.recalculatePriceSummary();
  this.generateSearchKeywords();
});

// Indexes
productSchema.index({ 'variants.sku': 1 }, { unique: true, sparse: true });
productSchema.index({ status: 1, categoryTree: 1, 'priceSummary.minPrice': 1 });
productSchema.index({ status: 1, 'priceSummary.hasStock': 1, createdAt: -1 });
productSchema.index({ status: 1, isFeatured: 1 });
productSchema.index({ status: 1, isNewArrival: 1 });
productSchema.index({ status: 1, isBestseller: 1 });
productSchema.index({ status: 1, 'ratings.average': -1 });

// Compound Variant Filter Index
productSchema.index({
  status: 1,
  'variants.attributes.color.name': 1,
  'variants.attributes.size': 1,
  'variants.price': 1,
});

// Full-Text Search Index
productSchema.index(
  {
    name: 'text',
    brand: 'text',
    tags: 'text',
    searchKeywords: 'text',
  },
  {
    weights: {
      name: 10,
      brand: 5,
      tags: 3,
      searchKeywords: 1,
    },
    name: 'ProductTextIndex',
  }
);

const Product = mongoose.model('Product', productSchema);

export default Product;
