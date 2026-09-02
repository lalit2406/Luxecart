import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/database.js';
import User from '../modules/users/user.model.js';
import { hashPassword } from './token.js';
import { config } from '../config/env.js';

dotenv.config();

/**
 * Explicit script to bootstrap or promote an ADMIN user in development/staging.
 * Controlled strictly via environment variables: ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD.
 */
export async function bootstrapAdmin({
  name = process.env.ADMIN_NAME || 'LuxeCart Administrator',
  email = process.env.ADMIN_EMAIL || 'admin@luxecart.local',
  password = process.env.ADMIN_PASSWORD || 'Admin@LuxeCart2026',
} = {}) {
  if (!config.mongoUri) {
    throw new Error('MONGODB_URI is required to bootstrap admin user.');
  }

  await connectDB(config.mongoUri);

  const normalizedEmail = email.trim().toLowerCase();
  let adminUser = await User.findOne({ email: normalizedEmail });

  if (adminUser) {
    console.log(`[Bootstrap] Updating existing user ${normalizedEmail} to ADMIN role...`);
    adminUser.role = 'ADMIN';
    adminUser.status = 'ACTIVE';
    adminUser.passwordHash = await hashPassword(password);
    await adminUser.save();
    console.log(`[Bootstrap] Admin user ${normalizedEmail} updated successfully.`);
  } else {
    console.log(`[Bootstrap] Creating new ADMIN user: ${normalizedEmail}...`);
    const passwordHash = await hashPassword(password);
    adminUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    await adminUser.save();
    console.log(`[Bootstrap] Admin user ${normalizedEmail} created successfully.`);
  }

  return adminUser.toSafeObject();
}

// Run directly from CLI if invoked as the main module
if (process.argv[1]?.endsWith('bootstrapAdmin.js')) {
  bootstrapAdmin()
    .then((user) => {
      console.log('[Bootstrap] Completed:', user);
      return disconnectDB();
    })
    .catch((err) => {
      console.error('[Bootstrap] Failed:', err.message || err);
      process.exit(1);
    });
}
