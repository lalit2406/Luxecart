import dotenv from 'dotenv';

dotenv.config();

/**
 * Validated environment configuration object
 */
export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGODB_URI || '',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',

  // JWT Configuration
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'luxecart_default_jwt_access_secret_min32chars_key_2026',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'luxecart_default_jwt_refresh_secret_min32chars_key_2026',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    accessMaxAgeMs: 15 * 60 * 1000, // 15 minutes
    refreshMaxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  // Cookie Configuration
  cookie: {
    domain: process.env.COOKIE_DOMAIN || undefined,
    sameSite: process.env.COOKIE_SAME_SITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax'),
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  },

  // Cloudinary Configuration
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'luxecart/products',
  },

  // Google OAuth Configuration
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
  },

  // Email Configuration (Resend)
  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'LuxeCart <onboarding@resend.dev>',
  },
};
