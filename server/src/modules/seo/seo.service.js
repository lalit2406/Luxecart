import Product from '../products/product.model.js';
import Category from '../categories/category.model.js';
import { config } from '../../config/env.js';

class SeoService {
  /**
   * Generates dynamic XML sitemap containing active products, categories, and public routes
   * @param {string} [baseUrl]
   * @returns {Promise<string>}
   */
  async generateSitemapXml(baseUrl = null) {
    const siteUrl = baseUrl || config.clientUrl || 'https://luxecart.com';
    const cleanSiteUrl = siteUrl.replace(/\/+$/, '');

    const [products, categories] = await Promise.all([
      Product.find({ status: 'ACTIVE' }).select('slug updatedAt').lean(),
      Category.find({ isActive: true }).select('slug updatedAt').lean(),
    ]);

    const now = new Date().toISOString();

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // 1. Homepage
    xml += `  <url>\n`;
    xml += `    <loc>${cleanSiteUrl}/</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;

    // 2. Shop Catalog
    xml += `  <url>\n`;
    xml += `    <loc>${cleanSiteUrl}/shop</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>0.9</priority>\n`;
    xml += `  </url>\n`;

    // 3. Active Categories
    for (const cat of categories) {
      const lastMod = cat.updatedAt ? new Date(cat.updatedAt).toISOString() : now;
      xml += `  <url>\n`;
      xml += `    <loc>${cleanSiteUrl}/shop?category=${encodeURIComponent(cat.slug)}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    // 4. Active Products
    for (const prod of products) {
      const lastMod = prod.updatedAt ? new Date(prod.updatedAt).toISOString() : now;
      xml += `  <url>\n`;
      xml += `    <loc>${cleanSiteUrl}/products/${encodeURIComponent(prod.slug)}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;
    return xml;
  }
}

export default new SeoService();
