import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { connectDB, disconnectDB } from '../config/database.js';
import User from '../modules/users/user.model.js';
import { hashPassword } from './token.js';
import { config } from '../config/env.js';

dotenv.config();

export const REQUIRED_TARGET_DB = 'luxecart_staging';

export const INSECURE_DEFAULT_PASSWORDS = Object.freeze(
  new Set([
    'Admin@LuxeCart2026',
    'Admin@LuxeCart',
    'password',
    'password123',
    'admin123',
    'changeme',
    'secret',
    '1234567890123456',
  ])
);

export const INSECURE_DEFAULT_EMAILS = Object.freeze(
  new Set([
    'admin@luxecart.local',
    'admin@example.com',
    'test@test.com',
    'user@example.com',
  ])
);

/**
 * Validates bootstrap credentials before any database connection attempt.
 */
export function validateAdminCredentials({ name, email, password }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('[Bootstrap Error] ADMIN_NAME is required and cannot be empty.');
  }
  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    throw new Error('[Bootstrap Error] ADMIN_NAME must be between 2 and 100 characters.');
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new Error('[Bootstrap Error] ADMIN_EMAIL is required and cannot be empty.');
  }
  const trimmedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    throw new Error('[Bootstrap Error] ADMIN_EMAIL must be a valid email address.');
  }
  if (INSECURE_DEFAULT_EMAILS.has(trimmedEmail)) {
    throw new Error('[Bootstrap Error] ADMIN_EMAIL cannot use a placeholder or insecure default email.');
  }

  if (!password || typeof password !== 'string') {
    throw new Error('[Bootstrap Error] ADMIN_PASSWORD is required and cannot be empty.');
  }
  if (!password.trim()) {
    throw new Error('[Bootstrap Error] ADMIN_PASSWORD cannot be whitespace-only.');
  }
  if (password.length < 16) {
    throw new Error('[Bootstrap Error] ADMIN_PASSWORD must be at least 16 characters long.');
  }
  if (INSECURE_DEFAULT_PASSWORDS.has(password)) {
    throw new Error('[Bootstrap Error] ADMIN_PASSWORD matches a known insecure default. A strong, unique password is required.');
  }

  return {
    name: trimmedName,
    email: trimmedEmail,
    password,
  };
}

/**
 * Validates that connection URI explicitly targets the expected staging database.
 */
export function validateTargetMongoUri(uri, expectedDb = REQUIRED_TARGET_DB) {
  if (!uri || typeof uri !== 'string' || !uri.trim()) {
    throw new Error('[Bootstrap Error] MONGODB_URI is required and cannot be empty.');
  }
  const cleanUri = uri.trim();
  const dbPattern = new RegExp(`/${expectedDb}(?:\\?|$)`, 'i');
  if (!dbPattern.test(cleanUri)) {
    throw new Error(`[Bootstrap Aborted] MONGODB_URI does not target the '${expectedDb}' database.`);
  }
  return cleanUri;
}

/**
 * Explicit script to bootstrap or promote an ADMIN user in staging.
 * Controlled strictly via environment variables: ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD.
 * Requires explicit database confirmation: --confirm-db=luxecart_staging.
 * If an existing user matches the email, requires --confirm-existing-account-update to authorize promotion.
 */
