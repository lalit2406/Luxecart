import Category from './category.model.js';
import { generateUniqueSlug } from '../../utils/slugify.js';

class CategoryService {
  /**
   * Helper to compute ancestors and level for a category based on its parent
   * @param {import('mongoose').Types.ObjectId | null} parentId
   * @returns {Promise<{ level: number, ancestors: Array<{ _id: any, name: string, slug: string }> }>}
   */
  async computeAncestors(parentId) {
    if (!parentId) {
      return { level: 0, ancestors: [] };
    }

    const parent = await Category.findById(parentId);
    if (!parent) {
      const error = new Error('Parent category not found');
      error.statusCode = 404;
      error.code = 'PARENT_CATEGORY_NOT_FOUND';
      throw error;
    }

    if (parent.level >= 2) {
      const error = new Error('Maximum category depth exceeded. Cannot nest deeper than 3 levels.');
      error.statusCode = 400;
      error.code = 'MAX_CATEGORY_DEPTH_EXCEEDED';
      throw error;
    }

    const ancestors = [
      ...parent.ancestors,
      {
        _id: parent._id,
        name: parent.name,
        slug: parent.slug,
      },
    ];

    return {
      level: parent.level + 1,
      ancestors,
    };
  }

  /**
   * Check if targetParentId is a descendant of categoryId (circular check)
   * @param {string} categoryId
   * @param {string} targetParentId
   * @returns {Promise<boolean>}
   */
  async isDescendant(categoryId, targetParentId) {
    if (!targetParentId) return false;
    if (categoryId.toString() === targetParentId.toString()) return true;

    const parent = await Category.findById(targetParentId);
    if (!parent) return false;

    return parent.ancestors.some((a) => a._id.toString() === categoryId.toString());
  }

  /**
   * Cascade update all descendants when an ancestor's name, slug, or position changes
   * @param {import('mongoose').Document} category
   */
  async syncDescendants(category) {
    const descendants = await Category.find({ 'ancestors._id': category._id });

    for (const desc of descendants) {
      const { level, ancestors } = await this.computeAncestors(desc.parentId);
      desc.level = level;
      desc.ancestors = ancestors;
      await desc.save();
    }
  }

  /**
   * Create a new category
   * @param {object} data
   * @returns {Promise<Category>}
   */
  async createCategory(data) {
    let slug = data.slug;
    if (!slug) {
      slug = await generateUniqueSlug(Category, data.name);
    } else {
      const existing = await Category.findOne({ slug });
      if (existing) {
        const error = new Error(`Category slug '${slug}' already exists`);
        error.statusCode = 409;
        error.code = 'DUPLICATE_SLUG';
        throw error;
      }
    }

    const { level, ancestors } = await this.computeAncestors(data.parentId);

    const category = new Category({
      ...data,
      slug,
      level,
      ancestors,
    });

    await category.save();
    return category;
  }

