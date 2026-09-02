import mongoose from 'mongoose';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validate category creation payload
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateCategoryCreate = (data = {}) => {
  const errors = [];
  const { name, slug, description, parentId, displayOrder, isFeatured, isActive, image, seo } = data;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Category name must be at least 2 characters long');
  } else if (name.trim().length > 80) {
    errors.push('Category name cannot exceed 80 characters');
  }

  if (slug !== undefined && slug !== null && slug !== '') {
    if (typeof slug !== 'string' || !SLUG_REGEX.test(slug.trim().toLowerCase())) {
      errors.push('Slug must contain only lowercase letters, numbers, and hyphens');
    }
  }

  let sanitizedParentId = null;
  if (parentId !== undefined && parentId !== null && parentId !== '') {
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      errors.push('Invalid parent category ID');
    } else {
      sanitizedParentId = new mongoose.Types.ObjectId(parentId);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name: name ? name.trim() : '',
      slug: slug ? slug.trim().toLowerCase() : undefined,
      description: description ? description.trim() : '',
      parentId: sanitizedParentId,
      displayOrder: typeof displayOrder === 'number' ? displayOrder : 0,
      isFeatured: Boolean(isFeatured),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      image: image && typeof image === 'object' ? image : undefined,
      seo: seo && typeof seo === 'object' ? seo : undefined,
    },
  };
};

/**
 * Validate category update payload
 * @param {object} data
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateCategoryUpdate = (data = {}) => {
  const errors = [];
  const sanitized = {};
  const { name, slug, description, parentId, displayOrder, isFeatured, isActive, image, seo } = data;

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2) {
      errors.push('Category name must be at least 2 characters long');
    } else if (name.trim().length > 80) {
      errors.push('Category name cannot exceed 80 characters');
    } else {
      sanitized.name = name.trim();
    }
  }

  if (slug !== undefined) {
    if (typeof slug !== 'string' || !SLUG_REGEX.test(slug.trim().toLowerCase())) {
      errors.push('Slug must contain only lowercase letters, numbers, and hyphens');
    } else {
      sanitized.slug = slug.trim().toLowerCase();
    }
  }

  if (description !== undefined) {
    sanitized.description = typeof description === 'string' ? description.trim() : '';
  }

  if (parentId !== undefined) {
    if (parentId === null || parentId === '') {
      sanitized.parentId = null;
    } else if (!mongoose.Types.ObjectId.isValid(parentId)) {
      errors.push('Invalid parent category ID');
    } else {
      sanitized.parentId = new mongoose.Types.ObjectId(parentId);
    }
  }

  if (displayOrder !== undefined) {
    sanitized.displayOrder = typeof displayOrder === 'number' ? displayOrder : 0;
  }

  if (isFeatured !== undefined) {
    sanitized.isFeatured = Boolean(isFeatured);
  }

  if (isActive !== undefined) {
    sanitized.isActive = Boolean(isActive);
  }

  if (image !== undefined && typeof image === 'object') {
    sanitized.image = image;
  }

  if (seo !== undefined && typeof seo === 'object') {
    sanitized.seo = seo;
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
};
