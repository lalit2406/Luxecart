import React, { useState, useEffect, useId } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { adminExportApi, triggerBlobDownload, parseBlobError } from '../../features/admin/exports/api/adminExportApi';
import { adminCategoryApi } from '../../features/admin/api/adminCategoryApi';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShoppingBag,
  Users,
  Package,
  Tag,
  RotateCcw,
  BarChart3,
  Info,
  Clock,
  RotateCcw as ResetIcon,
  ShieldAlert,
} from 'lucide-react';

// Format calendar date into YYYY-MM-DD string without timezone drift
const formatDateOnly = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getDatePresetRange = (preset) => {
  const today = new Date();
  const todayStr = formatDateOnly(today);

  switch (preset) {
    case 'today':
      return { from: todayStr, to: todayStr };
    case '7d': {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { from: formatDateOnly(d), to: todayStr };
    }
    case '30d': {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return { from: formatDateOnly(d), to: todayStr };
    }
    case 'this_month': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: formatDateOnly(firstDay), to: todayStr };
    }
    case 'all_time':
    default:
      return { from: '', to: '' };
  }
};

const CATEGORIES = [
  {
    id: 'orders',
    title: 'Orders & Sales',
    icon: ShoppingBag,
    description: 'Export customer orders with complete pricing, tax, shipping, and delivery snapshots. Choose between order summary or line-item breakdown.',
    supportsDates: true,
  },
  {
    id: 'customers',
    title: 'Customers',
    icon: Users,
    description: 'Export registered customer accounts with contact details, verification status, lifetime orders, and cumulative spending. Sensitive secrets are permanently excluded.',
    supportsDates: true,
  },
  {
    id: 'products',
    title: 'Products & Inventory',
    icon: Package,
    description: 'Export complete product catalog data by variant, including SKUs, barcodes, physical stock, reserved reservations, safety levels, and Rupee pricing.',
    supportsDates: false,
  },
  {
    id: 'coupons',
    title: 'Coupons & Promotions',
    icon: Tag,
    description: 'Export promotional discount codes, discount rules, redemption thresholds, usage caps, validity schedules, and active statuses.',
    supportsDates: false,
  },
  {
    id: 'returns',
    title: 'Returns & Refunds',
    icon: RotateCcw,
    description: 'Export customer return tickets, return motivations, inspected item quantities, and processed refund amounts converted to Rupees.',
    supportsDates: true,
  },
  {
    id: 'sales-summary',
    title: 'Sales Summary',
    icon: BarChart3,
    description: 'Export periodic executive analytics aggregated by day, week, or month, tracking order volume, delivered fulfillment, gross sales, and net revenue.',
    supportsDates: true,
  },
];