  /**
   * Update category
   * @param {string} id
   * @param {object} updates
   * @returns {Promise<Category>}
   */
  async updateCategory(id, updates) {
    const category = await Category.findById(id);
    if (!category) {
      const error = new Error('Category not found');
      error.statusCode = 404;
      error.code = 'CATEGORY_NOT_FOUND';
      throw error;
    }

    // Slug check
    if (updates.slug && updates.slug !== category.slug) {
      const existing = await Category.findOne({ slug: updates.slug, _id: { $ne: id } });
      if (existing) {
        const error = new Error(`Category slug '${updates.slug}' already exists`);
        error.statusCode = 409;
        error.code = 'DUPLICATE_SLUG';
        throw error;
      }
      category.slug = updates.slug;
    } else if (updates.name && updates.name !== category.name && !updates.slug) {
      category.slug = await generateUniqueSlug(Category, updates.name, id);
    }

    // Parent change check & circular check
    let parentChanged = false;
    if (updates.parentId !== undefined && String(updates.parentId) !== String(category.parentId)) {
      if (updates.parentId) {
        const isCycle = await this.isDescendant(id, updates.parentId);
        if (isCycle) {
          const error = new Error('Cannot set parent category to itself or one of its descendants');
          error.statusCode = 400;
          error.code = 'CIRCULAR_CATEGORY_HIERARCHY';
          throw error;
        }
      }

      const { level, ancestors } = await this.computeAncestors(updates.parentId);
      category.parentId = updates.parentId;
      category.level = level;
      category.ancestors = ancestors;
      parentChanged = true;
    }

    // Apply remaining updates
    if (updates.name) category.name = updates.name;
    if (updates.description !== undefined) category.description = updates.description;
    if (updates.displayOrder !== undefined) category.displayOrder = updates.displayOrder;
    if (updates.isFeatured !== undefined) category.isFeatured = updates.isFeatured;
    if (updates.isActive !== undefined) category.isActive = updates.isActive;
    if (updates.image !== undefined) category.image = updates.image;
    if (updates.seo !== undefined) category.seo = updates.seo;

    await category.save();

    // Synchronize descendants if tree structure, name, or slug changed
    if (parentChanged || updates.name || updates.slug) {
      await this.syncDescendants(category);
    }

    return category;
  }

  /**
   * Get category tree (nested hierarchy) for active categories
   * @param {boolean} [includeInactive=false]
   * @returns {Promise<Array<object>>}
   */
  async getCategoryTree(includeInactive = false) {
    const query = includeInactive ? {} : { isActive: true };
    const categories = await Category.find(query).sort({ level: 1, displayOrder: 1, name: 1 }).lean();

    // Build hierarchy tree map
    const categoryMap = new Map();
    const roots = [];

    categories.forEach((cat) => {
      cat.id = cat._id.toString();
      cat.children = [];
      categoryMap.set(cat.id, cat);
    });

    categories.forEach((cat) => {
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId.toString());
        if (parent) {
          parent.children.push(cat);
        } else {
          roots.push(cat);
        }
      } else {
        roots.push(cat);
      }
    });

    return roots;
  }

  /**
   * Get flat list of categories (for admin selector or flat index)
   * @param {object} [filter={}]
   * @returns {Promise<Array<object>>}
   */
  async getCategories(filter = {}) {
    return Category.find(filter).sort({ level: 1, displayOrder: 1, name: 1 }).lean();
  }

  /**
   * Get single category by slug with direct subcategories
   * @param {string} slug
   * @returns {Promise<object>}
   */
  async getCategoryBySlug(slug) {
    const category = await Category.findOne({ slug, isActive: true }).lean();
    if (!category) {
      const error = new Error('Category not found');
      error.statusCode = 404;
      error.code = 'CATEGORY_NOT_FOUND';
      throw error;
    }

    const subcategories = await Category.find({ parentId: category._id, isActive: true })
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    category.id = category._id.toString();
    category.subcategories = subcategories.map((s) => ({ ...s, id: s._id.toString() }));

    return category;
  }

  /**
   * Get category by ID
   * @param {string} id
   * @returns {Promise<Category>}
   */
  async getCategoryById(id) {
    const category = await Category.findById(id);
    if (!category) {
      const error = new Error('Category not found');
      error.statusCode = 404;
      error.code = 'CATEGORY_NOT_FOUND';
      throw error;
    }
    return category;
  }

  /**
   * Archive category (soft delete / deactivate)
   * @param {string} id
   * @returns {Promise<Category>}
   */
  async archiveCategory(id) {
    const category = await Category.findById(id);
    if (!category) {
      const error = new Error('Category not found');
      error.statusCode = 404;
      error.code = 'CATEGORY_NOT_FOUND';
      throw error;
    }

    category.isActive = false;
    await category.save();

    // Also deactivate descendants
    await Category.updateMany({ 'ancestors._id': category._id }, { isActive: false });

    return category;
  }
}

export default new CategoryService();
