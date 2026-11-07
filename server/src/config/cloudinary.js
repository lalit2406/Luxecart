import { v2 as cloudinary } from 'cloudinary';
import { config } from './env.js';

/**
 * Checks whether all required Cloudinary credentials are provided and non-empty
 * @param {object} [cloudinaryConfig=config.cloudinary]
 * @returns {boolean}
 */
export const isCloudinaryConfigured = (cloudinaryConfig = config.cloudinary) => {
  return Boolean(
    cloudinaryConfig &&
    typeof cloudinaryConfig.cloudName === 'string' &&
    cloudinaryConfig.cloudName.trim() &&
    typeof cloudinaryConfig.apiKey === 'string' &&
    cloudinaryConfig.apiKey.trim() &&
    typeof cloudinaryConfig.apiSecret === 'string' &&
    cloudinaryConfig.apiSecret.trim()
  );
};

const isConfigured = isCloudinaryConfigured(config.cloudinary);

if (isConfigured) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
}

/**
 * Upload a file buffer directly to Cloudinary using upload_stream
 *
 * In production mode (NODE_ENV === 'production'):
 * - Strictly requires valid Cloudinary credentials; never falls back to mock/Unsplash URLs.
 * - Fails with clear non-sensitive configuration error if credentials are missing.
 * - Requires real Cloudinary upload to succeed.
 *
 * In non-production mode:
 * - Allows development mock uploads when Cloudinary credentials are absent.
 *
 * @param {Buffer} fileBuffer
 * @param {object} [options={}]
 * @param {string} [options.folder]
 * @param {string} [options.publicId]
 * @param {boolean} [options.isProduction]
 * @returns {Promise<{ url: string, publicId: string, width: number, height: number, format: string, bytes: number }>}
 */
export const uploadToCloudinary = (fileBuffer, options = {}) => {
  const isProd = options.isProduction !== undefined ? options.isProduction : config.isProduction;
  const configured = options.cloudinaryConfig !== undefined
    ? isCloudinaryConfigured(options.cloudinaryConfig)
    : isCloudinaryConfigured(config.cloudinary);

  return new Promise((resolve, reject) => {
    if (isProd) {
      if (!configured) {
        const error = new Error(
          '[Config Error] Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing or incomplete. Mock uploads are strictly prohibited in production.'
        );
        error.statusCode = 500;
        error.code = 'CLOUDINARY_NOT_CONFIGURED';
        return reject(error);
      }
    } else {
      // In development / test mode without Cloudinary keys, use local development mock
      if (!configured) {
        const mockFolder = options.folder || config.cloudinary.folder || 'luxecart/products';
        const mockId = `${mockFolder}/mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        return resolve({
          url: `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1000&mock=${Date.now()}`,
          publicId: mockId,
          width: 1200,
          height: 1500,
          format: 'webp',
          bytes: fileBuffer ? fileBuffer.length : 150000,
        });
      }
    }

    const uploadOptions = {
      folder: options.folder || config.cloudinary.folder,
      resource_type: 'image',
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' },
      ],
    };

    if (options.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        return reject(new Error(`Cloudinary upload failed: ${error.message}`));
      }
      if (!result || !result.secure_url) {
        return reject(new Error('Cloudinary upload failed: Invalid response from provider'));
      }
      return resolve({
        url: result.secure_url || result.url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      });
    });

    stream.end(fileBuffer);
  });
};

/**
 * Delete an asset from Cloudinary by public ID
 * @param {string} publicId
 * @param {object} [options={}]
 * @param {boolean} [options.isProduction]
 * @param {object} [options.cloudinaryConfig]
 * @returns {Promise<boolean>}
 */
export const deleteFromCloudinary = async (publicId, options = {}) => {
  if (!publicId) return true;

  const isProd = options.isProduction !== undefined ? options.isProduction : config.isProduction;
  const configured = options.cloudinaryConfig !== undefined
    ? isCloudinaryConfigured(options.cloudinaryConfig)
    : isCloudinaryConfigured(config.cloudinary);

  if (isProd) {
    if (!configured) {
      console.error('[Cloudinary Config Error] Cannot delete asset in production: Cloudinary credentials are not configured.');
      return false;
    }
    if (publicId.includes('mock_')) {
      console.warn(`[Cloudinary Warning] Attempted to delete mock asset ID "${publicId}" in production environment.`);
      return true;
    }
  } else {
    if (!configured || publicId.includes('mock_')) {
      return true;
    }
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok' || result.result === 'not found';
  } catch (err) {
    console.error(`[Cloudinary] Failed to destroy asset ${publicId}:`, err.message);
    return false;
  }
};

export default cloudinary;
