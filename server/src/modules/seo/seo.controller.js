import seoService from './seo.service.js';

/**
 * Public: Generate and stream dynamic XML sitemap
 */
export const getSitemapXml = async (req, res, next) => {
  try {
    const protocol = req.protocol || 'http';
    const host = req.get('host');
    const reqBaseUrl = `${protocol}://${host}`;

    const xml = await seoService.generateSitemapXml(reqBaseUrl);
    res.header('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(xml);
  } catch (error) {
    next(error);
  }
};
