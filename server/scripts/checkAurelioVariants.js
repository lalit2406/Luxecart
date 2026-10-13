import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../src/modules/products/product.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const p = await Product.findOne({ slug: 'aurelio-essential-oversized-t-shirt' }).lean();
  console.log('Product:', p.name, 'Total Stock:', p.priceSummary?.totalStock);
  p.variants.forEach((v) => {
    console.log(`  SKU: ${v.sku} | Color: ${v.attributes?.color?.name} | Size: ${v.attributes?.size} | Stock: ${v.inventory?.stock}`);
  });
  await mongoose.disconnect();
}

check();
