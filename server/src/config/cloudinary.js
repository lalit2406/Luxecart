import { v2 as cloudinary } from 'cloudinary';
import { config } from './env.js';

const isConfigured = Boolean(
  config.cloudinary.cloudName &&
  config.cloudinary.apiKey &&
  config.cloudinary.apiSecret
);

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
 * @param {Buffer} fileBuffer
 * @param {object} options
 * @param {string} options.folder
 * @param {string} [options.publicId]
 * @returns {Promise<{ url: string, publicId: string, width: number, height: number, format: string, bytes: number }>}
 */
export const uploadToCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!isConfigured) {
      // In development/test mock mode without live Cloudinary keys
      const mockId = `${options.folder || 'luxecart/products'}/mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return resolve({
        url: `https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1000&mock=${Date.now()}`,
        publicId: mockId,
        width: 1200,
        height: 1500,
        format: 'webp',
        bytes: fileBuffer.length || 150000,
      });
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
 * @returns {Promise<boolean>}
 */
export const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return true;

  if (!isConfigured || publicId.includes('mock_')) {
    return true;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok' || result.result === 'not found';
  } catch (err) {
    // Log internally but do not crash application
    console.error(`[Cloudinary] Failed to destroy asset ${publicId}:`, err.message);
    return false;
  }
};

export default cloudinary;
