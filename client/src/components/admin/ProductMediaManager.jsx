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

export default function ProductMediaManager({ productId, images = [], variants = [], onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Extract distinct colorways from variants
  const distinctColors = React.useMemo(() => {
    const colorNames = (variants || [])
      .map((v) => v.attributes?.color?.name)
      .filter(Boolean);
    return Array.from(new Set(colorNames));
  }, [variants]);

  // Selected colorway for upload and active filter
  const [selectedColorForUpload, setSelectedColorForUpload] = useState('');
  const [activeFilterColor, setActiveFilterColor] = useState('ALL');

  // Staged files for preview before upload
  const [stagedFiles, setStagedFiles] = useState([]); // Array of { file, previewUrl, role, alt }

  const maxImages = 30;
  const currentCount = images.length;
  const canUploadMore = currentCount < maxImages;

  // Set default upload color when distinctColors change
  React.useEffect(() => {
    if (distinctColors.length > 0 && !selectedColorForUpload) {
      setSelectedColorForUpload(distinctColors[0]);
    }
  }, [distinctColors, selectedColorForUpload]);

  // Handle stage files on selection
  const handleStageFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setSuccess(null);

    const incoming = Array.from(fileList);

    if (currentCount + stagedFiles.length + incoming.length > maxImages) {
      setError(`Cannot add ${incoming.length} files. Maximum limit is ${maxImages} images per product (${currentCount} uploaded, ${stagedFiles.length} staged).`);
      return;
    }

    const roles = ['Front View', 'Back View', 'Side Profile', 'Detail / Texture', 'Editorial Look'];
    const newStaged = [];

    for (let i = 0; i < incoming.length; i++) {
      const file = incoming[i];
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError(`Invalid file type "${file.name}". Only JPG, PNG, and WebP images are allowed.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds 5 MB maximum size limit.`);
        return;
      }

      const role = roles[(stagedFiles.length + i) % roles.length];
      const previewUrl = URL.createObjectURL(file);
      newStaged.push({
        file,
        previewUrl,
        role,
        alt: `${selectedColorForUpload ? selectedColorForUpload + ' - ' : ''}${role}`,
      });
    }

    setStagedFiles((prev) => [...prev, ...newStaged]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeStagedFile = (idx) => {
    setStagedFiles((prev) => {
      const copy = [...prev];
      if (copy[idx]?.previewUrl) URL.revokeObjectURL(copy[idx].previewUrl);
      copy.splice(idx, 1);
      return copy;
    });
  };

  const handleUploadStaged = async () => {
    if (stagedFiles.length === 0) return;
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    stagedFiles.forEach((item) => {
      formData.append('images', item.file);
    });

    if (selectedColorForUpload) {
      formData.append('color', selectedColorForUpload);
    }
    stagedFiles.forEach((item) => {
      formData.append('alts[]', item.alt);
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

      // Cleanup previews
      stagedFiles.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      setStagedFiles([]);

      setSuccess(`${stagedFiles.length} image(s) uploaded successfully to ${selectedColorForUpload || 'product gallery'}.`);
      if (onUpdate && res?.data?.product) {
        onUpdate(res.data.product);
      }
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.message || 'Failed to upload images');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (!canUploadMore) return;
    handleStageFiles(e.dataTransfer.files);
  };

  const handleSetPrimary = async (mediaId) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await adminMediaApi.setPrimaryMedia(productId, mediaId);
      setSuccess('Primary product cover image updated.');
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

  // Filter gallery images by colorway
  const displayedImages = React.useMemo(() => {
    if (activeFilterColor === 'ALL') return images;
    return images.filter(
      (img) => img.color && img.color.toLowerCase() === activeFilterColor.toLowerCase()
    );
  }, [images, activeFilterColor]);

  return (
    <div className="space-y-6">
      {/* Header with image count and capacity */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E7DED5] pb-4">
        <div>
          <h3 className="text-base font-serif font-bold text-[#2A211B]">
            Product Media Gallery
          </h3>
          <p className="text-xs text-[#6F6963]">
            High-resolution assets stored securely in Cloudinary with automated WebP/responsive delivery.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-[#F7F3EE] rounded-full border border-[#E7DED5] text-xs font-mono font-semibold text-[#2A211B]">
            {currentCount} / {maxImages} Images ({maxImages - currentCount} slots remaining)
          </span>
        </div>
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

      {/* Colorway Selection Bar for Manual Upload */}
      <div className="bg-[#FAF8F5] border border-[#E7DED5] rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-[#2A211B] flex items-center gap-2">
            <span>Target Colorway for Upload:</span>
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedColorForUpload}
              onChange={(e) => setSelectedColorForUpload(e.target.value)}
              className="px-3 py-1.5 bg-white border border-[#E7DED5] rounded-xl text-xs font-semibold text-[#2A211B] focus:border-[#9A6A45] focus:outline-hidden"
            >
              <option value="">— Unassigned (Product Level) —</option>
              {distinctColors.map((colorName) => (
                <option key={colorName} value={colorName}>
                  {colorName}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-[11px] text-[#6F6963]">
          Uploaded files will automatically be tagged with this colorway and synchronized with the matching product variants.
        </p>
      </div>

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
            onChange={(e) => handleStageFiles(e.target.files)}
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
                  : `Drop images for ${selectedColorForUpload || 'product'} here, or browse files`}
              </p>
              <p className="text-[11px] text-[#6F6963] mt-0.5">
                Supports JPG, PNG, WebP up to 5 MB each. (Max {maxImages} images total)
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

      {/* Staged Previews (Review before final upload) */}
      {stagedFiles.length > 0 && (
        <div className="p-4 bg-white border border-[#9A6A45]/30 rounded-2xl space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#9A6A45]">
              Staged for Upload ({stagedFiles.length} files) — Colorway: {selectedColorForUpload || 'Default'}
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStagedFiles([])}
                className="text-[11px] text-[#6F6963] hover:text-red-700 font-semibold"
              >
                Clear All
              </button>
              <button
                type="button"
                onClick={handleUploadStaged}
                disabled={uploading}
                className="px-4 py-1.5 bg-[#2A211B] text-white hover:bg-[#9A6A45] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                <span>Upload Staged Files</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {stagedFiles.map((item, idx) => (
              <div key={idx} className="relative group rounded-xl border border-[#E7DED5] overflow-hidden bg-[#FAF8F5]">
                <div className="aspect-4/5 w-full overflow-hidden bg-stone-100">
                  <img src={item.previewUrl} alt={item.alt} className="w-full h-full object-cover" />
                </div>
                <div className="p-2 space-y-1 text-left">
                  <p className="text-[10px] font-bold text-[#2A211B] truncate">{item.file.name}</p>
                  <p className="text-[9px] text-[#6F6963]">{item.role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeStagedFile(idx)}
                  className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-red-600 text-white rounded-full transition-colors"
                  title="Remove from staging"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gallery Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7DED5] pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveFilterColor('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              activeFilterColor === 'ALL'
                ? 'bg-[#2A211B] text-white'
                : 'bg-[#F7F3EE] text-[#6F6963] hover:text-[#2A211B]'
            }`}
          >
            All Images ({images.length})
          </button>
          {distinctColors.map((cName) => {
            const count = images.filter((img) => img.color && img.color.toLowerCase() === cName.toLowerCase()).length;
            return (
              <button
                key={cName}
                type="button"
                onClick={() => setActiveFilterColor(cName)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  activeFilterColor === cName
                    ? 'bg-[#2A211B] text-white'
                    : 'bg-[#F7F3EE] text-[#6F6963] hover:text-[#2A211B]'
                }`}
              >
                {cName} ({count})
              </button>
            );
          })}
        </div>

        <span className="text-[11px] text-[#6F6963]">
          Showing {displayedImages.length} of {images.length}
        </span>
      </div>

      {/* Gallery Cards Grid */}
      {displayedImages.length === 0 ? (
        <div className="py-12 bg-[#F7F3EE]/40 border border-[#E7DED5] rounded-2xl text-center space-y-2">
          <ImageIcon className="w-8 h-8 text-[#9A6A45] mx-auto opacity-50" />
          <p className="text-xs font-semibold text-[#2A211B]">
            {activeFilterColor === 'ALL' ? 'No product images uploaded yet.' : `No images uploaded for ${activeFilterColor}.`}
          </p>
          <p className="text-[11px] text-[#6F6963]">
            Select this colorway in the upload bar above to attach photos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {displayedImages.map((img, idx) => {
            const mediaId = img._id || img.publicId;
            const isPrimary = img.isPrimary;
            const originalIndex = images.findIndex((i) => (i._id && i._id === img._id) || i.publicId === img.publicId);

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
                      <span>Cover Image</span>
                    </div>
                  )}

                  {/* Color Badge */}
                  {img.color && (
                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[9px] font-semibold px-2 py-0.5 rounded shadow-xs">
                      {img.color}
                    </div>
                  )}

                  {/* Reorder Buttons */}
                  <div className="absolute bottom-2 inset-x-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-xs p-1 rounded-xl">
                    <button
                      type="button"
                      disabled={originalIndex <= 0}
                      onClick={() => handleMove(originalIndex, -1)}
                      className="p-1 text-white hover:text-[#9A6A45] disabled:opacity-30 disabled:hover:text-white cursor-pointer"
                      title="Move Left"
                      aria-label="Move image left"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] text-white font-mono font-bold">#{img.displayOrder ?? originalIndex + 1}</span>
                    <button
                      type="button"
                      disabled={originalIndex >= images.length - 1}
                      onClick={() => handleMove(originalIndex, 1)}
                      className="p-1 text-white hover:text-[#9A6A45] disabled:opacity-30 disabled:hover:text-white cursor-pointer"
                      title="Move Right"
                      aria-label="Move image right"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Metadata inputs */}
                <div className="p-2 bg-[#FAF8F5] border-t border-[#E7DED5] space-y-1.5 text-left">
                  <div>
                    <label className="block text-[9px] font-semibold text-[#6F6963] uppercase">Alt Text</label>
                    <input
                      type="text"
                      defaultValue={img.alt || ''}
                      placeholder="e.g. Front View in Jet Black"
                      onBlur={async (e) => {
                        const val = e.target.value.trim();
                        if (val !== (img.alt || '')) {
                          try {
                            const res = await adminMediaApi.updateMediaMetadata(productId, mediaId, { alt: val });
                            if (onUpdate && res?.data?.product) onUpdate(res.data.product);
                          } catch (err) {
                            setError(err.message || 'Failed to update alt text');
                          }
                        }
                      }}
                      className="w-full text-[11px] px-1.5 py-1 bg-white border border-[#E7DED5] rounded focus:border-[#9A6A45] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-semibold text-[#6F6963] uppercase">Color Variant</label>
                    <input
                      type="text"
                      defaultValue={img.color || ''}
                      placeholder="e.g. Jet Black"
                      onBlur={async (e) => {
                        const val = e.target.value.trim();
                        if (val !== (img.color || '')) {
                          try {
                            const res = await adminMediaApi.updateMediaMetadata(productId, mediaId, { color: val });
                            if (onUpdate && res?.data?.product) onUpdate(res.data.product);
                          } catch (err) {
                            setError(err.message || 'Failed to update color tag');
                          }
                        }
                      }}
                      className="w-full text-[11px] px-1.5 py-1 bg-white border border-[#E7DED5] rounded focus:border-[#9A6A45] focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="p-2.5 bg-white border-t border-[#E7DED5] flex items-center justify-between gap-1">
                  {!isPrimary ? (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(mediaId)}
                      className="text-[10px] font-semibold text-[#6F6963] hover:text-[#9A6A45] flex items-center gap-1 cursor-pointer"
                      title="Set as product-card primary"
                    >
                      <Star className="w-3 h-3" />
                      <span>Set Cover</span>
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
