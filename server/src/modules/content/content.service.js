import mongoose from 'mongoose';
import Content from './content.model.js';
import Category from '../categories/category.model.js';
import Product from '../products/product.model.js';
import { CONTENT_TYPES } from './content.constants.js';

class ContentService {
  /**
   * Retrieve active, non-expired storefront homepage content
   * @returns {Promise<object>}
   */
  async getPublicHomepageContent() {
    const now = new Date();
    const filter = {
      isActive: true,
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      ],
    };

    const items = await Content.find(filter)
      .sort({ displayOrder: 1, createdAt: 1 })
      .populate('targetCategoryId', 'name slug')
      .populate({
        path: 'targetProductIds',
        match: { status: 'ACTIVE' },
        select: 'name slug brand status variants category',
      })
      .lean();

    const sanitizePublicItem = (item) => ({
      id: item._id,
      type: item.type,
      title: item.title,
      subtitle: item.subtitle || '',
      imageUrl: item.imageUrl || '',
      mobileImageUrl: item.mobileImageUrl || '',
      ctaText: item.ctaText || '',
      ctaLink: item.ctaLink || '',
      displayOrder: item.displayOrder,
      targetCategory: item.targetCategoryId
        ? {
            id: item.targetCategoryId._id,
            name: item.targetCategoryId.name,
            slug: item.targetCategoryId.slug,
          }
        : null,
      targetProducts: Array.isArray(item.targetProductIds)
        ? item.targetProductIds.filter(Boolean).map((p) => {
            const firstActiveVariant = p.variants?.find((v) => v.isActive !== false) || p.variants?.[0];
            return {
              id: p._id,
              name: p.name,
              slug: p.slug,
              brand: p.brand || '',
              price: firstActiveVariant?.price || 0,
              mrp: firstActiveVariant?.mrp || 0,
              thumbnail: firstActiveVariant?.images?.[0] || '',
            };
          })
        : [],
      metadata: item.metadata || {},
    });

    const publicItems = items.map(sanitizePublicItem);

    const announcementBars = publicItems.filter((i) => i.type === CONTENT_TYPES.ANNOUNCEMENT_BAR);
    const heroBanners = publicItems.filter((i) => i.type === CONTENT_TYPES.HERO_BANNER);
    const promoBanners = publicItems.filter((i) => i.type === CONTENT_TYPES.PROMO_BANNER);
    const featuredCollections = publicItems.filter((i) => i.type === CONTENT_TYPES.FEATURED_COLLECTION);

