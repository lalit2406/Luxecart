import dotenv from 'dotenv';

dotenv.config();

const DEV_DEFAULT_ACCESS_SECRET = 'luxecart_default_jwt_access_secret_min32chars_key_2026';
const DEV_DEFAULT_REFRESH_SECRET = 'luxecart_default_jwt_refresh_secret_min32chars_key_2026';

export const KNOWN_INSECURE_SECRETS = Object.freeze(
  new Set([
    DEV_DEFAULT_ACCESS_SECRET,
    DEV_DEFAULT_REFRESH_SECRET,
    'your_jwt_access_secret_min_32_characters_here',
    'your_jwt_refresh_secret_min_32_characters_here',
    'secret',
    'jwt_secret',
    'changeme',
  ])
);

/**
 * Validates JWT access and refresh secrets based on current environment.
 * In production mode, enforces that secrets are present, non-empty, distinct,
 * at least 32 characters long, and not matching known insecure defaults.
 *
 * @param {object} [env=process.env]
 * @returns {{ accessSecret: string, refreshSecret: string }}
 */
export const validateJwtSecrets = (env = process.env) => {
  const isProduction = env.NODE_ENV === 'production';
  const rawAccessSecret = env.JWT_ACCESS_SECRET;
  const rawRefreshSecret = env.JWT_REFRESH_SECRET;

  if (isProduction) {
    if (!rawAccessSecret || !rawAccessSecret.trim()) {
      throw new Error('[Config Error] JWT_ACCESS_SECRET is required in production and cannot be empty.');
    }
    const access = rawAccessSecret.trim();
    if (KNOWN_INSECURE_SECRETS.has(access)) {
      throw new Error('[Config Error] JWT_ACCESS_SECRET is set to an insecure default secret. A strong, unique secret is required in production.');
    }
    if (access.length < 32) {
      throw new Error('[Config Error] JWT_ACCESS_SECRET must be at least 32 characters in production.');
    }

    if (!rawRefreshSecret || !rawRefreshSecret.trim()) {
      throw new Error('[Config Error] JWT_REFRESH_SECRET is required in production and cannot be empty.');
    }
    const refresh = rawRefreshSecret.trim();
    if (KNOWN_INSECURE_SECRETS.has(refresh)) {
      throw new Error('[Config Error] JWT_REFRESH_SECRET is set to an insecure default secret. A strong, unique secret is required in production.');
    }
    if (refresh.length < 32) {
      throw new Error('[Config Error] JWT_REFRESH_SECRET must be at least 32 characters in production.');
    }

    if (access === refresh) {
      throw new Error('[Config Error] JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must not be identical in production.');
    }

    return {
      accessSecret: access,
      refreshSecret: refresh,
    };
  }

  // Development / Test mode fallback
  return {
    accessSecret: (rawAccessSecret && rawAccessSecret.trim()) || DEV_DEFAULT_ACCESS_SECRET,
    refreshSecret: (rawRefreshSecret && rawRefreshSecret.trim()) || DEV_DEFAULT_REFRESH_SECRET,
  };
};

/**
 * Parses a comma-separated or single CLIENT_URL into an array of allowed origins.
 * Trims whitespace, ignores empty entries, and handles single or multiple origins.
 * In non-production, defaults to ['http://localhost:5173'] if empty or unset.
 *
 * @param {string} [clientUrlString]
 * @param {boolean} [isProduction=false]
 * @returns {string[]}
 */
export const parseAllowedOrigins = (clientUrlString, isProduction = false) => {
  if (!clientUrlString || typeof clientUrlString !== 'string') {
    return isProduction ? [] : ['http://localhost:5173'];
  }

  const origins = clientUrlString
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0 && !isProduction) {
    return ['http://localhost:5173'];
  }

  return origins;
};

/**
 * Parses TRUST_PROXY configuration for Express reverse proxy handling.
 * - 'true' -> true (trust all proxies - not recommended in production)
 * - 'false' -> false (disable proxy trusting)
 * - number string -> number of trusted hops from the right (e.g. '1' for Render)
 * - string -> IP/subnet string (e.g. 'loopback', 'linklocal')
 * - Default: In production, 1 (trust Render's single reverse proxy layer); in non-prod, false
 *
 * @param {string|number|boolean} [rawTrustProxy]
 * @param {boolean} [isProduction=false]
 * @returns {boolean|number|string}
 */
export const parseTrustProxy = (rawTrustProxy, isProduction = false) => {
  if (rawTrustProxy !== undefined && rawTrustProxy !== null && String(rawTrustProxy).trim() !== '') {
    const str = String(rawTrustProxy).trim().toLowerCase();
    if (str === 'true') return true;
    if (str === 'false') return false;
    const num = parseInt(str, 10);
    if (!isNaN(num) && String(num) === str) return num;
    return String(rawTrustProxy).trim();
  }
  return isProduction ? 1 : false;
};

/**
 * Validates MONGODB_URI based on environment.
 * In production mode:
 * - Must be present, non-empty, and non-whitespace.
 * - Must use supported 'mongodb://' or 'mongodb+srv://' schemes.
 * - Must not target localhost, 127.0.0.0/8 loopback block, or IPv6 loopbacks (::1, [::1]).
 *
 * @param {string} [rawUri]
 * @param {boolean} [isProduction=false]
 * @returns {string}
 */
