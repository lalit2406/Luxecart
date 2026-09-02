import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { adminImportApi } from '../../features/admin/api/adminImportApi';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Package,
  Layers,
  FileText,
  Clock,
  Check,
  X,
} from 'lucide-react';

export default function AdminProductImportPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Load past import jobs
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await adminImportApi.getImportJobs({ limit: 10 });
      setHistory(res?.data || []);
    } catch (err) {
      // Non-blocking history load
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const name = file.name.toLowerCase();

    if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) {
      setError('Invalid file format. Please upload a .csv or .xlsx spreadsheet file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10 MB maximum limit.');
      return;
    }

    setError(null);
    setExecutionResult(null);
    setSelectedFile(file);

    // Auto-trigger preview
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await adminImportApi.previewImport(formData);
      setPreview(res?.data);
    } catch (err) {
      setError(err.message || 'Failed to parse spreadsheet preview');
      setPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleExecuteImport = async () => {
    if (!preview?.importId) return;
    setExecuting(true);
    setError(null);

    try {
      const res = await adminImportApi.executeImport(preview.importId);
      setExecutionResult(res?.data);
      setPreview(null);
      setSelectedFile(null);
      await loadHistory();
    } catch (err) {
      setError(err.message || 'Failed to execute import');
    } finally {
      setExecuting(false);
    }
  };

  const handleDownloadTemplate = async (format) => {
    try {
      await adminImportApi.downloadTemplate(format);
    } catch (err) {
      setError('Failed to download template: ' + (err.message || 'Error'));
    }
  };

  const handleDownloadErrors = async (jobId) => {
    try {
      await adminImportApi.downloadErrorCsv(jobId);
    } catch (err) {
      setError('Failed to download error report: ' + (err.message || 'Error'));
    }
  };

  return (
    <AdminLayout>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7DED5] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B]">
            Bulk Product Import
          </h1>
          <p className="text-xs text-[#6F6963] mt-1">
            Upload CSV or Excel spreadsheets to batch create products, variant matrices, and initial inventory balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadTemplate('csv')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#9A6A45]" />
            <span>CSV Template</span>
          </button>
          <button
            onClick={() => handleDownloadTemplate('xlsx')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] text-xs font-semibold shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Excel Template</span>
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section 1: Execution Success Result Banner */}
      {executionResult && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 sm:p-8 space-y-4 text-emerald-950 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-serif font-bold">
                Import Process Completed ({executionResult.status})
              </h2>
              <p className="text-xs text-emerald-800 mt-0.5">
                {executionResult.message}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
            <div className="bg-white/80 p-3 rounded-xl border border-emerald-200">
              <span className="text-[#6F6963] block">Products Created</span>
              <span className="text-lg font-bold font-mono text-[#2A211B]">
                {executionResult.productsCreated} (DRAFT)
              </span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-emerald-200">
              <span className="text-[#6F6963] block">Variants Created</span>
              <span className="text-lg font-bold font-mono text-[#2A211B]">
                {executionResult.variantsCreated}
              </span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-emerald-200">
              <span className="text-[#6F6963] block">Valid Rows</span>
              <span className="text-lg font-bold font-mono text-emerald-700">
                {executionResult.validRows}
              </span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-emerald-200">
              <span className="text-[#6F6963] block">Invalid Rows</span>
              <span className="text-lg font-bold font-mono text-red-600">
                {executionResult.invalidRows}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/admin/products?status=DRAFT"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors"
            >
              <span>Review Draft Products & Upload Media</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            {executionResult.invalidRows > 0 && (
              <button
                onClick={() => handleDownloadErrors(executionResult.importId)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-100 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Error Report</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Section 2: Upload Dropzone & Instructions */}
      <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E7DED5] pb-4">
          <div>
            <h2 className="text-base font-serif font-bold text-[#2A211B]">
              1. Upload Product Spreadsheet
            </h2>
            <p className="text-xs text-[#6F6963]">
              Upload a .csv or .xlsx file (Max 10 MB, up to 5,000 rows). All imported products start as DRAFT.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#6F6963] bg-[#F7F3EE] px-3 py-1.5 rounded-xl border border-[#E7DED5]">
            <span className="font-semibold text-[#2A211B]">Workflow:</span>
            <span>Preview & Validate → Confirm Import → Add Media → Publish</span>
          </div>
        </div>

        {/* Dropzone Area */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
            dragOver
              ? 'border-[#9A6A45] bg-[#9A6A45]/5 scale-[1.01]'
              : 'border-[#E7DED5] bg-[#F7F3EE]/40 hover:bg-[#F7F3EE] hover:border-[#2A211B]'
          } ${uploading || executing ? 'pointer-events-none opacity-60' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />

          <div className="max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#E7DED5] flex items-center justify-center mx-auto text-[#9A6A45] shadow-xs">
              {uploading ? (
                <RefreshCw className="w-7 h-7 animate-spin" />
              ) : (
                <UploadCloud className="w-7 h-7" />
              )}
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#2A211B]">
                {uploading
                  ? 'Parsing & validating spreadsheet...'
                  : selectedFile
                  ? `Selected: ${selectedFile.name}`
                  : 'Drop your product spreadsheet here, or browse files'}
              </p>
              <p className="text-xs text-[#6F6963]">
                Supports .CSV and .XLSX (Excel 2007+) formats with automated row validation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Preflight Preview Summary */}
      {preview && (
        <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7DED5] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-serif font-bold text-[#2A211B]">
                  2. Preflight Import Preview
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#F7F3EE] text-[#2A211B] border border-[#E7DED5]">
                  {preview.fileName} ({preview.fileType})
                </span>
              </div>
              <p className="text-xs text-[#6F6963] mt-0.5">
                Review the validation analysis below. Products are not yet saved to the database.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 rounded-xl border border-[#E7DED5] bg-white text-[#2A211B] hover:bg-[#F7F3EE] text-xs font-semibold cursor-pointer"
              >
                Cancel Preview
              </button>

              <button
                onClick={handleExecuteImport}
                disabled={executing || preview.productsCount === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-xs font-semibold disabled:opacity-50 shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {executing
                    ? 'Creating Products...'
                    : `Execute Import (${preview.productsCount} Products)`}
                </span>
              </button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#F7F3EE] border border-[#E7DED5] rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-semibold text-[#6F6963] uppercase tracking-wider">
                Total Rows
              </span>
              <p className="text-2xl font-serif font-bold text-[#2A211B]">{preview.totalRows}</p>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                Valid Rows
              </span>
              <p className="text-2xl font-serif font-bold text-emerald-700">{preview.validRows}</p>
            </div>

            <div className="bg-white border border-[#E7DED5] rounded-2xl p-4 space-y-1">
              <span className="text-[11px] font-semibold text-[#9A6A45] uppercase tracking-wider">
                Products Grouped
              </span>
              <p className="text-2xl font-serif font-bold text-[#2A211B]">
                {preview.productsCount} Drafts
              </p>
            </div>

            <div className={`rounded-2xl p-4 space-y-1 border ${
              preview.invalidRows > 0 ? 'bg-red-50 border-red-200' : 'bg-[#F7F3EE] border-[#E7DED5]'
            }`}>
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                preview.invalidRows > 0 ? 'text-red-800' : 'text-[#6F6963]'
              }`}>
                Invalid Rows
              </span>
              <p className={`text-2xl font-serif font-bold ${
                preview.invalidRows > 0 ? 'text-red-700' : 'text-[#2A211B]'
              }`}>
                {preview.invalidRows}
              </p>
            </div>
          </div>

          {/* Validation Errors Table */}
          {preview.errors?.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Validation Errors ({preview.errors.length})</span>
                </h3>
                <button
                  onClick={() => handleDownloadErrors(preview.importId)}
                  className="text-xs font-semibold text-[#9A6A45] hover:text-[#2A211B] flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Error CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto border border-red-200 rounded-2xl bg-red-50/30">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-red-200 text-red-900 uppercase font-semibold tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-4">Row</th>
                      <th className="py-2.5 px-4">Product Name</th>
                      <th className="py-2.5 px-4">SKU</th>
                      <th className="py-2.5 px-4">Error Code</th>
                      <th className="py-2.5 px-4">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-200/60 text-[#2A211B]">
                    {preview.errors.slice(0, 10).map((err, idx) => (
                      <tr key={idx} className="hover:bg-red-100/50">
                        <td className="py-2.5 px-4 font-mono font-bold text-red-800">
                          #{err.row}
                        </td>
                        <td className="py-2.5 px-4 font-semibold line-clamp-1">
                          {err.productName}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px]">
                          {err.sku}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[10px] text-red-700">
                          {err.code}
                        </td>
                        <td className="py-2.5 px-4 text-red-800 font-medium">
                          {err.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.errors.length > 10 && (
                <p className="text-[11px] text-[#6F6963] text-center">
                  Showing first 10 of {preview.errors.length} errors. Download the full CSV report for complete row details.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section 4: Past Import History */}
      <div className="bg-white border border-[#E7DED5] rounded-3xl p-6 sm:p-8 space-y-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E7DED5] pb-4">
          <div>
            <h2 className="text-base font-serif font-bold text-[#2A211B]">
              Import History & Logs
            </h2>
            <p className="text-xs text-[#6F6963]">
              Audit trail of previous bulk spreadsheet uploads.
            </p>
          </div>
          <button
            onClick={loadHistory}
            className="p-2 text-[#6F6963] hover:text-[#2A211B] rounded-xl hover:bg-[#F7F3EE] transition-colors"
            title="Refresh History"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loadingHistory ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 text-[#9A6A45] animate-spin" />
            <p className="text-xs text-[#6F6963]">Loading import history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#6F6963]">
            No previous bulk import jobs recorded.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E7DED5] text-[#6F6963] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="pb-3 pr-4">File Name</th>
                  <th className="pb-3 px-4">Format</th>
                  <th className="pb-3 px-4">Status</th>
                  <th className="pb-3 px-4">Products Created</th>
                  <th className="pb-3 px-4">Rows (Valid / Total)</th>
                  <th className="pb-3 px-4">Date</th>
                  <th className="pb-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7DED5]/60 text-[#2A211B]">
                {history.map((job) => {
                  const statusColor =
                    job.status === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : job.status === 'PARTIAL'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : job.status === 'PREVIEWED'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-red-50 text-red-700 border-red-200';

                  const dateStr = new Date(job.createdAt).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={job._id} className="hover:bg-[#F7F3EE]/50 transition-colors">
                      <td className="py-3.5 pr-4 font-semibold line-clamp-1">
                        {job.fileName}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-[#6F6963]">
                        {job.fileType}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>
                          {job.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold">
                        {job.productsCreated} Drafts ({job.variantsCreated} Variants)
                      </td>

                      <td className="py-3.5 px-4 text-[#6F6963]">
                        {job.validRows} / {job.totalRows}
                      </td>

                      <td className="py-3.5 px-4 text-[#6F6963]">
                        {dateStr}
                      </td>

                      <td className="py-3.5 pl-4 text-right">
                        {job.invalidRows > 0 ? (
                          <button
                            onClick={() => handleDownloadErrors(job._id)}
                            className="inline-flex items-center gap-1 text-[11px] text-[#9A6A45] hover:text-[#2A211B] font-semibold cursor-pointer"
                            title="Download Error Report"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Errors ({job.invalidRows})</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-700 font-semibold">Clean ✓</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
