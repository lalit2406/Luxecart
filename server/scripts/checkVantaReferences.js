import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../src/modules/products/product.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function runCheck() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const vanta = await Product.findOne({ slug: 'vanta-retro-runner-sneakers' }).lean();
  if (!vanta) {
    console.error('Vanta sneakers not found in database!');
    process.exit(1);
  }

  // 1. Backup
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, 'vanta_sneakers_backup_before_colorway_split_20261010.json');
  fs.writeFileSync(backupPath, JSON.stringify(vanta, null, 2));
  console.log('✔ Backed up complete Vanta product document to:', backupPath);

  // 2. Check collections
  const vantaId = vanta._id;
  const oldSkus = vanta.variants.map((v) => v.sku);
  console.log('Checking references for SKUs:', oldSkus, 'and product ID:', vantaId);

  const collections = await db.listCollections().toArray();
  for (const colInfo of collections) {
    const colName = colInfo.name;
    const col = db.collection(colName);

    const skuMatches = await col
      .find({
        $or: [
          { 'items.sku': { $in: oldSkus } },
          { 'items.product': vantaId },
          { 'items.productId': vantaId },
          { sku: { $in: oldSkus } },
          { product: vantaId },
          { productId: vantaId },
        ],
      })
      .toArray();

    if (skuMatches.length > 0) {
      console.log(`[FOUND REFERENCES] Collection '${colName}': ${skuMatches.length} document(s) found!`);
      skuMatches.forEach((doc) => {
        console.log(' - Match ID:', doc._id);
      });
    } else {
      console.log(`Collection '${colName}': 0 references`);
    }
  }

  await mongoose.disconnect();
}

runCheck().catch((err) => {
  console.error('Check failed:', err);
  process.exit(1);
});