export const validateMongoUri = (rawUri, isProduction = false) => {
  if (isProduction) {
    if (!rawUri || typeof rawUri !== 'string' || !rawUri.trim()) {
      throw new Error('[Config Error] MONGODB_URI is required in production and cannot be empty.');
    }
  } else {
    if (!rawUri || typeof rawUri !== 'string' || !rawUri.trim()) {
      return '';
    }
  }

  const uri = rawUri.trim();
  const schemeMatch = uri.match(/^([a-z0-9+.-]+):\/\//i);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'mongodb' && scheme !== 'mongodb+srv') {
      throw new Error("[Config Error] Invalid MONGODB_URI scheme. Only 'mongodb://' and 'mongodb+srv://' schemes are supported.");
    }
  }

  const match = uri.match(/^(mongodb(?:\+srv)?):\/\/(?:([^:]+)(?::([^@]+))?@)?([^\/?#]+)(?:\/([^?#]*))?(?:\?(.*))?$/i);
  if (!match) {
    throw new Error('[Config Error] Invalid MONGODB_URI format. Please provide a valid MongoDB connection string.');
  }

  const [, , , , hostsPart] = match;
  if (!hostsPart || !hostsPart.trim()) {
    throw new Error('[Config Error] Invalid MONGODB_URI: missing host definition.');
  }

  if (isProduction) {
    const hosts = hostsPart.split(',').map((h) => h.trim()).filter(Boolean);
    if (hosts.length === 0) {
      throw new Error('[Config Error] Invalid MONGODB_URI: no hosts specified.');
    }

    const loopbackIpv4Regex = /^127(?:\.\d{1,3}){3}$/;
    for (const hostEntry of hosts) {
      let hostname = hostEntry;
      if (hostname.startsWith('[') && hostname.includes(']')) {
        hostname = hostname.slice(1, hostname.indexOf(']'));
      } else if (hostname.includes(':') && (hostname.match(/:/g) || []).length === 1) {
        hostname = hostname.split(':')[0];
      }

      const cleanHost = hostname.toLowerCase().trim();
      if (
        cleanHost === 'localhost' ||
        cleanHost.endsWith('.localhost') ||
        loopbackIpv4Regex.test(cleanHost) ||
        cleanHost === '::1' ||
        cleanHost === '0:0:0:0:0:0:0:1' ||
        cleanHost === '0.0.0.0'
      ) {
        throw new Error('[Config Error] MONGODB_URI cannot target localhost or loopback addresses in production.');
      }
    }
  }

  return uri;
};

/**
 * Constructs and validates application configuration from environment
 * @param {object} [env=process.env]
 * @returns {object}
 */
export const createConfig = (env = process.env) => {
  const { accessSecret, refreshSecret } = validateJwtSecrets(env);
  const isProduction = env.NODE_ENV === 'production';
  const clientUrl = env.CLIENT_URL || (isProduction ? '' : 'http://localhost:5173');
  const originsSource = env.ALLOWED_ORIGINS || clientUrl;
  const allowedOrigins = parseAllowedOrigins(originsSource, isProduction);
  const mongoUri = validateMongoUri(env.MONGODB_URI, isProduction);
  const trustProxy = parseTrustProxy(env.TRUST_PROXY, isProduction);

  return {
    port: parseInt(env.PORT || '5000', 10),
    nodeEnv: env.NODE_ENV || 'development',
    clientUrl,
    allowedOrigins,
    trustProxy,
    mongoUri,
    isProduction,
    isDevelopment: env.NODE_ENV === 'development',
    isTest: env.NODE_ENV === 'test',

    // JWT Configuration
    jwt: {
      accessSecret,
      refreshSecret,
      accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN || '15m',
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN || '7d',
      accessMaxAgeMs: 15 * 60 * 1000, // 15 minutes
      refreshMaxAgeMs: 7 * 24 * 60 * 60 * 1000, // 7 days
    },

    // Cookie Configuration
    cookie: {
      domain: env.COOKIE_DOMAIN || undefined,
      sameSite: env.COOKIE_SAME_SITE || (env.NODE_ENV === 'production' ? 'none' : 'lax'),
      secure: env.COOKIE_SECURE === 'true' || env.NODE_ENV === 'production',
    },

    // Cloudinary Configuration
    cloudinary: {
      cloudName: env.CLOUDINARY_CLOUD_NAME || '',
      apiKey: env.CLOUDINARY_API_KEY || '',
      apiSecret: env.CLOUDINARY_API_SECRET || '',
      folder: env.CLOUDINARY_FOLDER || 'luxecart/products',
    },

    // Google OAuth Configuration
    google: {
      clientId: env.GOOGLE_CLIENT_ID || '',
    },

    // Email Configuration (Resend)
    email: {
      resendApiKey: env.RESEND_API_KEY || '',
      from: env.EMAIL_FROM || 'LuxeCart <onboarding@resend.dev>',
    },
  };
};

/**
 * Default validated configuration instance
 */
export const config = createConfig(process.env);

