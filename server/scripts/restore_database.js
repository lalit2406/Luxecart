/**
 * LUXECART DATABASE RESTORE & RECOVERY UTILITY
 *
 * Safely restores a database backup into an isolated test or staging database.
 * 
 * Safety Rules (Phase 8.2.5 Hardened):
 * - Canonical host normalization (case, trailing dots, bracketed IPv6, port validation).
 * - Multi-host replica set validation (every host must be approved, no empty tokens).
 * - Decoded URL-encoded credential inspection (rejects encoded superusers like %61dmin).
 * - Complete credential sanitization in all logs, error stacks, and manifests.
 * - Strict allowlist bypass resistance: allowlists cannot override production blocks or environment requirements.
 * - Fail-closed production configuration parsing: invalid prod config throws immediately.
 * - Dual-confirmation requirement for destructive (--drop and --confirm-drop) operations.
 * - Fail closed before any network socket or database operation.
 * 
 * Usage:
 *   node scripts/restore_database.js \
 *     --source <backup_dir> \
 *     --target-db <isolated_test_db> \
 *     --target-env <test|staging> \
 *     --confirm-target \
 *     [--target-uri <uri>] \
 *     [--drop --confirm-drop] \
 *     [--allowed-hosts <host1,host2>]
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { sanitizeUri } from './backup_database.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');

/**
 * Validates a port string as an integer between 1 and 65535
 * @param {string} portStr
 * @param {string} fullHost
 * @returns {number}
 */
export const parseAndValidatePort = (portStr, fullHost) => {
  if (!portStr || !/^\d+$/.test(portStr)) {
    const error = new Error(`Invalid port definition in host '${fullHost}'. Port must be a positive integer.`);
    error.code = 'INVALID_TARGET_URI';
    throw error;
  }
  const portNum = parseInt(portStr, 10);
  if (portNum < 1 || portNum > 65535) {
    const error = new Error(`Port out of range in host '${fullHost}': must be between 1 and 65535.`);
    error.code = 'INVALID_TARGET_URI';
    throw error;
  }
  return portNum;
};

/**
 * Checks whether a normalized hostname represents an IPv4 or IPv6 loopback interface
 * @param {string} hostname
 * @returns {boolean}
 */
