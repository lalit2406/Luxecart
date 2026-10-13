import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from '../src/modules/products/product.model.js';
import User from '../src/modules/users/user.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkDetails() {
  await mongoose.connect(process.env.MONGODB_URI);

  const admin = await User.findOne({ role: 'ADMIN' }).lean();
  console.log('Admin user found:', admin ? { email: admin.email, role: admin.role, id: admin._id } : 'None');

  const prods = await Product.find({
    slug: { $in: ['vanta-retro-runner-sneakers', 'stride-minimal-leather-loafers', 'aurelia-structured-shoulder-bag'] }
  }).lean();

  prods.forEach(pr => {
    console.log('\n--- ' + pr.name + ' (' + pr.slug + ') ---');
    console.log('Images count:', pr.images?.length);
    console.log('Image colors:', Array.from(new Set(pr.images?.map(i => i.color || 'Unassigned'))));
    console.log('Variants count:', pr.variants?.length);
    const variantColors = Array.from(new Set(pr.variants?.map(v => v.attributes?.color?.name || 'Unassigned')));
    console.log('Variant colors:', variantColors);
    variantColors.forEach(c => {
      const cvs = pr.variants.filter(v => (v.attributes?.color?.name || 'Unassigned') === c);
      const stock = cvs.reduce((acc, v) => acc + (v.inventory?.stock || 0), 0);
      const sizes = cvs.map(v => v.attributes?.size).join(', ');
      console.log(`  Color: ${c} | Variants: ${cvs.length} | Sizes: [${sizes}] | Total Stock: ${stock}`);
    });
  });

  await mongoose.disconnect();
}

checkDetails();