    return {
      announcementBars,
      heroBanners,
      promoBanners,
      featuredCollections,
      sections: publicItems,
    };
  }

  /**
   * Retrieve all content items with filtering, search, and pagination for Admin
   * @param {object} params
   * @returns {Promise<object>}
   */
  async getAdminContentList({
    page = 1,
    limit = 20,
    type = null,
    isActive = null,
    search = '',
    sortBy = 'displayOrder',
    sortOrder = 'asc',
  } = {}) {
    const filter = {};

    if (type) {
      filter.type = type;
    }

    if (isActive !== null && isActive !== undefined) {
      filter.isActive = isActive;
    }

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ title: regex }, { subtitle: regex }, { ctaText: regex }];
    }

    const sort = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
      createdAt: 1,
    };

    const skip = (page - 1) * limit;
    const [content, total] = await Promise.all([
      Content.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('targetCategoryId', 'name slug')
        .populate('targetProductIds', 'name slug brand status variants')
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .lean(),
      Content.countDocuments(filter),
    ]);

    return {
      content,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieve a single content document by ID
   * @param {string} id
   * @returns {Promise<object>}
   */
  async getContentById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error('Invalid content ID');
      error.statusCode = 400;
      error.code = 'INVALID_ID';
      throw error;
    }

    const content = await Content.findById(id)
      .populate('targetCategoryId', 'name slug')
      .populate('targetProductIds', 'name slug brand status variants')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean();

    if (!content) {
      const error = new Error('Content not found');
      error.statusCode = 404;
      error.code = 'CONTENT_NOT_FOUND';
      throw error;
    }

    return content;
  }

  /**
   * Create a new content item
   * @param {object} data
   * @param {object} user
   * @returns {Promise<object>}
   */
  async createContent(data, user) {
    // Validate targetCategoryId reference
    if (data.targetCategoryId) {
      const categoryExists = await Category.findById(data.targetCategoryId);
      if (!categoryExists) {
        const error = new Error(`Target category with ID '${data.targetCategoryId}' does not exist`);
        error.statusCode = 400;
        error.code = 'INVALID_CATEGORY_REFERENCE';
        throw error;
      }
    }

    // Validate targetProductIds references
    if (data.targetProductIds && data.targetProductIds.length > 0) {
      const existingProductCount = await Product.countDocuments({
        _id: { $in: data.targetProductIds },
      });
      if (existingProductCount !== data.targetProductIds.length) {
        const error = new Error('One or more referenced target products do not exist');
        error.statusCode = 400;
        error.code = 'INVALID_PRODUCT_REFERENCE';
        throw error;
      }
    }

    const contentDoc = new Content({
      ...data,
      createdBy: user?._id || null,
      updatedBy: user?._id || null,
    });

    await contentDoc.save();

    return this.getContentById(contentDoc._id);
  }

  /**
   * Update an existing content item
   * @param {string} id
   * @param {object} data
   * @param {object} user
   * @returns {Promise<object>}
   */
  async updateContent(id, data, user) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error('Invalid content ID');
      error.statusCode = 400;
      error.code = 'INVALID_ID';
      throw error;
    }

    const contentDoc = await Content.findById(id);
    if (!contentDoc) {
      const error = new Error('Content not found');
      error.statusCode = 404;
      error.code = 'CONTENT_NOT_FOUND';
      throw error;
    }

    // Validate targetCategoryId reference
    if (data.targetCategoryId) {
      const categoryExists = await Category.findById(data.targetCategoryId);
      if (!categoryExists) {
        const error = new Error(`Target category with ID '${data.targetCategoryId}' does not exist`);
        error.statusCode = 400;
        error.code = 'INVALID_CATEGORY_REFERENCE';
        throw error;
      }
    }

    // Validate targetProductIds references
    if (data.targetProductIds && data.targetProductIds.length > 0) {
      const existingProductCount = await Product.countDocuments({
        _id: { $in: data.targetProductIds },
      });
      if (existingProductCount !== data.targetProductIds.length) {
        const error = new Error('One or more referenced target products do not exist');
        error.statusCode = 400;
        error.code = 'INVALID_PRODUCT_REFERENCE';
        throw error;
      }
    }

    Object.assign(contentDoc, data);
    contentDoc.updatedBy = user?._id || null;

    await contentDoc.save();

    return this.getContentById(contentDoc._id);
  }

  /**
   * Toggle active state of a content item
   * @param {string} id
   * @param {boolean} isActive
   * @param {object} user
   * @returns {Promise<object>}
   */
  async toggleContentStatus(id, isActive, user) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error('Invalid content ID');
      error.statusCode = 400;
      error.code = 'INVALID_ID';
      throw error;
    }

    const contentDoc = await Content.findById(id);
    if (!contentDoc) {
      const error = new Error('Content not found');
      error.statusCode = 404;
      error.code = 'CONTENT_NOT_FOUND';
      throw error;
    }

    contentDoc.isActive = isActive;
    contentDoc.updatedBy = user?._id || null;

    await contentDoc.save();

    return this.getContentById(contentDoc._id);
  }

  /**
   * Delete a content item
   * @param {string} id
   * @returns {Promise<object>}
   */
  async deleteContent(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = new Error('Invalid content ID');
      error.statusCode = 400;
      error.code = 'INVALID_ID';
      throw error;
    }

    const contentDoc = await Content.findById(id);
    if (!contentDoc) {
      const error = new Error('Content not found');
      error.statusCode = 404;
      error.code = 'CONTENT_NOT_FOUND';
      throw error;
    }

    await Content.deleteOne({ _id: id });

    return { id, deleted: true };
  }

  /**
   * Reorder a list of content items sequentially
   * @param {Array<string>} orderedIds
   * @param {string} [type]
   * @param {object} user
   * @returns {Promise<object>}
   */
  async reorderContent(orderedIds, type = null, user) {
    const existingDocs = await Content.find({ _id: { $in: orderedIds } }).lean();

    if (existingDocs.length !== orderedIds.length) {
      const error = new Error('One or more content IDs do not exist in the database');
      error.statusCode = 400;
      error.code = 'CONTENT_REORDER_NOT_FOUND';
      throw error;
    }

    if (type) {
      const hasMismatch = existingDocs.some((doc) => doc.type !== type);
      if (hasMismatch) {
        const error = new Error(`All reordered items must match the specified type '${type}'`);
        error.statusCode = 400;
        error.code = 'CONTENT_TYPE_MISMATCH';
        throw error;
      }
    }

    const bulkOps = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: {
          $set: {
            displayOrder: index,
            updatedBy: user?._id || null,
          },
        },
      },
    }));

    await Content.bulkWrite(bulkOps);

    const updatedDocs = await Content.find({ _id: { $in: orderedIds } })
      .sort({ displayOrder: 1 })
      .lean();

    return {
      reorderedCount: updatedDocs.length,
      items: updatedDocs,
    };
  }
}

export const contentService = new ContentService();
export default contentService;