export const isLoopbackHost = (hostname) => {
  if (!hostname || typeof hostname !== 'string') return false;
  const h = hostname.toLowerCase();

  if (h === 'localhost') return true;
  if (h === '0.0.0.0') return true;
  if (h === '::' || h === '[::]') return true;
  if (h === '::1' || h === '[::1]' || h === '0:0:0:0:0:0:0:1') return true;

  // IPv4 127.0.0.0/8 block
  if (/^127(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(h)) {
    return true;
  }

  // Bracketed IPv6 loopback variants
  if (/^\[0*(:0*)+:1\]$/.test(h) || /^0*(:0*)+:1$/.test(h)) {
    return true;
  }

  return false;
};

/**
 * Normalizes a raw host string according to canonical policy:
 * - Trims whitespace
 * - Handles bracketed IPv6 (with optional port)
 * - Handles IPv4 / hostname with optional port
 * - Validates port range (1..65535)
 * - Forbids ports on MongoDB SRV connection strings
 * - Converts hostname to lowercase
 * - Strips trailing dots (DNS FQDN notation)
 * - Identifies loopback interfaces
 *
 * @param {string} rawHost
 * @param {object} [options={}]
 * @param {boolean} [options.isSrv=false]
 * @returns {object} Normalized host details
 */
export const normalizeHost = (rawHost, options = {}) => {
  if (!rawHost || typeof rawHost !== 'string' || !rawHost.trim()) {
    const error = new Error('Invalid targetUri: host entry cannot be empty.');
    error.code = 'INVALID_TARGET_URI';
    throw error;
  }

  const trimmed = rawHost.trim();
  let hostname = '';
  let port = null;

  if (trimmed.startsWith('[')) {
    // IPv6 with brackets
    const closingIdx = trimmed.indexOf(']');
    if (closingIdx === -1) {
      const error = new Error(`Invalid host: unclosed IPv6 bracket in '${trimmed}'.`);
      error.code = 'INVALID_TARGET_URI';
      throw error;
    }
    const ipInside = trimmed.substring(1, closingIdx);
    const afterBracket = trimmed.substring(closingIdx + 1);
    if (afterBracket) {
      if (!afterBracket.startsWith(':')) {
        const error = new Error(`Invalid host: invalid characters after IPv6 bracket in '${trimmed}'.`);
        error.code = 'INVALID_TARGET_URI';
        throw error;
      }
      port = parseAndValidatePort(afterBracket.substring(1), trimmed);
    }
    hostname = ipInside;
  } else {
    // Hostname, IPv4, or unbracketed IPv6
    const colonCount = (trimmed.match(/:/g) || []).length;
    if (colonCount > 1) {
      // Unbracketed IPv6 address (e.g. ::1)
      hostname = trimmed;
    } else if (colonCount === 1) {
      // host:port
      const [h, p] = trimmed.split(':');
      hostname = h;
      port = parseAndValidatePort(p, trimmed);
    } else {
      // host without port
      hostname = trimmed;
    }
  }

  if (options.isSrv && port !== null) {
    const error = new Error(
      `Invalid targetUri: MongoDB SRV URIs must not include a port definition (found port ${port} in '${trimmed}').`
    );
    error.code = 'INVALID_TARGET_URI';
    throw error;
  }

  // Lowercase hostname and strip trailing dots (DNS root FQDN notation)
  let normalizedHost = hostname.toLowerCase().replace(/\.+$/, '');

  // Validate hostname syntax: must not contain invalid URI characters or whitespace
  const isIpv6 = trimmed.startsWith('[') || (trimmed.match(/:/g) || []).length > 1;
  const invalidCharPattern = isIpv6 ? /[\s\/\\?#@]/ : /[\s\/\\?#@:]/;

  if (!normalizedHost || invalidCharPattern.test(normalizedHost)) {
    const error = new Error(`Invalid host: malformed hostname characters in '${trimmed}'.`);
    error.code = 'INVALID_TARGET_URI';
    throw error;
  }

  // Canonicalize IPv6 loopback variants
  if (
    normalizedHost === '::1' ||
    normalizedHost === '0:0:0:0:0:0:0:1' ||
    /^0*(:0*)+:1$/.test(normalizedHost)
  ) {
    normalizedHost = '::1';
  }

  const loopback = isLoopbackHost(normalizedHost);

  return {
    raw: trimmed,
    hostname: normalizedHost,
    port,
    hasPort: port !== null,
    isLoopback: loopback,
  };
};

/**
 * Safely parses a MongoDB URI without leaking credentials
 * @param {string} rawUri
 * @returns {object} Parsed and normalized URI components
 */
export const parseMongoUri = (rawUri) => {
  if (!rawUri || typeof rawUri !== 'string' || !rawUri.trim()) {
    const error = new Error('targetUri is required and cannot be empty.');
    error.code = 'MISSING_TARGET_URI';
    throw error;
  }

  const uri = rawUri.trim();
  const schemeMatch = uri.match(/^([a-z0-9+.-]+):\/\//i);
  if (!schemeMatch) {
    const error = new Error('Invalid targetUri format. Missing URI scheme.');
    error.code = 'INVALID_TARGET_URI';
    throw error;
  }

  const scheme = schemeMatch[1].toLowerCase();
  if (scheme !== 'mongodb' && scheme !== 'mongodb+srv') {
    const error = new Error("Invalid targetUri scheme. Only 'mongodb://' and 'mongodb+srv://' schemes are supported.");
    error.code = 'INVALID_TARGET_URI';
    throw error;
  }

  // Match: scheme://[user:pass@]hostsPart[/dbName][?query]
  const match = uri.match(
    /^(mongodb(?:\+srv)?):\/\/(?:([^@/?#]+)@)?([^\/?#]+)(?:\/([^?#]*))?(?:\?(.*))?$/i
  );
  if (!match) {
    const error = new Error('Invalid targetUri format. Please provide a valid MongoDB connection string.');
    error.code = 'INVALID_TARGET_URI';
    throw error;
  }

  const [, , userAuthPart, hostsPart, dbNameInUri, queryPart] = match;

  // Extract and decode credentials if present
  let username = null;
  let password = null;
  if (userAuthPart) {
    const colonIdx = userAuthPart.indexOf(':');
    let rawUser = '';
    let rawPass = null;
    if (colonIdx > -1) {
      rawUser = userAuthPart.substring(0, colonIdx);
      rawPass = userAuthPart.substring(colonIdx + 1);
    } else {
      rawUser = userAuthPart;
    }

    try {
      username = decodeURIComponent(rawUser);
    } catch (_) {
      username = rawUser;
    }

    if (rawPass !== null) {
      try {
        password = decodeURIComponent(rawPass);
      } catch (_) {
        password = rawPass;
      }
    }
  }

  if (!hostsPart || !hostsPart.trim()) {
    const error = new Error('Invalid targetUri: missing host definition.');
    error.code = 'INVALID_TARGET_URI';
    throw error;
  }

  // Split hosts by comma and ensure no empty host tokens exist
  const rawTokens = hostsPart.split(',');
  if (rawTokens.length === 0) {
    const error = new Error('Invalid targetUri: no hosts specified.');
    error.code = 'INVALID_TARGET_URI';
    throw error;
  }

  for (const token of rawTokens) {
    if (!token || !token.trim()) {
      const error = new Error('Invalid targetUri: empty host entry in connection string.');
      error.code = 'INVALID_TARGET_URI';
      throw error;
    }
  }

  const isSrv = scheme === 'mongodb+srv';
  if (isSrv && rawTokens.length > 1) {
    const error = new Error('Invalid targetUri: MongoDB SRV connection strings must specify exactly one host.');
    error.code = 'INVALID_TARGET_URI';
    throw error;
  }

  const normalizedHosts = rawTokens.map((t) => normalizeHost(t, { isSrv }));
  const hostnames = normalizedHosts.map((h) => h.hostname);

  return {
    scheme,
    username,
    password,
    hostsPart,
    hosts: normalizedHosts,
    hostnames,
    dbNameInUri: dbNameInUri || null,
    queryPart: queryPart || null,
  };
};

/**
 * Validates whether the restore target environment, host, database name,
 * allowlist, and confirmations meet strict isolation safety requirements.
 *
 * @param {object} options
 * @returns {object} Validation result
 */
export const validateRestoreTarget = (options = {}) => {
  const {
    targetUri,
    targetDbName,
    targetEnv,
    confirmTarget = false,
    allowedHosts = null,
    productionHosts = null,
    drop = false,
    confirmDrop = false,
  } = options;

  if (!targetUri) {
    const error = new Error('targetUri is required to restore database.');
    error.code = 'MISSING_TARGET_URI';
    throw error;
  }

  if (!targetDbName || typeof targetDbName !== 'string' || !targetDbName.trim()) {
    const error = new Error('targetDbName is required and must be an isolated test/staging database.');
    error.code = 'MISSING_TARGET_DB_NAME';
    throw error;
  }

  const cleanDbName = targetDbName.trim();
  const lowerDb = cleanDbName.toLowerCase();

  // 1. Database name check
  if (
    lowerDb === 'luxecart' ||
    lowerDb === 'production' ||
    lowerDb === 'prod' ||
    lowerDb.includes('-prod') ||
    lowerDb.includes('prod-')
  ) {
    const error = new Error(
      `Safety Violation: Target database '${cleanDbName}' matches production database naming. Production restore is strictly forbidden.`
    );
    error.code = 'UNSAFE_RESTORE_TARGET';
    throw error;
  }

  const isExplicitTestDb =
    lowerDb.includes('test') ||
    lowerDb.includes('staging') ||
    lowerDb.includes('restore') ||
    lowerDb.startsWith('fixture_');

  if (!isExplicitTestDb) {
    const error = new Error(
      `Safety Violation: Target database '${cleanDbName}' is not an authorized test/staging database. Target database name must explicitly include 'test', 'staging', or 'restore'.`
    );
    error.code = 'UNSAFE_RESTORE_TARGET';
    throw error;
  }

  // 2. Explicit environment check
  if (!targetEnv || typeof targetEnv !== 'string') {
    const error = new Error(
      'targetEnv is required and must specify an approved non-production environment (e.g., "test", "staging", "ci", "development").'
    );
    error.code = 'UNSAFE_ENVIRONMENT';
    throw error;
  }

  const cleanEnv = targetEnv.trim().toLowerCase();
  const approvedEnvs = ['test', 'staging', 'ci', 'development', 'local'];
  if (!approvedEnvs.includes(cleanEnv) || cleanEnv === 'production' || cleanEnv === 'prod') {
    const error = new Error(
      `Safety Violation: targetEnv '${targetEnv}' is not an approved non-production environment.`
    );
    error.code = 'UNSAFE_ENVIRONMENT';
    throw error;
  }

  // 3. Explicit operator confirmation of environment
  if (confirmTarget !== true) {
    const error = new Error(
      `Confirmation Required: You must explicitly confirm the target environment '${cleanEnv}' by setting confirmTarget=true.`
    );
    error.code = 'UNCONFIRMED_TARGET_ENVIRONMENT';
    throw error;
  }

  // 4. Safe URI parsing and host normalization
  const parsedUri = parseMongoUri(targetUri);

  // 5. Dedicated test user privilege check (including URL-encoded superusers)
  if (parsedUri.username) {
    const lowerUser = parsedUri.username.toLowerCase();
    if (lowerUser === 'admin' || lowerUser === 'prod_admin' || lowerUser === 'root') {
      const error = new Error(
        `Permission Violation: Superuser '${parsedUri.username}' cannot be used for restore operations. A dedicated test/staging user with least privilege is required.`
      );
      error.code = 'UNAUTHORIZED_RESTORE_USER';
      throw error;
    }
  }

  // 6. Check against production hosts (normalized comparison)
  const knownProdHosts = new Set();
  const addKnownProdHost = (hostStr, sourceLabel) => {
    try {
      const norm = normalizeHost(hostStr);
      knownProdHosts.add(norm.hostname);
    } catch (err) {
      const error = new Error(`[Safety Error] Malformed production host definition in ${sourceLabel}: ${err.message}`);
      error.code = 'INVALID_PRODUCTION_CONFIG';
      throw error;
    }
  };

  if (Array.isArray(productionHosts)) {
    productionHosts.forEach((h) => addKnownProdHost(h, 'productionHosts option'));
  } else if (typeof productionHosts === 'string') {
    productionHosts.split(',').forEach((h) => {
      if (h.trim()) addKnownProdHost(h.trim(), 'productionHosts option');
    });
  }

  if (process.env.PRODUCTION_HOSTS) {
    process.env.PRODUCTION_HOSTS.split(',').forEach((h) => {
      if (h.trim()) addKnownProdHost(h.trim(), 'PRODUCTION_HOSTS environment variable');
    });
  }

  if (process.env.PROD_MONGODB_URI) {
    try {
      const prodParsed = parseMongoUri(process.env.PROD_MONGODB_URI);
      prodParsed.hostnames.forEach((h) => knownProdHosts.add(h));
    } catch (err) {
      const error = new Error(`[Safety Error] Configured PROD_MONGODB_URI is invalid or cannot be parsed safely: ${err.message}`);
      error.code = 'INVALID_PRODUCTION_CONFIG';
      throw error;
    }
  }

  if (process.env.NODE_ENV === 'production' && process.env.MONGODB_URI) {
    try {
      const prodParsed = parseMongoUri(process.env.MONGODB_URI);
      prodParsed.hostnames.forEach((h) => knownProdHosts.add(h));
    } catch (err) {
      const error = new Error(`[Safety Error] Production MONGODB_URI is invalid or cannot be parsed safely: ${err.message}`);
      error.code = 'INVALID_PRODUCTION_CONFIG';
      throw error;
    }
  }

  for (const hostInfo of parsedUri.hosts) {
    const lowerHost = hostInfo.hostname;

    // Reject keyword indicators of production in hostname
    const hasProdKeyword =
      lowerHost.includes('production') ||
      lowerHost.includes('-prod-') ||
      lowerHost.includes('.prod.') ||
      lowerHost.includes('-prod.') ||
      lowerHost.includes('.prod-') ||
      lowerHost.startsWith('prod-') ||
      lowerHost.startsWith('prod.') ||
      lowerHost.endsWith('-prod') ||
      lowerHost.endsWith('.prod') ||
      /\bprod\b/i.test(lowerHost);

    if (hasProdKeyword) {
      const error = new Error(
        `Safety Violation: Target host '${lowerHost}' contains production indicators. Restores to production clusters are strictly blocked.`
      );
      error.code = 'PRODUCTION_HOST_REJECTED';
      throw error;
    }

    // Reject known configured production hosts (exact normalized match)
    if (knownProdHosts.has(lowerHost)) {
      const error = new Error(
        `Safety Violation: Target host '${lowerHost}' matches a configured production host. Restores to production clusters are strictly blocked.`
      );
      error.code = 'PRODUCTION_HOST_REJECTED';
      throw error;
    }
  }

  // 7. Check allowlist of approved non-production hosts (Fail closed)
  // Allowlist entries may specify hostname or hostname:port
  let allowlist = null;
  const parseAllowlistEntry = (entry) => {
    try {
      const norm = normalizeHost(entry);
      return {
        hostname: norm.hostname,
        port: norm.port,
        hasPort: norm.hasPort,
      };
    } catch (err) {
      const error = new Error(`[Config Error] Malformed entry in restore allowlist '${entry}': ${err.message}`);
      error.code = 'INVALID_ALLOWLIST_CONFIG';
      throw error;
    }
  };

  if (Array.isArray(allowedHosts)) {
    allowlist = allowedHosts.filter(Boolean).map(parseAllowlistEntry);
  } else if (typeof allowedHosts === 'string') {
    allowlist = allowedHosts
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean)
      .map(parseAllowlistEntry);
  } else if (process.env.RESTORE_ALLOWED_HOSTS) {
    allowlist = process.env.RESTORE_ALLOWED_HOSTS
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean)
      .map(parseAllowlistEntry);
  } else {
    // Default fail-closed allowlist: only local loopback targets
    allowlist = null; // Signal default loopback-only mode
  }

  for (const hostInfo of parsedUri.hosts) {
    if (allowlist === null) {
      // Default mode: must be a loopback host
      if (!hostInfo.isLoopback) {
        const error = new Error(
          `Safety Violation: Target host '${hostInfo.hostname}' is not in the approved non-production restore allowlist. To allow this host, explicitly configure allowedHosts or RESTORE_ALLOWED_HOSTS.`
        );
        error.code = 'UNAPPROVED_TARGET_HOST';
        throw error;
      }
    } else {
      // Configured allowlist mode: must match an allowlist entry exactly
      const matches = allowlist.some((entry) => {
        if (entry.hasPort) {
          return entry.hostname === hostInfo.hostname && entry.port === hostInfo.port;
        }
        return entry.hostname === hostInfo.hostname;
      });

      if (!matches) {
        const error = new Error(
          `Safety Violation: Target host '${hostInfo.hostname}' is not in the approved non-production restore allowlist. To allow this host, explicitly configure allowedHosts or RESTORE_ALLOWED_HOSTS.`
        );
        error.code = 'UNAPPROVED_TARGET_HOST';
        throw error;
      }
    }
  }

  // 8. Destructive operation check (--drop requires confirmDrop)
  if (drop === true && confirmDrop !== true) {
    const error = new Error(
      'Destructive Operation: Dropping existing collections in target database requires explicit confirmation (confirmDrop=true or --confirm-drop).'
    );
    error.code = 'UNCONFIRMED_DESTRUCTIVE_OPERATION';
    throw error;
  }

  return {
    isValid: true,
    dbName: cleanDbName,
    env: cleanEnv,
    hosts: parsedUri.hosts,
    hostnames: parsedUri.hostnames,
    sanitizedUri: sanitizeUri(targetUri),
  };
};

/**
 * Validates whether the target URI or database name is a safe, non-production target
 * Backward-compatible wrapper calling validateRestoreTarget
 * @param {string} uri
 * @param {string} targetDbName
 * @param {object} [options={}]
 * @returns {boolean}
 */
export const isSafeRestoreTarget = (uri, targetDbName, options = {}) => {
  try {
    const defaultAllowedHosts = options.allowedHosts || [
      'cluster.mongodb.net',
      'luxecart.ma6jysi.mongodb.net',
      'localhost',
      '127.0.0.1',
      '::1',
    ];
    validateRestoreTarget({
      targetUri: uri,
      targetDbName,
      targetEnv: options.targetEnv || 'test',
      confirmTarget: options.confirmTarget !== undefined ? options.confirmTarget : true,
      allowedHosts: defaultAllowedHosts,
      drop: false,
      ...options,
    });
    return true;
  } catch (_) {
    return false;
  }
};

/**
 * Restores a database backup from source directory into target database
 * @param {object} options
 * @param {string} options.sourceDir - Path to backup directory containing manifest.json
 * @param {string} options.targetUri - Target MongoDB connection string
 * @param {string} options.targetDbName - Explicit isolated test/staging database name
 * @param {string} options.targetEnv - Target environment ('test', 'staging', 'ci', 'development')
 * @param {boolean} options.confirmTarget - Explicit confirmation of target environment
 * @param {string[]|string} [options.allowedHosts] - Allowlist of approved target hostnames
 * @param {boolean} [options.drop=false] - Whether to drop existing collections in test database
 * @param {boolean} [options.confirmDrop=false] - Explicit confirmation to drop collections
 * @returns {Promise<object>} Summary of restore operation
 */
export async function performRestore(options = {}) {
  const {
    sourceDir,
    targetUri,
    targetDbName,
    drop = false,
  } = options;

  if (!sourceDir) {
    const error = new Error('sourceDir is required to restore database.');
    error.code = 'MISSING_SOURCE_DIR';
    throw error;
  }

  // 1. Strict Target Validation (Fail closed BEFORE network or destructive actions)
  const validation = validateRestoreTarget(options);

  // 2. Validate backup source files before database connection
  const manifestPath = path.join(path.resolve(sourceDir), 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    const error = new Error(`Invalid backup source: missing manifest.json at ${manifestPath}`);
    error.code = 'INVALID_BACKUP_SOURCE';
    throw error;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    const error = new Error(`Malformed manifest.json: ${err.message}`);
    error.code = 'MALFORMED_MANIFEST';
    throw error;
  }

  if (!Array.isArray(manifest.collections)) {
    const error = new Error('Malformed manifest: missing or invalid collections array.');
    error.code = 'MALFORMED_MANIFEST';
    throw error;
  }

  // Pre-validate archive integrity and completeness before attempting database connection
  for (const colEntry of manifest.collections) {
    const colName = colEntry.name;
    const archivePath = path.join(path.resolve(sourceDir), `${colName}.json.gz`);

    if (!fs.existsSync(archivePath)) {
      const error = new Error(`Incomplete backup: missing archive file '${colName}.json.gz'`);
      error.code = 'MISSING_ARCHIVE_FILE';
      throw error;
    }

    try {
      const gzippedBuffer = fs.readFileSync(archivePath);
      zlib.gunzipSync(gzippedBuffer);
    } catch (parseErr) {
      const error = new Error(`Failed to decompress or parse archive '${colName}.json.gz': ${parseErr.message}`);
      error.code = 'CORRUPTED_ARCHIVE_FILE';
      throw error;
    }
  }

  const sanitized = sanitizeUri(targetUri);
  console.log(`[Restore] Initiating restore into target database: '${targetDbName}' (${validation.env}) via ${sanitized}`);

  // Connect to target database
  let connection;
  try {
    connection = await mongoose.connect(targetUri, {
      dbName: targetDbName,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  } catch (connErr) {
    const safeMsg = sanitizeUri(connErr.message);
    const error = new Error(`Failed to connect to target database: ${safeMsg}`);
    error.code = 'DATABASE_CONNECTION_FAILED';
    throw error;
  }

  try {
    const db = mongoose.connection.db;

    // Check existing collections in target database
    const existingCollections = await db.listCollections().toArray();
    if (existingCollections.length > 0 && !drop) {
      const error = new Error(
        `Target database '${targetDbName}' is not empty (contains ${existingCollections.length} collections). Pass drop=true and confirmDrop=true to overwrite an isolated test database.`
      );
      error.code = 'TARGET_DATABASE_NOT_EMPTY';
      throw error;
    }

    const restoreSummary = {
      targetDbName,
      targetEnv: validation.env,
      sourceDir,
      collectionsRestored: 0,
      documentsRestored: 0,
      indexesRestored: 0,
      details: [],
    };

    for (const colEntry of manifest.collections) {
      const colName = colEntry.name;
      const archivePath = path.join(path.resolve(sourceDir), `${colName}.json.gz`);

      // Read and decompress archive
      const gzippedBuffer = fs.readFileSync(archivePath);
      const uncompressedText = zlib.gunzipSync(gzippedBuffer).toString('utf8');
      const colPayload = mongoose.mongo.BSON.EJSON.parse(uncompressedText);

      const collection = db.collection(colName);
      if (drop) {
        await collection.drop().catch(() => {}); // Drop if exists
      }

      const docs = colPayload.documents || [];
      if (docs.length > 0) {
        await collection.insertMany(docs);
      }

      // Recreate indexes
      let indexesCount = 0;
      const indexes = colPayload.indexes || [];
      for (const idx of indexes) {
        // Skip default _id index which is built automatically
        if (idx.name === '_id_') continue;

        const options = {
          name: idx.name,
          unique: Boolean(idx.unique),
          sparse: Boolean(idx.sparse),
        };
        await collection.createIndex(idx.key, options);
        indexesCount++;
      }

      console.log(`[Restore] -> Restored '${colName}': ${docs.length} documents, ${indexesCount} custom indexes`);

      restoreSummary.collectionsRestored++;
      restoreSummary.documentsRestored += docs.length;
      restoreSummary.indexesRestored += indexesCount;
      restoreSummary.details.push({
        collection: colName,
        documents: docs.length,
        indexes: indexesCount,
      });
    }

    console.log(`[Restore] Restore complete! Total documents: ${restoreSummary.documentsRestored}, indexes: ${restoreSummary.indexesRestored}`);
    return restoreSummary;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

// CLI execution handler
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx > -1 && args[idx + 1] ? args[idx + 1] : null;
  };
  const hasFlag = (flag) => args.includes(flag);

  const sourceDir = getArg('--source');
  const targetUri = getArg('--target-uri') || process.env.MONGODB_URI;
  const targetDbName = getArg('--target-db');
  const targetEnv = getArg('--target-env');
  const confirmTarget = hasFlag('--confirm-target');
  const drop = hasFlag('--drop');
  const confirmDrop = hasFlag('--confirm-drop');
  const allowedHostsArg = getArg('--allowed-hosts');

  if (!sourceDir || !targetDbName || !targetEnv || !confirmTarget) {
    console.error(`
Usage:
  node scripts/restore_database.js \\
    --source <backup_dir> \\
    --target-db <isolated_test_db> \\
    --target-env <test|staging> \\
    --confirm-target \\
    [--target-uri <uri>] \\
    [--drop --confirm-drop] \\
    [--allowed-hosts <host1,host2>]

Required flags:
  --source         Path to backup directory containing manifest.json
  --target-db      Explicit isolated test/staging database name
  --target-env     Target environment (must be 'test', 'staging', 'ci', or 'development')
  --confirm-target Explicit confirmation of target environment

Optional flags:
  --target-uri     MongoDB URI (defaults to MONGODB_URI if not supplied)
  --drop           Drop existing collections before restoring
  --confirm-drop   Required explicit confirmation to drop collections
  --allowed-hosts  Comma-separated list of approved target hostnames
    `);
    process.exit(1);
  }

  performRestore({
    sourceDir,
    targetUri,
    targetDbName,
    targetEnv,
    confirmTarget,
    drop,
    confirmDrop,
    allowedHosts: allowedHostsArg,
  })
    .then((summary) => {
      console.log(`[Restore] Completed successfully. Restored ${summary.documentsRestored} documents across ${summary.collectionsRestored} collections.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[Restore Failed] [${err.code || 'ERROR'}] ${err.message}`);
      process.exit(1);
    });
}
