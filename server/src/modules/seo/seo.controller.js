import seoService from './seo.service.js';

/**
 * Public: Generate and stream dynamic XML sitemap using the authoritative frontend origin
 * (never publishing the backend API hostname).
 */
export const getSitemapXml = async (req, res, next) => {
  try {
    const xml = await seoService.generateSitemapXml();
    res.header('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(xml);
  } catch (error) {
    next(error);
  }
};