export default function AdminExportsPage() {
  const [selectedCategory, setSelectedCategory] = useState('orders');
  const [format, setFormat] = useState('csv'); // 'csv' | 'xlsx'
  const [activePreset, setActivePreset] = useState('all_time');

  // Shared Date Range
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  // Category Specific Filter States
  const [ordersFilters, setOrdersFilters] = useState({
    type: 'summary', // 'summary' | 'itemized'
    status: 'ALL',
    paymentStatus: 'ALL',
    orderType: 'LIVE', // 'LIVE' | 'DEMO' | 'ALL'
  });

  const [customersFilters, setCustomersFilters] = useState({
    status: 'ALL', // 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE'
  });

  const [productsFilters, setProductsFilters] = useState({
    category: '',
    status: 'ALL', // 'ALL' | 'ACTIVE' | 'DRAFT' | 'ARCHIVED'
    stockStatus: 'ALL', // 'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  });

  const [couponsFilters, setCouponsFilters] = useState({
    status: 'ALL', // 'ALL' | 'ACTIVE' | 'EXPIRED'
  });

  const [returnsFilters, setReturnsFilters] = useState({
    status: 'ALL', // 'ALL' | 'REQUESTED' | 'APPROVED' | 'PICKUP_SCHEDULED' | 'RECEIVED' | 'REFUNDED' | 'REJECTED'
  });

  const [salesSummaryFilters, setSalesSummaryFilters] = useState({
    groupBy: 'day', // 'day' | 'week' | 'month'
    orderType: 'LIVE', // 'LIVE' | 'DEMO' | 'ALL'
  });

  // Dynamic Categories from API
  const [categoryList, setCategoryList] = useState([]);

  // Execution & Feedback States
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

  // Load Categories for Products filter
  useEffect(() => {
    adminCategoryApi
      .getCategories()
      .then((res) => {
        const cats = res?.data?.categories || res?.data || [];
        setCategoryList(Array.isArray(cats) ? cats : []);
      })
      .catch(() => {});
  }, []);

  // Quick Preset Click Handler
  const handlePresetClick = (presetKey) => {
    setActivePreset(presetKey);
    const range = getDatePresetRange(presetKey);
    setDateRange(range);
    setErrorMessage(null);
  };

  // Manual Date Input Change
  const handleDateChange = (field, value) => {
    setActivePreset('custom');
    setDateRange((prev) => ({ ...prev, [field]: value }));
    setErrorMessage(null);
  };

  // Date Order Validation
  const isDateOrderInvalid = Boolean(
    dateRange.from && dateRange.to && dateRange.from > dateRange.to
  );

  // Reset Filters for current category
  const handleResetFilters = () => {
    setActivePreset('all_time');
    setDateRange({ from: '', to: '' });
    setErrorMessage(null);
    setSuccessInfo(null);

    if (selectedCategory === 'orders') {
      setOrdersFilters({ type: 'summary', status: 'ALL', paymentStatus: 'ALL', orderType: 'LIVE' });
    } else if (selectedCategory === 'customers') {
      setCustomersFilters({ status: 'ALL' });
    } else if (selectedCategory === 'products') {
      setProductsFilters({ category: '', status: 'ALL', stockStatus: 'ALL' });
    } else if (selectedCategory === 'coupons') {
      setCouponsFilters({ status: 'ALL' });
    } else if (selectedCategory === 'returns') {
      setReturnsFilters({ status: 'ALL' });
    } else if (selectedCategory === 'sales-summary') {
      setSalesSummaryFilters({ groupBy: 'day', orderType: 'LIVE' });
    }
  };

  // Trigger File Download
  const handleDownload = async () => {
    if (isDownloading) return;
    if (isDateOrderInvalid) {
      setErrorMessage("'From' date cannot be after 'To' date. Please correct the range.");
      return;
    }

    setIsDownloading(true);
    setErrorMessage(null);
    setSuccessInfo(null);

    try {
      let result;
      const baseParams = {
        format,
        from: dateRange.from || undefined,
        to: dateRange.to || undefined,
      };

      switch (selectedCategory) {
        case 'orders':
          result = await adminExportApi.exportOrders({
            ...baseParams,
            type: ordersFilters.type,
            status: ordersFilters.status !== 'ALL' ? ordersFilters.status : undefined,
            paymentStatus: ordersFilters.paymentStatus !== 'ALL' ? ordersFilters.paymentStatus : undefined,
            orderType: ordersFilters.orderType,
          });
          break;

        case 'customers':
          result = await adminExportApi.exportCustomers({
            ...baseParams,
            status: customersFilters.status !== 'ALL' ? customersFilters.status : undefined,
          });
          break;

        case 'products':
          result = await adminExportApi.exportProducts({
            format,
            category: productsFilters.category || undefined,
            status: productsFilters.status !== 'ALL' ? productsFilters.status : undefined,
            stockStatus: productsFilters.stockStatus !== 'ALL' ? productsFilters.stockStatus : undefined,
          });
          break;

        case 'coupons':
          result = await adminExportApi.exportCoupons({
            format,
            status: couponsFilters.status !== 'ALL' ? couponsFilters.status : undefined,
          });
          break;

        case 'returns':
          result = await adminExportApi.exportReturns({
            ...baseParams,
            status: returnsFilters.status !== 'ALL' ? returnsFilters.status : undefined,
          });
          break;

        case 'sales-summary':
          result = await adminExportApi.exportSalesSummary({
            ...baseParams,
            groupBy: salesSummaryFilters.groupBy,
            orderType: salesSummaryFilters.orderType,
          });
          break;

        default:
          throw new Error('Unsupported export category');
      }

      // Trigger standard browser download
      triggerBlobDownload(result.data, result.filename);

      setSuccessInfo({
        filename: result.filename,
        category: CATEGORIES.find((c) => c.id === selectedCategory)?.title || 'Data',
      });
    } catch (err) {
      const parsedErr = await parseBlobError(err);
      setErrorMessage(parsedErr.message || 'An error occurred while generating the export.');
    } finally {
      setIsDownloading(false);
    }
  };

  const currentCatMeta = CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0];

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#2A211B] flex items-center gap-2.5">
              <Download className="w-6 h-6 text-[#9A6A45]" />
              <span>Business Data Exports</span>
            </h1>
            <p className="text-xs text-[#6F6963] mt-1">
              Export enterprise reports, fulfillment records, catalog data, and financial snapshots in CSV and Excel formats.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#F7F3EE] px-3.5 py-1.5 rounded-xl border border-[#E7DED5] text-xs text-[#6F6963]">
            <Clock className="w-3.5 h-3.5 text-[#9A6A45]" />
            <span>IST Timezone (UTC+5:30) &bull; Max 25,000 Records</span>
          </div>
        </div>

        {/* Global Feedback Banners */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs shadow-xs"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-900">Export Failed</p>
              <p className="mt-0.5 text-red-700">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-red-700 cursor-pointer font-bold ml-2"
              aria-label="Dismiss error"
            >
              &times;
            </button>
          </div>
        )}

        {successInfo && (
          <div
            role="status"
            className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-900">Download Initiated Successfully</p>
              <p className="mt-0.5 text-emerald-700">
                File <span className="font-mono font-medium">{successInfo.filename}</span> has been saved to your downloads.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSuccessInfo(null)}
              className="text-emerald-400 hover:text-emerald-700 cursor-pointer font-bold ml-2"
              aria-label="Dismiss message"
            >
              &times;
            </button>
          </div>
        )}

        {/* Category Navigation Tabs / Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setErrorMessage(null);
                  setSuccessInfo(null);
                }}
                disabled={isDownloading}
                className={`flex flex-col items-center justify-center text-center p-3.5 rounded-2xl border transition-all cursor-pointer text-xs ${
                  isSelected
                    ? 'bg-[#2A211B] text-white border-[#2A211B] shadow-sm font-semibold'
                    : 'bg-white text-[#2A211B] border-[#E7DED5] hover:bg-[#F7F3EE] hover:border-[#D1C7BD]'
                } ${isDownloading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <Icon className={`w-5 h-5 mb-2 ${isSelected ? 'text-[#C9A27E]' : 'text-[#9A6A45]'}`} />
                <span className="truncate w-full font-medium">{cat.title}</span>
              </button>
            );
          })}
        </div>

        {/* Main Export Configuration Card */}
        <div className="bg-white rounded-2xl border border-[#E7DED5] p-5 sm:p-6 shadow-xs space-y-6">
          {/* Active Category Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E7DED5] gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#F7F3EE] border border-[#E7DED5] text-[#9A6A45]">
                {React.createElement(currentCatMeta.icon, { className: 'w-5 h-5' })}
              </div>
              <div>
                <h2 className="text-base font-bold text-[#2A211B] flex items-center gap-2">
                  <span>{currentCatMeta.title} Export</span>
                  <span className="text-[10px] uppercase tracking-wide bg-[#F7F3EE] text-[#9A6A45] px-2 py-0.5 rounded-full border border-[#E7DED5]">
                    {format.toUpperCase()}
                  </span>
                </h2>
                <p className="text-xs text-[#6F6963] mt-0.5 max-w-2xl">{currentCatMeta.description}</p>
              </div>
            </div>

            {/* Format Selector Pills */}
            <div className="flex items-center gap-2 self-start sm:self-auto bg-[#F7F3EE] p-1 rounded-xl border border-[#E7DED5]">
              <button
                type="button"
                onClick={() => setFormat('csv')}
                disabled={isDownloading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  format === 'csv'
                    ? 'bg-white text-[#2A211B] shadow-xs border border-[#E7DED5]'
                    : 'text-[#6F6963] hover:text-[#2A211B]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                disabled={isDownloading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  format === 'xlsx'
                    ? 'bg-white text-[#2A211B] shadow-xs border border-[#E7DED5]'
                    : 'text-[#6F6963] hover:text-[#2A211B]'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Section: Category-Specific Filters */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6F6963] flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#9A6A45]" />
              <span>Category Filters</span>
            </h3>

            {/* 1. Orders Filters */}
            {selectedCategory === 'orders' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#2A211B] mb-1.5">
                    Export Granularity
                  </label>
                  <select
                    value={ordersFilters.type}
                    onChange={(e) => setOrdersFilters((prev) => ({ ...prev, type: e.target.value }))}
                    disabled={isDownloading}
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  >
                    <option value="summary">Summary (1 Row per Order)</option>
                    <option value="itemized">Itemized (1 Row per Item)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2A211B] mb-1.5">
                    Order Status
                  </label>
                  <select
                    value={ordersFilters.status}
                    onChange={(e) => setOrdersFilters((prev) => ({ ...prev, status: e.target.value }))}
                    disabled={isDownloading}
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  >
                    <option value="ALL">All Order Statuses</option>
                    <option value="PLACED">PLACED</option>
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="PROCESSING">PROCESSING</option>
                    <option value="SHIPPED">SHIPPED</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2A211B] mb-1.5">
                    Payment Status
                  </label>
                  <select
                    value={ordersFilters.paymentStatus}
                    onChange={(e) => setOrdersFilters((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                    disabled={isDownloading}
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  >
                    <option value="ALL">All Payment Statuses</option>
                    <option value="PENDING">PENDING</option>
                    <option value="PAID">PAID</option>
                    <option value="FAILED">FAILED</option>
                    <option value="REFUNDED">REFUNDED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2A211B] mb-1.5">
                    Dataset Scope
                  </label>
                  <select
                    value={ordersFilters.orderType}
                    onChange={(e) => setOrdersFilters((prev) => ({ ...prev, orderType: e.target.value }))}
                    disabled={isDownloading}
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  >
                    <option value="LIVE">Live Customer Orders (Default)</option>
                    <option value="DEMO">Demo Orders Only</option>
                    <option value="ALL">All Orders (Live & Demo)</option>
                  </select>
                </div>
              </div>
            )}

            {/* 2. Customers Filters */}
            {selectedCategory === 'customers' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#2A211B] mb-1.5">
                    Account Standing
                  </label>
                  <select
                    value={customersFilters.status}
                    onChange={(e) => setCustomersFilters((prev) => ({ ...prev, status: e.target.value }))}
                    disabled={isDownloading}
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  >
                    <option value="ALL">All Account Statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>
            )}

            {/* 3. Products Filters */}
            {selectedCategory === 'products' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#2A211B] mb-1.5">
                    Product Category
                  </label>
                  <select
                    value={productsFilters.category}
                    onChange={(e) => setProductsFilters((prev) => ({ ...prev, category: e.target.value }))}
                    disabled={isDownloading}
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  >
                    <option value="">All Categories</option>
                    {categoryList.map((cat) => (
                      <option key={cat._id || cat.slug} value={cat.slug || cat._id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2A211B] mb-1.5">
                    Catalog Status
                  </label>
                  <select
                    value={productsFilters.status}
                    onChange={(e) => setProductsFilters((prev) => ({ ...prev, status: e.target.value }))}
                    disabled={isDownloading}
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2A211B] mb-1.5">
                    Inventory Level
                  </label>
                  <select
                    value={productsFilters.stockStatus}
                    onChange={(e) => setProductsFilters((prev) => ({ ...prev, stockStatus: e.target.value }))}
                    disabled={isDownloading}
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  >
                    <option value="ALL">All Stock Levels</option>
                    <option value="LOW_STOCK">Low Stock Alert (&le; 10 total units)</option>
                    <option value="OUT_OF_STOCK">Out of Stock</option>
                  </select>
                </div>
              </div>
            )}

            {/* 4. Coupons Filters */}
            {selectedCategory === 'coupons' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#2A211B] mb-1.5">
                    Promotion Status
                  </label>
                  <select
                    value={couponsFilters.status}
                    onChange={(e) => setCouponsFilters((prev) => ({ ...prev, status: e.target.value }))}
                    disabled={isDownloading}
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  >
                    <option value="ALL">All Promotions</option>
                    <option value="ACTIVE">ACTIVE (Valid & In-Date)</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>
              </div>
            )}

            {/* 5. Returns Filters */}
            {selectedCategory === 'returns' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#2A211B] mb-1.5">
                    Return Resolution Status
                  </label>
                  <select
                    value={returnsFilters.status}
                    onChange={(e) => setReturnsFilters((prev) => ({ ...prev, status: e.target.value }))}
                    disabled={isDownloading}
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  >
                    <option value="ALL">All Return Statuses</option>
                    <option value="REQUESTED">REQUESTED</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="PICKUP_SCHEDULED">PICKUP_SCHEDULED</option>
                    <option value="RECEIVED">RECEIVED</option>
                    <option value="REFUNDED">REFUNDED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>
            )}

            {/* 6. Sales Summary Filters */}
            {selectedCategory === 'sales-summary' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#2A211B] mb-1.5">
                    Summary Aggregation Period
                  </label>
                  <select
                    value={salesSummaryFilters.groupBy}
                    onChange={(e) => setSalesSummaryFilters((prev) => ({ ...prev, groupBy: e.target.value }))}
                    disabled={isDownloading}
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  >
                    <option value="day">Daily Breakdown (Day-by-Day)</option>
                    <option value="week">Weekly Breakdown (ISO Weeks)</option>
                    <option value="month">Monthly Overview (Month-by-Month)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2A211B] mb-1.5">
                    Dataset Scope
                  </label>
                  <select
                    value={salesSummaryFilters.orderType}
                    onChange={(e) => setSalesSummaryFilters((prev) => ({ ...prev, orderType: e.target.value }))}
                    disabled={isDownloading}
                    className="w-full px-3 py-2 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  >
                    <option value="LIVE">Live Customer Orders (Default)</option>
                    <option value="DEMO">Demo Orders Only</option>
                    <option value="ALL">All Orders (Live & Demo)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Section: Shared Date Range Controls (When applicable) */}
          {currentCatMeta.supportsDates && (
            <div className="space-y-4 pt-4 border-t border-[#E7DED5]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#6F6963] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#9A6A45]" />
                  <span>Date Window (IST Calendar Dates)</span>
                </h3>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'today', label: 'Today' },
                    { id: '7d', label: 'Last 7 Days' },
                    { id: '30d', label: 'Last 30 Days' },
                    { id: 'this_month', label: 'This Month' },
                    { id: 'all_time', label: 'All Time' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetClick(preset.id)}
                      disabled={isDownloading}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        activePreset === preset.id
                          ? 'bg-[#2A211B] text-white'
                          : 'bg-[#F7F3EE] text-[#6F6963] hover:text-[#2A211B] hover:bg-[#EAE4DC]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#2A211B] mb-1.5">
                    From Date (00:00:00 IST)
                  </label>
                  <input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => handleDateChange('from', e.target.value)}
                    disabled={isDownloading}
                    className={`w-full px-3 py-2 bg-[#F7F3EE] border rounded-xl text-xs text-[#2A211B] focus:outline-none ${
                      isDateOrderInvalid
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-[#E7DED5] focus:border-[#2A211B]'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#2A211B] mb-1.5">
                    To Date (23:59:59 IST)
                  </label>
                  <input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => handleDateChange('to', e.target.value)}
                    disabled={isDownloading}
                    className={`w-full px-3 py-2 bg-[#F7F3EE] border rounded-xl text-xs text-[#2A211B] focus:outline-none ${
                      isDateOrderInvalid
                        ? 'border-red-400 focus:border-red-500'
                        : 'border-[#E7DED5] focus:border-[#2A211B]'
                    }`}
                  />
                </div>
              </div>

              {isDateOrderInvalid && (
                <p className="text-xs text-red-600 font-medium">
                  &bull; Start date cannot be after end date.
                </p>
              )}
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#E7DED5]">
            <div className="flex items-center gap-2 text-xs text-[#6F6963]">
              <Info className="w-4 h-4 text-[#9A6A45] shrink-0" />
              <span>
                Streaming OpenXML/CSV pipeline guarantees memory safety. Retries automatically if connection pauses.
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={isDownloading}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-[#E7DED5] text-xs font-semibold text-[#2A211B] hover:bg-[#F7F3EE] transition-colors cursor-pointer disabled:opacity-50"
              >
                <ResetIcon className="w-3.5 h-3.5 text-[#6F6963]" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading || isDateOrderInvalid}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#2A211B] text-white text-xs font-semibold hover:bg-[#3D3027] transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Preparing Export...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 text-white" />
                    <span>Download {format.toUpperCase()}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
