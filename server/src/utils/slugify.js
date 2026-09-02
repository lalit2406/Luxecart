/**
 * Convert string to URL-friendly slug
 * @param {string} text
 * @returns {string}
 */
export const slugify = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove non-alphanumeric chars except hyphens
    .replace(/[\s_-]+/g, '-') // collapse whitespace and underscores into single hyphen
    .replace(/^-+|-+$/g, ''); // remove leading and trailing hyphens
};

/**
 * Generate unique slug for a model by checking existing documents
 * @param {import('mongoose').Model} Model
 * @param {string} name
 * @param {string} [excludeId] - ID to exclude (e.g. on update)
 * @returns {Promise<string>}
 */
export const generateUniqueSlug = async (Model, name, excludeId = null) => {
  const baseSlug = slugify(name);
  if (!baseSlug) {
    throw new Error('Cannot generate slug from empty name');
  }

  const slugRegex = new RegExp(`^${baseSlug}(-[0-9]+)?$`, 'i');
  const query = { slug: slugRegex };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existingDocs = await Model.find(query).select('slug').lean();

  if (existingDocs.length === 0) {
    return baseSlug;
  }

  const existingSlugs = new Set(existingDocs.map((d) => d.slug));
  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 1;
  while (existingSlugs.has(`${baseSlug}-${counter}`)) {
    counter++;
  }

  return `${baseSlug}-${counter}`;
};
