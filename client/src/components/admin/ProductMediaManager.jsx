import React, { useState, useRef } from 'react';
import { adminMediaApi } from '../../features/admin/api/adminMediaApi';
import {
  UploadCloud,
  Star,
  Trash2,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Image as ImageIcon,
  Check,
} from 'lucide-react';

export default function ProductMediaManager({ productId, images = [], onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const maxImages = 10;
  const currentCount = images.length;
  const canUploadMore = currentCount < maxImages;

  const handleFiles = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setSuccess(null);

    const filesToUpload = Array.from(fileList);

    if (currentCount + filesToUpload.length > maxImages) {
      setError(`Cannot upload ${filesToUpload.length} images. Maximum limit is ${maxImages} images per product (${currentCount} already uploaded).`);
      return;
    }

    // Validate client side sizes and formats
    for (const file of filesToUpload) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError(`Invalid file type "${file.name}". Only JPG, PNG, and WebP images are allowed.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds 5 MB maximum size limit.`);
        return;
      }
    }

    const formData = new FormData();
    filesToUpload.forEach((file) => {
      formData.append('images', file);
    });

    setUploading(true);
    setUploadProgress(10);

    try {
      const res = await adminMediaApi.uploadMedia(productId, formData, (progressEvent) => {
        if (progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });

      setSuccess(`${filesToUpload.length} image(s) uploaded successfully.`);
      if (onUpdate && res?.data?.product) {
        onUpdate(res.data.product);
      }
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message || 'Failed to upload images');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (!canUploadMore) return;
    handleFiles(e.dataTransfer.files);
  };

  const handleSetPrimary = async (mediaId) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await adminMediaApi.setPrimaryMedia(productId, mediaId);
      setSuccess('Primary image updated.');
      if (onUpdate && res?.data?.product) {
        onUpdate(res.data.product);
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update primary image');
    }
  };

  const handleDelete = async (mediaId) => {
    if (!window.confirm('Are you sure you want to delete this image? It will be removed from Cloudinary.')) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      const res = await adminMediaApi.deleteMedia(productId, mediaId);
      setSuccess('Image deleted successfully.');
      if (onUpdate && res?.data?.product) {
        onUpdate(res.data.product);
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete image');
    }
  };

  const handleMove = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const payload = reordered.map((img, idx) => ({
      mediaId: img._id || img.publicId,
      displayOrder: idx,
    }));

    try {
      const res = await adminMediaApi.reorderMedia(productId, payload);
      if (onUpdate && res?.data?.product) {
        onUpdate(res.data.product);
      }
    } catch (err) {
      setError(err.message || 'Failed to reorder images');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with image count */}
      <div className="flex items-center justify-between border-b border-[#E7DED5] pb-3">
        <div>
          <h3 className="text-base font-serif font-bold text-[#2A211B]">
            Product Media Gallery
          </h3>
          <p className="text-xs text-[#6F6963]">
            High-resolution assets stored securely in Cloudinary with automated WebP/responsive delivery.
          </p>
        </div>
        <span className="px-3 py-1 bg-[#F7F3EE] rounded-full border border-[#E7DED5] text-xs font-mono font-semibold text-[#2A211B]">
          {currentCount} / {maxImages} Images
        </span>
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dropzone */}
      {canUploadMore ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer ${
            dragOver
              ? 'border-[#9A6A45] bg-[#9A6A45]/5 scale-[1.01]'
              : 'border-[#E7DED5] bg-[#F7F3EE]/50 hover:bg-[#F7F3EE] hover:border-[#2A211B]'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />

          <div className="max-w-sm mx-auto space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white border border-[#E7DED5] flex items-center justify-center mx-auto text-[#9A6A45] shadow-xs">
              {uploading ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <UploadCloud className="w-6 h-6" />
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-[#2A211B]">
                {uploading
                  ? `Uploading to Cloudinary (${uploadProgress}%)...`
                  : 'Drop product images here, or browse files'}
              </p>
              <p className="text-[11px] text-[#6F6963] mt-0.5">
                Supports JPG, PNG, WebP up to 5 MB each.
              </p>
            </div>

            {uploading && (
              <div className="w-full bg-[#E7DED5] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-[#9A6A45] h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs text-center font-medium">
          Maximum limit of {maxImages} images reached. Delete an image to upload a new asset.
        </div>
      )}

      {/* Gallery Cards Grid */}
      {images.length === 0 ? (
        <div className="py-12 bg-[#F7F3EE]/40 border border-[#E7DED5] rounded-2xl text-center space-y-2">
          <ImageIcon className="w-8 h-8 text-[#9A6A45] mx-auto opacity-50" />
          <p className="text-xs font-semibold text-[#2A211B]">No product images uploaded yet.</p>
          <p className="text-[11px] text-[#6F6963]">
            Products require at least one image with a primary selection before publishing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {images.map((img, idx) => {
            const mediaId = img._id || img.publicId;
            const isPrimary = img.isPrimary;

            return (
              <div
                key={mediaId || idx}
                className={`relative group bg-white rounded-2xl border overflow-hidden shadow-xs flex flex-col justify-between transition-all ${
                  isPrimary ? 'border-[#9A6A45] ring-2 ring-[#9A6A45]/20' : 'border-[#E7DED5]'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative aspect-4/5 w-full bg-[#F7F3EE] overflow-hidden">
                  <img
                    src={img.url}
                    alt={img.alt || `Product Image ${idx + 1}`}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />

                  {/* Primary Badge */}
                  {isPrimary && (
                    <div className="absolute top-2 left-2 bg-[#9A6A45] text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      <span>Primary</span>
                    </div>
                  )}

                  {/* Reorder Buttons */}
                  <div className="absolute bottom-2 inset-x-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-xs p-1 rounded-xl">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, -1)}
                      className="p-1 text-white hover:text-[#9A6A45] disabled:opacity-30 disabled:hover:text-white cursor-pointer"
                      title="Move Left"
                      aria-label="Move image left"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] text-white font-mono font-bold">#{idx + 1}</span>
                    <button
                      type="button"
                      disabled={idx === images.length - 1}
                      onClick={() => handleMove(idx, 1)}
                      className="p-1 text-white hover:text-[#9A6A45] disabled:opacity-30 disabled:hover:text-white cursor-pointer"
                      title="Move Right"
                      aria-label="Move image right"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-2.5 bg-white border-t border-[#E7DED5] flex items-center justify-between gap-1">
                  {!isPrimary ? (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(mediaId)}
                      className="text-[10px] font-semibold text-[#6F6963] hover:text-[#9A6A45] flex items-center gap-1 cursor-pointer"
                      title="Set as primary"
                    >
                      <Star className="w-3 h-3" />
                      <span>Make Primary</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-semibold text-[#9A6A45] flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Cover Image</span>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(mediaId)}
                    className="p-1 text-[#6F6963] hover:text-red-700 rounded transition-colors cursor-pointer"
                    title="Delete Image"
                    aria-label="Delete image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
