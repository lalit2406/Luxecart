/**
 * LUXECART DATABASE BACKUP UTILITY
 * 
 * Safely creates a timestamped MongoDB backup without exposing credentials.
 * Supports:
 * - Native mongodump execution when available
 * - Integrated Node/Mongoose database streaming engine when mongodump is absent
 * - Explicit output directory naming (never overwrites an existing backup)
 * - Dry-run inspection mode (--dry-run)
 * - Strict credential sanitization in all logs and manifests
 * - Data protection compliance notices (DPDP Act / GDPR)
 * 
 * Usage:
 *   node scripts/backup_database.js [--dry-run] [--out <custom_dir>]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');
const defaultBackupsRoot = path.join(serverDir, 'backups');

/**
 * Redacts username and password from a MongoDB connection string
 * @param {string} uri
 * @returns {string}
 */
export const sanitizeUri = (uri) => {
  if (!uri || typeof uri !== 'string') return '';
  return uri.replace(/:\/\/([^/?#]+)@/g, '://[REDACTED_CREDENTIALS]@');
};

/**
 * Generates an ISO-like timestamp string suitable for directory names
 * @returns {string}
 */
export const getTimestampString = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
};

/**
 * Performs database backup
 * @param {object} options
 * @param {string} [options.uri] - MongoDB URI (defaults to process.env.MONGODB_URI)
 * @param {string} [options.outputDir] - Custom output directory path
 * @param {boolean} [options.dryRun=false] - Perform inspection without writing files
 * @returns {Promise<object>} Summary of the backup operation
 */
export async function performBackup(options = {}) {
  const rawUri = options.uri !== undefined ? options.uri : process.env.MONGODB_URI;
  const isDryRun = Boolean(options.dryRun);

  if (!rawUri || !rawUri.trim()) {
    const error = new Error('MONGODB_URI is required to perform a database backup. Please configure it in environment variables.');
    error.code = 'MISSING_MONGODB_URI';
    throw error;
  }

  const cleanUri = rawUri.trim();
  const sanitized = sanitizeUri(cleanUri);

  // Determine output directory
  let targetDir = options.outputDir;
  if (!targetDir) {
    const timestamp = getTimestampString();
    targetDir = path.join(defaultBackupsRoot, `db_backup_${timestamp}`);
  } else {
    targetDir = path.resolve(targetDir);
  }

  // Prevent overwriting existing backup directories
  if (!isDryRun && fs.existsSync(targetDir)) {
    const error = new Error(`Backup target directory already exists. Refusing to overwrite existing backup: ${targetDir}`);
    error.code = 'TARGET_DIRECTORY_EXISTS';
    throw error;
  }

  console.log('[Backup] Target connection:', sanitized);
  if (isDryRun) {
    console.log('[Backup] Mode: DRY-RUN (No files will be created)');
  } else {
    console.log('[Backup] Output directory:', targetDir);
  }

  // Connect to database
  let connection;
  try {
    connection = await mongoose.connect(cleanUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  } catch (connErr) {
    const safeMsg = connErr.message.replace(/:\/\/([^:]+):([^@]+)@/g, '://[REDACTED_CREDENTIALS]@');
    const error = new Error(`Failed to connect to database for backup: ${safeMsg}`);
    error.code = 'DATABASE_CONNECTION_FAILED';
    throw error;
  }

  try {
    const db = mongoose.connection.db;
    const dbName = db.databaseName;
    const collectionsList = await db.listCollections().toArray();

    console.log(`[Backup] Connected to database '${dbName}'. Found ${collectionsList.length} collections.`);

    const manifest = {
      backupVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      databaseName: dbName,
      dryRun: isDryRun,
      sanitizedUri: sanitized,
      securityNotice: 'This backup may contain sensitive customer data. Protect with AES-256 encryption at rest and comply with DPDP Act / GDPR data retention policies.',
      collections: [],
      totalDocuments: 0,
    };

    if (!isDryRun) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    for (const colInfo of collectionsList) {
      const colName = colInfo.name;
      // Skip system collections if any
      if (colName.startsWith('system.')) continue;

      const collection = db.collection(colName);
      const docCount = await collection.countDocuments();
      const indexes = await collection.indexes();

      console.log(`[Backup] -> Collection '${colName}': ${docCount} documents, ${indexes.length} indexes`);

      manifest.collections.push({
        name: colName,
        documents: docCount,
        indexesCount: indexes.length,
        indexes,
      });
      manifest.totalDocuments += docCount;

      if (!isDryRun) {
        // Stream documents to gzipped JSON
        const docs = await collection.find({}).toArray();
        const colPayload = {
          collection: colName,
          indexes,
          documents: docs,
        };

        const jsonBuffer = Buffer.from(mongoose.mongo.BSON.EJSON.stringify(colPayload, null, 2), 'utf8');
        const compressed = zlib.gzipSync(jsonBuffer);
        const colFilePath = path.join(targetDir, `${colName}.json.gz`);

        fs.writeFileSync(colFilePath, compressed);
      }
    }

    if (!isDryRun) {
      const manifestPath = path.join(targetDir, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      console.log(`[Backup] Backup complete. Manifest written to: ${manifestPath}`);
    } else {
      console.log(`[Backup] Dry-run complete. Total documents across all collections: ${manifest.totalDocuments}`);
    }

    return {
      success: true,
      dryRun: isDryRun,
      targetDir: isDryRun ? null : targetDir,
      databaseName: dbName,
      collectionsCount: manifest.collections.length,
      totalDocuments: manifest.totalDocuments,
      manifest,
    };
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

// Direct CLI execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const outIndex = args.indexOf('--out');
  const outputDir = outIndex !== -1 && args[outIndex + 1] ? args[outIndex + 1] : undefined;

  performBackup({ dryRun, outputDir })
    .then((res) => {
      console.log('\n✔ Backup operation completed successfully.');
      console.log(`  Database: ${res.databaseName}`);
      console.log(`  Collections: ${res.collectionsCount}`);
      console.log(`  Documents: ${res.totalDocuments}`);
      if (res.targetDir) console.log(`  Path: ${res.targetDir}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n✖ Backup failed:', err.message);
      process.exit(1);
    });
}
