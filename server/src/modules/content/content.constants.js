/**
 * LuxeCart Content & Homepage Management Constants
 */

export const CONTENT_TYPES = Object.freeze({
  HERO_BANNER: 'HERO_BANNER',
  PROMO_BANNER: 'PROMO_BANNER',
  FEATURED_COLLECTION: 'FEATURED_COLLECTION',
  ANNOUNCEMENT_BAR: 'ANNOUNCEMENT_BAR',
});

export const ALLOWED_CONTENT_TYPES = Object.values(CONTENT_TYPES);

export const ALLOWED_CONTENT_SORT_FIELDS = Object.freeze([
  'displayOrder',
  'createdAt',
  'updatedAt',
  'title',
  'type',
  'startDate',
  'endDate',
]);