export async function bootstrapAdmin({
  name = process.env.ADMIN_NAME,
  email = process.env.ADMIN_EMAIL,
  password = process.env.ADMIN_PASSWORD,
  confirmDb = null,
  confirmExistingAccountUpdate = false,
  mongoUri = process.env.MONGODB_URI || config.mongoUri,
  UserModel = User,
  injectedDb = null,
  connectFn = connectDB,
  disconnectFn = disconnectDB,
  autoDisconnect = true,
} = {}) {
  // 1. Explicit database confirmation verification
  if (!confirmDb || typeof confirmDb !== 'string' || !confirmDb.trim()) {
    throw new Error(
      `[Bootstrap Aborted] Missing required database confirmation flag '--confirm-db=${REQUIRED_TARGET_DB}'.`
    );
  }
  const normalizedConfirmDb = confirmDb.trim();
  if (normalizedConfirmDb !== REQUIRED_TARGET_DB) {
    throw new Error(
      `[Bootstrap Aborted] Database confirmation mismatch! Expected '--confirm-db=${REQUIRED_TARGET_DB}', but received '--confirm-db=${normalizedConfirmDb}'.`
    );
  }

  // 2. Validate credentials strictly before attempting any database connection
  const validCreds = validateAdminCredentials({ name, email, password });

  // 3. Validate connection URI targets the required staging database
  if (!injectedDb) {
    validateTargetMongoUri(mongoUri, REQUIRED_TARGET_DB);
  }

  let db = injectedDb;
  let didConnect = false;

  try {
    if (!db) {
      console.log('[Bootstrap] Connecting to database for staging admin provisioning...');
      const conn = await connectFn(mongoUri, { isProduction: true });
      didConnect = true;
      db = conn?.connection?.db || conn?.db;
    }

    // 4. Verify actual connected database name immediately after connection
    const activeDbName = db?.databaseName || (db?.client?.s?.options?.dbName) || 'unknown';
    if (activeDbName !== REQUIRED_TARGET_DB) {
      throw new Error(
        `[Bootstrap Aborted] Active database mismatch: connected to '${activeDbName}', but expected '${REQUIRED_TARGET_DB}'. Aborting before querying or writing any data.`
      );
    }
    console.log(`[Bootstrap] Target database verified: '${activeDbName}'. Proceeding with administrator account check.`);

    // 5. Existing-account protection & creation/promotion
    const existingUser = await UserModel.findOne({ email: validCreds.email });

    if (existingUser) {
      // SEC-PROMOTE: Require explicit operator confirmation to modify an existing account
      if (!confirmExistingAccountUpdate) {
        console.warn(
          `\n[Bootstrap Warning] An account with email '${validCreds.email}' already exists in '${REQUIRED_TARGET_DB}'. ` +
          `To prevent accidental modification, account promotion is blocked by default.`
        );
        throw new Error(
          `[Bootstrap Aborted] Account with email '${validCreds.email}' already exists. ` +
          `To explicitly promote this existing user to ADMIN and reset their password, re-run with '--confirm-existing-account-update'.`
        );
      }

      console.warn(
        `\n[Bootstrap Warning] User '${validCreds.email}' already exists in '${REQUIRED_TARGET_DB}'. ` +
        `Confirmed promotion: Updating role to 'ADMIN', setting status to 'ACTIVE', and resetting password...`
      );
      existingUser.role = 'ADMIN';
      existingUser.status = 'ACTIVE';
      existingUser.passwordHash = await hashPassword(validCreds.password);
      await existingUser.save();
      console.log(`[Bootstrap] Admin user '${validCreds.email}' updated and promoted successfully.`);
      return typeof existingUser.toSafeObject === 'function' ? existingUser.toSafeObject() : existingUser;
    }

    console.log(`[Bootstrap] Creating new ADMIN user: '${validCreds.email}'...`);
    const passwordHash = await hashPassword(validCreds.password);
    const newAdmin = new UserModel({
      name: validCreds.name,
      email: validCreds.email,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    await newAdmin.save();
    console.log(`[Bootstrap] Admin user '${validCreds.email}' created successfully.`);
    return typeof newAdmin.toSafeObject === 'function' ? newAdmin.toSafeObject() : newAdmin;
  } finally {
    if (didConnect && autoDisconnect && typeof disconnectFn === 'function') {
      try {
        await disconnectFn();
        console.log('[Bootstrap] Database connection closed cleanly.');
      } catch (discErr) {
        console.error('[Bootstrap] Disconnect warning:', discErr.message || discErr);
      }
    }
  }
}

// Run directly from CLI if invoked as the main module
const isDirectRun = Boolean(
  process.argv[1] &&
  (fileURLToPath(import.meta.url) === process.argv[1] || process.argv[1].endsWith('bootstrapAdmin.js'))
);

if (isDirectRun) {
  const args = process.argv.slice(2);
  const confirmDbArg = args.find((a) => a.startsWith('--confirm-db='));
  const confirmDb = confirmDbArg ? confirmDbArg.split('=')[1] : null;
  const confirmExistingAccountUpdate = args.includes('--confirm-existing-account-update');

  bootstrapAdmin({ confirmDb, confirmExistingAccountUpdate })
    .then((user) => {
      console.log('\n[Bootstrap Completed Successfully]');
      console.log({
        id: user.id || user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      });
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n✖ Fatal Bootstrap Error:', err.message);
      process.exit(1);
    });
}
