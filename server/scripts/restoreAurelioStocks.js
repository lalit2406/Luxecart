import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../src/modules/products/product.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function restoreAurelio() {
  await mongoose.connect(process.env.MONGODB_URI);
  const p = await Product.findOne({ slug: 'aurelio-essential-oversized-t-shirt' });
  const varS = p.variants.find((v) => v.sku === 'AUR-TEE-001-BLK-S');
  const varM = p.variants.find((v) => v.sku === 'AUR-TEE-001-BLK-M');

  console.log('Before restore:');
  console.log('  AUR-TEE-001-BLK-S stock:', varS.inventory.stock);
  console.log('  AUR-TEE-001-BLK-M stock:', varM.inventory.stock);

  varS.inventory.stock = 18;
  varM.inventory.stock = 18;

  p.markModified('variants');
  await p.save();

  console.log('After restore:');
  console.log('  AUR-TEE-001-BLK-S stock:', varS.inventory.stock);
  console.log('  AUR-TEE-001-BLK-M stock:', varM.inventory.stock);
  console.log('  Total stock:', p.priceSummary.totalStock);

  await mongoose.disconnect();
}

restoreAurelio();
