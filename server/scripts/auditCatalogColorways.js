import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../src/modules/products/product.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function auditAllProducts() {
  await mongoose.connect(process.env.MONGODB_URI);
  const products = await Product.find({ status: 'ACTIVE' }).lean();

  console.log(`Auditing ${products.length} active products:\n`);
  for (const p of products) {
    const imageColors = Array.from(new Set(p.images?.map(i => i.color || 'Unassigned')));
    const variantColors = Array.from(new Set(p.variants?.map(v => v.attributes?.color?.name || 'Unassigned')));
    const sizes = Array.from(new Set(p.variants?.map(v => v.attributes?.size || 'None')));
    const totalStock = p.variants?.reduce((sum, v) => sum + (v.inventory?.stock || 0), 0);
    const zeroStockVariants = p.variants?.filter(v => (v.inventory?.stock || 0) === 0);

    console.log(`Product: ${p.name} (${p.slug})`);
    console.log(`  Price: ₹${p.priceSummary?.minPrice} - ₹${p.priceSummary?.maxPrice} | MRP: ₹${p.priceSummary?.minMrp}`);
    console.log(`  Images: ${p.images?.length} total | Tagged Colors: [${imageColors.join(', ')}]`);
    console.log(`  Variants: ${p.variants?.length} total | Colors: [${variantColors.join(', ')}] | Sizes: [${sizes.join(', ')}]`);
    console.log(`  Total Stock: ${totalStock} | Zero-stock variants: ${zeroStockVariants?.length || 0}`);
    if (zeroStockVariants?.length > 0) {
      console.log(`    Zero-stock SKUs: ${zeroStockVariants.map(v => `${v.sku} (${v.attributes?.color?.name || ''} ${v.attributes?.size || ''})`).join(', ')}`);
    }

    // Verify each variant color has corresponding images
    for (const c of variantColors) {
      if (c !== 'Unassigned') {
        const matchingImgs = p.images?.filter(i => (i.color || '').toLowerCase() === c.toLowerCase());
        console.log(`    Color '${c}': ${matchingImgs?.length || 0} matching images in product.images`);
      }
    }
    console.log('');
  }

  await mongoose.disconnect();
}

auditAllProducts();
