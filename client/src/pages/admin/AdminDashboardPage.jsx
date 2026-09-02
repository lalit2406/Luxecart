import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { adminAnalyticsApi } from '../../features/admin/analytics/api/adminAnalyticsApi';
import { formatPaiseToINR, formatCompactPaise } from '../../utils/currency';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  RotateCcw,
  Package,
  Layers,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  BarChart3,
  Search,
  ArrowUpDown,
  Sparkles,
  Award,
  PieChart,
  UserCheck,
  UserPlus,
  Crown,
  Percent,
  Boxes,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

const DATE_RANGES = [
  { label: 'Last 7 Days', value: '7d' },
  { label: 'Last 30 Days', value: '30d' },
  { label: 'This Year', value: 'this_year' },
  { label: 'All Time', value: 'all' },
];

export default function AdminDashboardPage() {
  const [selectedRange, setSelectedRange] = useState('30d');

  // Executive summary & trend state
  const [summaryData, setSummaryData] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);

  // Product performance analytics state
  const [productAnalytics, setProductAnalytics] = useState([]);
  const [productPagination, setProductPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [productSortBy, setProductSortBy] = useState('revenue');
  const [productSortOrder, setProductSortOrder] = useState('desc');
  const [productSearch, setProductSearch] = useState('');
  const [productLoading, setProductLoading] = useState(true);
  const [productError, setProductError] = useState(null);

  // Category performance analytics state
  const [categoryAnalytics, setCategoryAnalytics] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState(null);

  // Customer cohort analytics state
  const [customerAnalytics, setCustomerAnalytics] = useState([]);
  const [customerSummary, setCustomerSummary] = useState(null);
  const [customerPagination, setCustomerPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [customerSortBy, setCustomerSortBy] = useState('revenue');
  const [customerSortOrder, setCustomerSortOrder] = useState('desc');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSegment, setCustomerSegment] = useState('');
  const [customerLoading, setCustomerLoading] = useState(true);
  const [customerError, setCustomerError] = useState(null);

  // Order distribution state
  const [orderDistribution, setOrderDistribution] = useState(null);
  const [distributionLoading, setDistributionLoading] = useState(true);

  // Customer acquisition trends state
  const [customerTrends, setCustomerTrends] = useState(null);
  const [customerTrendsLoading, setCustomerTrendsLoading] = useState(true);

  // Inventory Health Analytics state (Live operational state)
  const [inventorySummary, setInventorySummary] = useState(null);
  const [inventoryHealthList, setInventoryHealthList] = useState([]);
  const [inventoryPagination, setInventoryPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [inventoryStatus, setInventoryStatus] = useState('ALL');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventorySortBy, setInventorySortBy] = useState('available');
  const [inventorySortOrder, setInventorySortOrder] = useState('asc');
  const [inventoryConcentration, setInventoryConcentration] = useState(null);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [outOfStockAlerts, setOutOfStockAlerts] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState(null);

  // Hover state for interactive SVG charts
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // 1. Fetch Executive Summary & Sales Trends
  const fetchExecutiveData = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const [sumRes, trendRes] = await Promise.all([
        adminAnalyticsApi.getSummary({ range: selectedRange }),
        adminAnalyticsApi.getSalesTrends({ range: selectedRange }),
      ]);

      if (sumRes?.success && sumRes.data) setSummaryData(sumRes.data);
      if (trendRes?.success && trendRes.data) setTrendsData(trendRes.data);
    } catch (err) {
      console.error('Failed to load executive summary:', err);
      setSummaryError(err.message || 'Unable to load executive metrics');
    } finally {
      setSummaryLoading(false);
    }
  }, [selectedRange]);

  // 2. Fetch Product Performance Analytics
  const fetchProductAnalytics = useCallback(async () => {
    setProductLoading(true);
    setProductError(null);
    try {
      const res = await adminAnalyticsApi.getProductPerformance({
        range: selectedRange,
        page: productPagination.page,
        limit: productPagination.limit,
        sortBy: productSortBy,
        sortOrder: productSortOrder,
        search: productSearch.trim() || undefined,
      });

      if (res?.success && res.data) {
        setProductAnalytics(res.data.products || []);
        if (res.data.pagination) {
          setProductPagination(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load product analytics:', err);
      setProductError(err.message || 'Unable to load product performance data');
    } finally {
      setProductLoading(false);
    }
  }, [selectedRange, productPagination.page, productPagination.limit, productSortBy, productSortOrder, productSearch]);

  // 3. Fetch Category Performance Analytics
  const fetchCategoryAnalytics = useCallback(async () => {
    setCategoryLoading(true);
    setCategoryError(null);
    try {
      const res = await adminAnalyticsApi.getCategoryPerformance({
        range: selectedRange,
        limit: 20,
        sortBy: 'revenue',
        sortOrder: 'desc',
      });

      if (res?.success && res.data) {
        setCategoryAnalytics(res.data.categories || []);
      }
    } catch (err) {
      console.error('Failed to load category analytics:', err);
      setCategoryError(err.message || 'Unable to load category performance data');
    } finally {
      setCategoryLoading(false);
    }
  }, [selectedRange]);

  // 4. Fetch Customer Cohorts & Performance
  const fetchCustomerAnalytics = useCallback(async () => {
    setCustomerLoading(true);
    setCustomerError(null);
    try {
      const res = await adminAnalyticsApi.getCustomerPerformance({
        range: selectedRange,
        page: customerPagination.page,
        limit: customerPagination.limit,
        sortBy: customerSortBy,
        sortOrder: customerSortOrder,
        search: customerSearch.trim() || undefined,
        segment: customerSegment || undefined,
      });

      if (res?.success && res.data) {
        setCustomerAnalytics(res.data.customers || []);
        setCustomerSummary(res.data.summary || null);
        if (res.data.pagination) {
          setCustomerPagination(res.data.pagination);
        }
      }
    } catch (err) {
      console.error('Failed to load customer analytics:', err);
      setCustomerError(err.message || 'Unable to load customer cohort data');
    } finally {
      setCustomerLoading(false);
    }
  }, [selectedRange, customerPagination.page, customerPagination.limit, customerSortBy, customerSortOrder, customerSearch, customerSegment]);

  // 5. Fetch Order Value Distribution & Customer Trends
  const fetchDistributionAndTrends = useCallback(async () => {
    setDistributionLoading(true);
    setCustomerTrendsLoading(true);
    try {
      const [distRes, custTrendRes] = await Promise.all([
        adminAnalyticsApi.getOrderDistribution({ range: selectedRange }),
        adminAnalyticsApi.getCustomerTrends({ range: selectedRange }),
      ]);

      if (distRes?.success && distRes.data) setOrderDistribution(distRes.data);
      if (custTrendRes?.success && custTrendRes.data) setCustomerTrends(custTrendRes.data);
    } catch (err) {
      console.error('Failed to load distribution/trends:', err);
    } finally {
      setDistributionLoading(false);
      setCustomerTrendsLoading(false);
    }
  }, [selectedRange]);

  // 6. Fetch Inventory Health Analytics (Live state)
  const fetchInventoryData = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError(null);
    try {
      const [sumRes, healthRes, lowRes, outRes, concRes] = await Promise.all([
        adminAnalyticsApi.getInventorySummary(),
        adminAnalyticsApi.getInventoryHealth({
          page: inventoryPagination.page,
          limit: inventoryPagination.limit,
          status: inventoryStatus,
          search: inventorySearch.trim() || undefined,
          sortBy: inventorySortBy,
          sortOrder: inventorySortOrder,
        }),
        adminAnalyticsApi.getLowStock({ limit: 5 }),
        adminAnalyticsApi.getOutOfStock({ limit: 5 }),
        adminAnalyticsApi.getInventoryConcentration(),
      ]);

      if (sumRes?.success && sumRes.data) setInventorySummary(sumRes.data);
      if (healthRes?.success && healthRes.data) {
        setInventoryHealthList(healthRes.data.variants || []);
        if (healthRes.data.pagination) setInventoryPagination(healthRes.data.pagination);
      }
      if (lowRes?.success && lowRes.data) setLowStockAlerts(lowRes.data.variants || []);
      if (outRes?.success && outRes.data) setOutOfStockAlerts(outRes.data.variants || []);
      if (concRes?.success && concRes.data) setInventoryConcentration(concRes.data);
    } catch (err) {
      console.error('Failed to load inventory analytics:', err);
      setInventoryError(err.message || 'Unable to load inventory analytics');
    } finally {
      setInventoryLoading(false);
    }
  }, [inventoryPagination.page, inventoryPagination.limit, inventoryStatus, inventorySearch, inventorySortBy, inventorySortOrder]);

  useEffect(() => {
    fetchExecutiveData();
    fetchProductAnalytics();
    fetchCategoryAnalytics();
    fetchCustomerAnalytics();
    fetchDistributionAndTrends();
  }, [fetchExecutiveData, fetchProductAnalytics, fetchCategoryAnalytics, fetchCustomerAnalytics, fetchDistributionAndTrends]);

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);

  const handleProductSort = (field) => {
    if (productSortBy === field) {
      setProductSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setProductSortBy(field);
      setProductSortOrder('desc');
    }
    setProductPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleCustomerSort = (field) => {
    if (customerSortBy === field) {
      setCustomerSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setCustomerSortBy(field);
      setCustomerSortOrder('desc');
    }
    setCustomerPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleInventorySort = (field) => {
    if (inventorySortBy === field) {
      setInventorySortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setInventorySortBy(field);
      setInventorySortOrder('asc');
    }
    setInventoryPagination((prev) => ({ ...prev, page: 1 }));
  };

  const metrics = summaryData?.metrics || {
    totalOrders: 0,
    totalRevenuePaise: 0,
    grossRevenuePaise: 0,
    refundAmountPaise: 0,
    netSalesPaise: 0,
    averageOrderValuePaise: 0,
    activeCustomerCount: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    shippedOrders: 0,
    processingOrders: 0,
    placedOrders: 0,
    returnedOrders: 0,
  };

  const series = trendsData?.series || [];
  const granularity = trendsData?.granularity || 'day';

  const custSummary = customerSummary || {
    totalCustomers: 0,
    newCustomers: 0,
    repeatCustomers: 0,
    highValueCustomers: 0,
    repeatCustomerRatePercent: 0,
    averageCustomerValuePaise: 0,
    averageOrdersPerCustomer: 0,
  };

  const invSummary = inventorySummary || {
    totalProducts: 0,
    activeProducts: 0,
    totalVariants: 0,
    activeVariants: 0,
    totalStockUnits: 0,
    reservedUnits: 0,
    availableUnits: 0,
    outOfStockVariants: 0,
    lowStockVariants: 0,
    healthyVariants: 0,
    inventoryValuePaise: 0,
  };

  const topFiveProducts = [...productAnalytics]
    .sort((a, b) => b.grossRevenuePaise - a.grossRevenuePaise)
    .slice(0, 5);

  const orderBuckets = orderDistribution?.buckets || [];
  const customerTrendSeries = customerTrends?.series || [];
  const concentrationCategories = inventoryConcentration?.categories || [];

  return (
    <AdminLayout>
      <div className="space-y-12 max-w-7xl">
        {/* Top Header & Range Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E7DED5] pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-6 h-6 text-[#9A6A45]" />
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#171513]">
                Executive Business & Operational Analytics
              </h1>
            </div>
            <p className="text-xs text-[#705E51] mt-1">
              Server-authoritative revenue, fulfillment pipeline, product rankings, customer cohorts & live inventory health.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div
              role="group"
              aria-label="Analytics date range filter"
              className="inline-flex p-1 bg-white border border-[#E7DED5] rounded-xl shadow-2xs"
            >
              {DATE_RANGES.map((r) => {
                const isSelected = selectedRange === r.value;
                return (
                  <button
                    key={r.value}
                    onClick={() => {
                      setSelectedRange(r.value);
                      setProductPagination((prev) => ({ ...prev, page: 1 }));
                      setCustomerPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-[#171513] text-white shadow-xs'
                        : 'text-[#705E51] hover:text-[#171513] hover:bg-[#F7F3EE]'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                fetchExecutiveData();
                fetchProductAnalytics();
                fetchCategoryAnalytics();
                fetchCustomerAnalytics();
                fetchDistributionAndTrends();
                fetchInventoryData();
              }}
              className="p-2 border border-[#E7DED5] rounded-xl bg-white hover:bg-[#F7F3EE] text-[#705E51] transition-colors shadow-2xs"
              title="Refresh Analytics"
              aria-label="Refresh analytics data"
            >
              <RefreshCw className={`w-4 h-4 ${summaryLoading ? 'animate-spin text-[#9A6A45]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Global Summary Error */}
        {summaryError && (
          <div className="p-4 bg-white rounded-xl border border-rose-200 shadow-xs flex items-center justify-between gap-4 text-rose-900">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <p className="text-xs">{summaryError}</p>
            </div>
            <button
              onClick={fetchExecutiveData}
              className="px-3 py-1.5 bg-[#171513] text-white rounded text-xs font-semibold hover:bg-[#2A211B]"
            >
              Retry
            </button>
          </div>
        )}

        {/* SECTION 1: Executive KPI Cards */}
        <section aria-label="Executive Performance Indicators">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-[#E7DED5] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-[#705E51]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Gross Revenue</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              {summaryLoading ? (
                <div className="h-7 bg-gray-100 animate-pulse rounded w-24 my-1" />
              ) : (
                <p className="font-serif font-bold text-xl text-[#171513]">
                  {formatPaiseToINR(metrics.grossRevenuePaise)}
                </p>
              )}
              <p className="text-[10px] text-[#705E51]">Excludes cancelled orders</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-linear-to-br from-white to-amber-50/40 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-[#705E51]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9A6A45]">Net Sales</span>
                <div className="w-7 h-7 rounded-lg bg-[#9A6A45]/10 text-[#9A6A45] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              {summaryLoading ? (
                <div className="h-7 bg-gray-100 animate-pulse rounded w-24 my-1" />
              ) : (
                <p className="font-serif font-bold text-xl text-[#9A6A45]">
                  {formatPaiseToINR(metrics.netSalesPaise)}
                </p>
              )}
              <p className="text-[10px] text-[#705E51]">After refunds & adjustments</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E7DED5] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-[#705E51]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Orders</span>
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
              </div>
              {summaryLoading ? (
                <div className="h-7 bg-gray-100 animate-pulse rounded w-16 my-1" />
              ) : (
                <p className="font-serif font-bold text-xl text-[#171513]">
                  {metrics.totalOrders}
                </p>
              )}
              <p className="text-[10px] text-[#705E51]">{metrics.deliveredOrders} Delivered</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E7DED5] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-[#705E51]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Average Order</span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              {summaryLoading ? (
                <div className="h-7 bg-gray-100 animate-pulse rounded w-20 my-1" />
              ) : (
                <p className="font-serif font-bold text-xl text-[#171513]">
                  {formatPaiseToINR(metrics.averageOrderValuePaise)}
                </p>
              )}
              <p className="text-[10px] text-[#705E51]">AOV per valid order</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E7DED5] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-[#705E51]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Active Customers</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              {summaryLoading ? (
                <div className="h-7 bg-gray-100 animate-pulse rounded w-16 my-1" />
              ) : (
                <p className="font-serif font-bold text-xl text-[#171513]">
                  {metrics.activeCustomerCount}
                </p>
              )}
              <p className="text-[10px] text-[#705E51]">Unique buyers in period</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E7DED5] shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-[#705E51]">
                <span className="text-[11px] font-bold uppercase tracking-wider">Refunds</span>
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
              </div>
              {summaryLoading ? (
                <div className="h-7 bg-gray-100 animate-pulse rounded w-20 my-1" />
              ) : (
                <p className="font-serif font-bold text-xl text-rose-800">
                  {formatPaiseToINR(metrics.refundAmountPaise)}
                </p>
              )}
              <p className="text-[10px] text-[#705E51]">{metrics.returnedOrders} returns refunded</p>
            </div>
          </div>
        </section>

        {/* SECTION 2: LIVE INVENTORY HEALTH & OPERATIONAL OVERVIEW */}
        <section aria-label="Inventory Health & Warehouse Surveillance" className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#F7F3EE] pb-2">
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#9A6A45]" />
              <h2 className="font-serif font-bold text-lg text-[#171513]">
                Inventory Health & Warehouse Surveillance
              </h2>
            </div>
            <span className="text-xs text-[#705E51]">Live Catalog Snapshot</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-[#E7DED5] shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#705E51]">Total Stock</span>
              <p className="font-serif font-bold text-lg text-[#171513]">{invSummary.totalStockUnits} u</p>
              <p className="text-[10px] text-[#705E51]">{invSummary.activeVariants} active variants</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#E7DED5] shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Available</span>
              <p className="font-serif font-bold text-lg text-emerald-700">{invSummary.availableUnits} u</p>
              <p className="text-[10px] text-[#705E51]">Ready for sale</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#E7DED5] shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Reserved</span>
              <p className="font-serif font-bold text-lg text-amber-700">{invSummary.reservedUnits} u</p>
              <p className="text-[10px] text-[#705E51]">In unfulfilled orders</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-2xs space-y-1">
              <div className="flex items-center gap-1 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Healthy</span>
              </div>
              <p className="font-serif font-bold text-lg text-emerald-800">{invSummary.healthyVariants}</p>
              <p className="text-[10px] text-emerald-700">&gt; Low stock threshold</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/30 shadow-2xs space-y-1">
              <div className="flex items-center gap-1 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>Low Stock</span>
              </div>
              <p className="font-serif font-bold text-lg text-amber-800">{invSummary.lowStockVariants}</p>
              <p className="text-[10px] text-amber-700">$\le$ threshold (High risk)</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/30 shadow-2xs space-y-1">
              <div className="flex items-center gap-1 text-rose-800 text-[10px] font-bold uppercase tracking-wider">
                <ShieldAlert className="w-3 h-3 text-rose-600" />
                <span>Out of Stock</span>
              </div>
              <p className="font-serif font-bold text-lg text-rose-800">{invSummary.outOfStockVariants}</p>
              <p className="text-[10px] text-rose-700">0 units available</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#9A6A45]/30 bg-[#9A6A45]/5 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#9A6A45]">Inventory Value</span>
              <p className="font-serif font-bold text-lg text-[#9A6A45]">{formatPaiseToINR(invSummary.inventoryValuePaise)}</p>
              <p className="text-[10px] text-[#705E51]">At current selling price</p>
            </div>
          </div>
        </section>

        {/* SECTION 3: OPERATIONAL PANELS (Low Stock & Out of Stock Alerts) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Low Stock Panel */}
          <section aria-label="Low Stock Operational Alerts" className="bg-white p-5 rounded-xl border border-[#E7DED5] shadow-2xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#F7F3EE] pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <h3 className="font-serif font-bold text-sm text-[#171513]">Critical Low-Stock Alerts</h3>
                </div>
                <Link to="/admin/products" className="text-xs text-[#9A6A45] font-semibold hover:underline flex items-center gap-1">
                  <span>Manage</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {lowStockAlerts.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#705E51]">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1 opacity-70" />
                  <p className="font-medium text-[#171513]">All active variants are adequately stocked.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E7DED5] text-xs mt-2">
                  {lowStockAlerts.map((item, idx) => (
                    <div key={item.variantId || idx} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#171513]">{item.productName}</p>
                        <p className="text-[11px] text-[#705E51] font-mono">{item.sku} {item.color ? `• ${item.color}` : ''} {item.size ? `• ${item.size}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                          {item.available} units left (Threshold: {item.lowStockThreshold})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Out of Stock Panel */}
          <section aria-label="Out of Stock Items" className="bg-white p-5 rounded-xl border border-[#E7DED5] shadow-2xs space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-[#F7F3EE] pb-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <h3 className="font-serif font-bold text-sm text-[#171513]">Out of Stock Variants</h3>
                </div>
                <Link to="/admin/products" className="text-xs text-[#9A6A45] font-semibold hover:underline flex items-center gap-1">
                  <span>Manage</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {outOfStockAlerts.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#705E51]">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1 opacity-70" />
                  <p className="font-medium text-[#171513]">Zero catalog items are completely out of stock.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#E7DED5] text-xs mt-2">
                  {outOfStockAlerts.map((item, idx) => (
                    <div key={item.variantId || idx} className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#171513]">{item.productName}</p>
                        <p className="text-[11px] text-[#705E51] font-mono">{item.sku} {item.color ? `• ${item.color}` : ''} {item.size ? `• ${item.size}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                          0 units (Threshold: {item.lowStockThreshold})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* SECTION 4: Category Inventory Concentration Visualization */}
        {concentrationCategories.length > 0 && (
          <section aria-label="Inventory Allocation by Category" className="bg-white p-5 rounded-xl border border-[#E7DED5] shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F7F3EE] pb-3">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-[#9A6A45]" />
                <h2 className="font-serif font-bold text-base text-[#171513]">
                  Inventory Concentration & Stock Allocation by Category
                </h2>
              </div>
              <span className="text-xs text-[#705E51]">Live Stock Distribution</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {concentrationCategories.map((cat, idx) => (
                <div key={cat.categoryId || idx} className="p-3.5 bg-[#FDFBF7] rounded-xl border border-[#E7DED5] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#171513] truncate">{cat.categoryName}</span>
                    <span className="font-mono font-bold text-[#9A6A45]">{cat.inventorySharePercent}%</span>
                  </div>
                  <div className="h-2 w-full bg-[#E7DED5] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#9A6A45] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, cat.inventorySharePercent)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#705E51] pt-1">
                    <span>{cat.availableUnits} available ({cat.stockUnits} total)</span>
                    <span className="font-medium text-[#171513]">{formatCompactPaise(cat.inventoryValuePaise)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 5: Variant-Level Inventory Health Table */}
        <section aria-label="Variant Inventory Directory" className="bg-white p-5 rounded-xl border border-[#E7DED5] shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F7F3EE] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-[#9A6A45]" />
                <h2 className="font-serif font-bold text-base text-[#171513]">
                  Variant-Level Inventory Surveillance
                </h2>
              </div>
              <p className="text-xs text-[#705E51] mt-0.5">
                Real-time stock units, unfulfilled reservations, stock health & operational risk levels.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Filter */}
              <select
                value={inventoryStatus}
                onChange={(e) => {
                  setInventoryStatus(e.target.value);
                  setInventoryPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="pl-2.5 pr-8 py-1.5 border border-[#E7DED5] rounded-lg text-xs bg-white text-[#171513] focus:outline-hidden focus:border-[#9A6A45]"
              >
                <option value="ALL">All Health States</option>
                <option value="HEALTHY">Healthy Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>

              {/* Search Form */}
              <form onSubmit={(e) => { e.preventDefault(); setInventoryPagination((p) => ({ ...p, page: 1 })); fetchInventoryData(); }} className="flex gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#705E51]" />
                  <input
                    type="text"
                    placeholder="Search SKU, product..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="pl-8 pr-2.5 py-1.5 border border-[#E7DED5] rounded-lg text-xs bg-white focus:outline-hidden focus:border-[#9A6A45] w-48"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#171513] text-white rounded-lg text-xs font-semibold hover:bg-[#2A211B]"
                >
                  Search
                </button>
              </form>
            </div>
          </div>

          {inventoryError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center justify-between">
              <span>{inventoryError}</span>
              <button onClick={fetchInventoryData} className="underline font-bold">Retry</button>
            </div>
          )}

          {inventoryLoading ? (
            <div className="py-12 text-center text-[#705E51]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#9A6A45] mb-2" />
              <p className="text-xs">Aggregating live inventory stock records...</p>
            </div>
          ) : inventoryHealthList.length === 0 ? (
            <div className="py-12 text-center text-[#705E51]">
              <Boxes className="w-8 h-8 text-[#9A6A45] opacity-40 mx-auto mb-2" />
              <p className="font-serif font-bold text-sm text-[#171513]">No Inventory Records Found</p>
              <p className="text-xs mt-0.5">No variants matched the selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F7F3EE] border-b border-[#E7DED5] text-[#705E51] uppercase font-bold text-[10px] tracking-wider">
                    <th className="p-3">Product & SKU</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Variant Attributes</th>
                    <th
                      className="p-3 cursor-pointer hover:text-[#171513]"
                      onClick={() => handleInventorySort('stock')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Total Stock</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      className="p-3 cursor-pointer hover:text-[#171513]"
                      onClick={() => handleInventorySort('reserved')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Reserved</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th
                      className="p-3 cursor-pointer hover:text-[#171513]"
                      onClick={() => handleInventorySort('available')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Available</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-3">Threshold</th>
                    <th
                      className="p-3 cursor-pointer hover:text-[#171513]"
                      onClick={() => handleInventorySort('inventory_value')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Valuation</span>
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="p-3">Health Status</th>
                    <th className="p-3 text-right">Risk Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7DED5]">
                  {inventoryHealthList.map((item, idx) => {
                    let healthClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    let healthText = 'HEALTHY';
                    if (item.health === 'OUT_OF_STOCK') {
                      healthClass = 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
                      healthText = 'OUT OF STOCK';
                    } else if (item.health === 'LOW_STOCK') {
                      healthClass = 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
                      healthText = 'LOW STOCK';
                    }

                    let riskClass = 'text-emerald-700 bg-emerald-50';
                    if (item.risk === 'CRITICAL') riskClass = 'text-rose-800 bg-rose-50 font-bold border border-rose-200';
                    else if (item.risk === 'HIGH') riskClass = 'text-amber-800 bg-amber-50 font-bold border border-amber-200';
                    else if (item.risk === 'MEDIUM') riskClass = 'text-blue-800 bg-blue-50 border border-blue-200';

                    return (
                      <tr key={item.variantId || idx} className="hover:bg-[#FDFBF7] transition-colors">
                        <td className="p-3">
                          <p className="font-semibold text-[#171513]">{item.productName}</p>
                          <p className="text-[11px] text-[#705E51] font-mono">{item.sku}</p>
                        </td>
                        <td className="p-3 text-[#705E51]">{item.category}</td>
                        <td className="p-3 text-[#705E51]">
                          {item.color || item.size ? (
                            <span>{item.color} {item.color && item.size ? '/' : ''} {item.size}</span>
                          ) : (
                            <span className="text-gray-400">Standard</span>
                          )}
                        </td>
                        <td className="p-3 font-medium text-[#171513]">{item.stock}</td>
                        <td className="p-3 text-amber-700">{item.reserved}</td>
                        <td className="p-3 font-bold text-[#171513]">{item.available}</td>
                        <td className="p-3 text-[#705E51]">{item.lowStockThreshold}</td>
                        <td className="p-3 font-medium text-[#9A6A45]">{formatPaiseToINR(item.inventoryValuePaise)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded border text-[10px] uppercase tracking-wider ${healthClass}`}>
                            {healthText}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${riskClass}`}>
                            {item.risk}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {inventoryPagination.totalPages > 1 && (
                <div className="p-3 bg-[#F7F3EE] border-t border-[#E7DED5] flex items-center justify-between text-xs text-[#705E51]">
                  <span>
                    Page {inventoryPagination.page} of {inventoryPagination.totalPages} ({inventoryPagination.total} variants)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInventoryPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={inventoryPagination.page <= 1}
                      className="px-3 py-1 bg-white border border-[#E7DED5] rounded disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setInventoryPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={inventoryPagination.page >= inventoryPagination.totalPages}
                      className="px-3 py-1 bg-white border border-[#E7DED5] rounded disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* SECTION 6: Customer Cohort Overview KPIs */}
        <section aria-label="Customer Cohort Metrics" className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#F7F3EE] pb-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#9A6A45]" />
              <h2 className="font-serif font-bold text-lg text-[#171513]">
                Customer Cohort & Acquisition Health
              </h2>
            </div>
            <span className="text-xs text-[#705E51]">Segment Distribution</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="bg-[#FDFBF7] p-4 rounded-xl border border-[#E7DED5] shadow-2xs space-y-1">
              <span className="text-[11px] text-[#705E51] font-semibold">Total Buyers</span>
              <p className="font-serif font-bold text-xl text-[#171513]">{custSummary.totalCustomers}</p>
              <p className="text-[10px] text-[#705E51]">In selected timeframe</p>
            </div>

            <div className="bg-[#FDFBF7] p-4 rounded-xl border border-[#E7DED5] shadow-2xs space-y-1">
              <div className="flex items-center gap-1 text-emerald-700 text-[11px] font-semibold">
                <UserPlus className="w-3.5 h-3.5" />
                <span>New Customers</span>
              </div>
              <p className="font-serif font-bold text-xl text-[#171513]">{custSummary.newCustomers}</p>
              <p className="text-[10px] text-[#705E51]">First lifetime purchase</p>
            </div>

            <div className="bg-[#FDFBF7] p-4 rounded-xl border border-[#E7DED5] shadow-2xs space-y-1">
              <div className="flex items-center gap-1 text-blue-700 text-[11px] font-semibold">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Repeat Customers</span>
              </div>
              <p className="font-serif font-bold text-xl text-[#171513]">{custSummary.repeatCustomers}</p>
              <p className="text-[10px] text-[#705E51]">$\ge$2 orders placed</p>
            </div>

            <div className="bg-[#FDFBF7] p-4 rounded-xl border border-[#E7DED5] shadow-2xs space-y-1">
              <div className="flex items-center gap-1 text-purple-700 text-[11px] font-semibold">
                <Percent className="w-3.5 h-3.5" />
                <span>Repeat Rate</span>
              </div>
              <p className="font-serif font-bold text-xl text-purple-900">{custSummary.repeatCustomerRatePercent}%</p>
              <p className="text-[10px] text-[#705E51]">Retention percentage</p>
            </div>

            <div className="bg-[#FDFBF7] p-4 rounded-xl border border-[#E7DED5] shadow-2xs space-y-1">
              <div className="flex items-center gap-1 text-amber-700 text-[11px] font-semibold">
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span>High Value VIPs</span>
              </div>
              <p className="font-serif font-bold text-xl text-amber-900">{custSummary.highValueCustomers}</p>
              <p className="text-[10px] text-[#705E51]">$\ge$₹50,000 spend</p>
            </div>

            <div className="bg-[#FDFBF7] p-4 rounded-xl border border-[#E7DED5] shadow-2xs space-y-1">
              <span className="text-[11px] text-[#705E51] font-semibold">Avg Customer Value</span>
              <p className="font-serif font-bold text-xl text-[#171513]">{formatPaiseToINR(custSummary.averageCustomerValuePaise)}</p>
              <p className="text-[10px] text-[#705E51]">Avg {custSummary.averageOrdersPerCustomer} orders/buyer</p>
            </div>
          </div>
        </section>

        {/* SECTION 7: Visual Analytics (Trajectory & Customer Trends) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section
            aria-label="Sales and Revenue Trend Visualization"
            className="lg:col-span-2 bg-white p-5 rounded-xl border border-[#E7DED5] shadow-2xs space-y-4 flex flex-col justify-between"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F7F3EE] pb-3">
              <div>
                <h2 className="font-serif font-bold text-base text-[#171513]">
                  Revenue & Net Sales Trajectory
                </h2>
                <p className="text-[11px] text-[#705E51]">
                  Time-series progression ({granularity === 'day' ? 'Daily' : 'Monthly'} granularity)
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs text-[#705E51]">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#171513]" />
                  <span>Gross</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#9A6A45]" />
                  <span>Net Sales</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Refunds</span>
                </span>
              </div>
            </div>

            {summaryLoading ? (
              <div className="h-64 flex items-center justify-center bg-[#FDFBF7] rounded-lg">
                <RefreshCw className="w-6 h-6 animate-spin text-[#9A6A45]" />
              </div>
            ) : series.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#FDFBF7] rounded-lg border border-dashed border-[#E7DED5]">
                <BarChart3 className="w-8 h-8 text-[#9A6A45] opacity-40 mb-2" />
                <p className="font-serif font-bold text-sm text-[#171513]">No Sales Data in Selected Period</p>
                <p className="text-xs text-[#705E51] mt-1">Transactions will plot here automatically.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="h-64 w-full">
                  <SalesTrendSVG
                    series={series}
                    hoveredPoint={hoveredPoint}
                    setHoveredPoint={setHoveredPoint}
                  />
                </div>

                {hoveredPoint && (
                  <div className="mt-3 p-3 bg-[#FDFBF7] border border-[#E7DED5] rounded-lg flex items-center justify-between text-xs flex-wrap gap-2">
                    <span className="font-mono font-bold text-[#171513]">
                      📅 {hoveredPoint.date}
                    </span>
                    <span className="text-[#705E51]">
                      Orders: <strong className="text-[#171513]">{hoveredPoint.orders}</strong>
                    </span>
                    <span className="text-[#705E51]">
                      Gross: <strong className="text-[#171513]">{formatPaiseToINR(hoveredPoint.revenuePaise)}</strong>
                    </span>
                    <span className="text-rose-700">
                      Refunds: <strong>{formatPaiseToINR(hoveredPoint.refundPaise)}</strong>
                    </span>
                    <span className="text-[#9A6A45] font-bold">
                      Net: {formatPaiseToINR(hoveredPoint.netSalesPaise)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          <section
            aria-label="Customer Acquisition and Retention Trends"
            className="bg-white p-5 rounded-xl border border-[#E7DED5] shadow-2xs space-y-4 flex flex-col justify-between"
          >
            <div className="border-b border-[#F7F3EE] pb-3">
              <div className="flex items-center justify-between">
                <h2 className="font-serif font-bold text-base text-[#171513]">
                  New vs Returning Buyers
                </h2>
                <div className="flex items-center gap-2 text-[10px] text-[#705E51]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    <span>New</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <span>Returning</span>
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#705E51]">
                Acquisition vs retention trajectory
              </p>
            </div>

            {customerTrendsLoading ? (
              <div className="h-64 flex items-center justify-center bg-[#FDFBF7] rounded-lg">
                <RefreshCw className="w-6 h-6 animate-spin text-[#9A6A45]" />
              </div>
            ) : customerTrendSeries.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-[#FDFBF7] rounded-lg border border-dashed border-[#E7DED5]">
                <Users className="w-8 h-8 text-[#9A6A45] opacity-40 mb-2" />
                <p className="font-serif font-bold text-sm text-[#171513]">No Active Customers</p>
                <p className="text-xs text-[#705E51]">No buyers in this period</p>
              </div>
            ) : (
              <div className="h-64 w-full">
                <CustomerAcquisitionSVG series={customerTrendSeries} />
              </div>
            )}
          </section>
        </div>

        {/* SECTION 8: Order Value Distribution */}
        <section aria-label="Order Value Distribution Brackets" className="bg-white p-5 rounded-xl border border-[#E7DED5] shadow-2xs space-y-4">
          <div className="border-b border-[#F7F3EE] pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#9A6A45]" />
              <h2 className="font-serif font-bold text-base text-[#171513]">
                Order Value Distribution (Price Brackets)
              </h2>
            </div>
            <p className="text-xs text-[#705E51] mt-0.5">
              Breakdown of transaction frequencies and revenue concentration across monetary brackets.
            </p>
          </div>

          {distributionLoading ? (
            <div className="py-8 text-center text-[#705E51]">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#9A6A45] mb-2" />
              <p className="text-xs">Aggregating order buckets...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              {orderBuckets.map((bucket, idx) => (
                <div key={idx} className="p-3 bg-[#FDFBF7] rounded-lg border border-[#E7DED5] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#171513]">{bucket.label}</span>
                    <span className="font-mono text-[11px] font-bold text-[#9A6A45]">{bucket.orderSharePercent}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#E7DED5] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#171513] rounded-full"
                      style={{ width: `${Math.min(100, bucket.orderSharePercent)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#705E51]">
                    <span>{bucket.orderCount} orders</span>
                    <span className="font-medium text-[#171513]">{formatCompactPaise(bucket.grossRevenuePaise)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 9: Direct Management Hubs */}
        <section aria-label="Operational Quick Navigation" className="bg-white p-5 rounded-xl border border-[#E7DED5] shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#F7F3EE] pb-2">
            <h3 className="font-serif font-bold text-sm text-[#171513]">Direct Management Hubs</h3>
            <span className="text-xs text-[#705E51]">Quick Links</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
            <Link
              to="/admin/orders"
              className="p-2.5 rounded-lg border border-[#E7DED5] bg-[#FDFBF7] hover:border-[#9A6A45] transition-colors flex items-center justify-between group"
            >
              <span className="font-medium text-[#171513]">Orders</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#705E51] group-hover:text-[#9A6A45] group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to="/admin/returns"
              className="p-2.5 rounded-lg border border-[#E7DED5] bg-[#FDFBF7] hover:border-[#9A6A45] transition-colors flex items-center justify-between group"
            >
              <span className="font-medium text-[#171513]">Returns</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#705E51] group-hover:text-[#9A6A45] group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to="/admin/support"
              className="p-2.5 rounded-lg border border-[#E7DED5] bg-[#FDFBF7] hover:border-[#9A6A45] transition-colors flex items-center justify-between group"
            >
              <span className="font-medium text-[#171513]">Support</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#705E51] group-hover:text-[#9A6A45] group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to="/admin/products"
              className="p-2.5 rounded-lg border border-[#E7DED5] bg-[#FDFBF7] hover:border-[#9A6A45] transition-colors flex items-center justify-between group"
            >
              <span className="font-medium text-[#171513]">Products</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#705E51] group-hover:text-[#9A6A45] group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to="/admin/coupons"
              className="p-2.5 rounded-lg border border-[#E7DED5] bg-[#FDFBF7] hover:border-[#9A6A45] transition-colors flex items-center justify-between group"
            >
              <span className="font-medium text-[#171513]">Coupons</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#705E51] group-hover:text-[#9A6A45] group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to="/admin/reviews"
              className="p-2.5 rounded-lg border border-[#E7DED5] bg-[#FDFBF7] hover:border-[#9A6A45] transition-colors flex items-center justify-between group"
            >
              <span className="font-medium text-[#171513]">Reviews</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#705E51] group-hover:text-[#9A6A45] group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}

/**
 * Responsive Multi-Metric SVG Line/Area Chart for Revenue, Net Sales & Refunds
 */
function SalesTrendSVG({ series, hoveredPoint, setHoveredPoint }) {
  if (!series || series.length === 0) return null;

  const width = 600;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };

  const maxVal = Math.max(
    ...series.map((s) => Math.max(s.revenuePaise || 0, s.netSalesPaise || 0, s.refundPaise || 0)),
    100000
  );

  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;

  const pointsCount = series.length;
  const getX = (index) =>
    padding.left + (pointsCount > 1 ? (index / (pointsCount - 1)) * usableWidth : usableWidth / 2);
  const getY = (val) =>
    padding.top + usableHeight - (Math.max(0, val) / maxVal) * usableHeight;

  const grossPoints = series.map((s, i) => `${getX(i)},${getY(s.revenuePaise || 0)}`);
  const netPoints = series.map((s, i) => `${getX(i)},${getY(s.netSalesPaise || 0)}`);
  const refundPoints = series.map((s, i) => `${getX(i)},${getY(s.refundPaise || 0)}`);

  const grossPath = `M ${grossPoints.join(' L ')}`;
  const netPath = `M ${netPoints.join(' L ')}`;
  const refundPath = `M ${refundPoints.join(' L ')}`;

  const netAreaPath =
    pointsCount > 1
      ? `M ${grossPoints[0].split(',')[0]},${height - padding.bottom} L ${netPoints.join(' L ')} L ${
          grossPoints[grossPoints.length - 1].split(',')[0]
        },${height - padding.bottom} Z`
      : '';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full overflow-visible select-none"
      aria-label="Revenue and sales trend graph"
    >
      {[0, 0.5, 1].map((fraction, i) => {
        const y = padding.top + usableHeight * fraction;
        const val = maxVal * (1 - fraction);
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#E7DED5"
              strokeDasharray="3 3"
              strokeWidth="1"
            />
            <text
              x={padding.left - 8}
              y={y + 3}
              textAnchor="end"
              className="text-[9px] fill-[#705E51] font-mono"
            >
              {formatCompactPaise(val)}
            </text>
          </g>
        );
      })}

      <defs>
        <linearGradient id="netSalesGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9A6A45" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#9A6A45" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      {netAreaPath && <path d={netAreaPath} fill="url(#netSalesGrad)" />}

      <path d={grossPath} fill="none" stroke="#171513" strokeWidth="2" strokeLinecap="round" />
      <path d={netPath} fill="none" stroke="#9A6A45" strokeWidth="2.5" strokeLinecap="round" />
      <path d={refundPath} fill="none" stroke="#F43F5E" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />

      {series.map((item, index) => {
        const x = getX(index);
        const yNet = getY(item.netSalesPaise || 0);
        const isHovered = hoveredPoint?.date === item.date;

        return (
          <g
            key={index}
            className="cursor-pointer group"
            onMouseEnter={() => setHoveredPoint(item)}
            onClick={() => setHoveredPoint(item)}
          >
            <circle
              cx={x}
              cy={yNet}
              r={isHovered ? 5 : 3}
              fill={isHovered ? '#171513' : '#9A6A45'}
              stroke="#FFFFFF"
              strokeWidth="1.5"
              className="transition-all"
            />
          </g>
        );
      })}

      {series.map((item, index) => {
        const step = Math.ceil(pointsCount / 6);
        if (index % step !== 0 && index !== pointsCount - 1) return null;

        const x = getX(index);
        const y = height - padding.bottom + 14;
        const displayLabel = item.date.length > 7 ? item.date.slice(5) : item.date;

        return (
          <text
            key={index}
            x={x}
            y={y}
            textAnchor="middle"
            className="text-[9px] fill-[#705E51] font-mono"
          >
            {displayLabel}
          </text>
        );
      })}
    </svg>
  );
}

/**
 * Responsive Customer Acquisition (New vs Returning) Area/Line SVG Chart
 */
function CustomerAcquisitionSVG({ series }) {
  if (!series || series.length === 0) return null;

  const width = 300;
  const height = 220;
  const padding = { top: 20, right: 15, bottom: 30, left: 35 };

  const maxCustomers = Math.max(
    ...series.map((s) => Math.max(s.newCustomers || 0, s.returningCustomers || 0, s.activeCustomers || 0)),
    4
  );

  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;

  const pointsCount = series.length;
  const getX = (index) =>
    padding.left + (pointsCount > 1 ? (index / (pointsCount - 1)) * usableWidth : usableWidth / 2);
  const getY = (val) =>
    padding.top + usableHeight - (Math.max(0, val) / maxCustomers) * usableHeight;

  const newPoints = series.map((s, i) => `${getX(i)},${getY(s.newCustomers || 0)}`);
  const retPoints = series.map((s, i) => `${getX(i)},${getY(s.returningCustomers || 0)}`);

  const newPath = `M ${newPoints.join(' L ')}`;
  const retPath = `M ${retPoints.join(' L ')}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full overflow-visible select-none"
      aria-label="Customer acquisition timeline"
    >
      {[0, 0.5, 1].map((fraction, i) => {
        const y = padding.top + usableHeight * fraction;
        const count = Math.round(maxCustomers * (1 - fraction));
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#E7DED5"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
            <text
              x={padding.left - 6}
              y={y + 3}
              textAnchor="end"
              className="text-[9px] fill-[#705E51] font-mono"
            >
              {count}
            </text>
          </g>
        );
      })}

      <path d={newPath} fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
      <path d={retPath} fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />

      {series.map((item, index) => {
        const x = getX(index);
        const yNew = getY(item.newCustomers || 0);
        const yRet = getY(item.returningCustomers || 0);

        return (
          <g key={index}>
            <circle cx={x} cy={yNew} r="3" fill="#059669" stroke="#FFFFFF" strokeWidth="1" />
            <circle cx={x} cy={yRet} r="3" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1" />
          </g>
        );
      })}

      {series.map((item, index) => {
        const step = Math.ceil(series.length / 4);
        if (index % step !== 0 && index !== series.length - 1) return null;

        const x = getX(index);
        const y = height - padding.bottom + 14;
        const displayLabel = item.date.length > 7 ? item.date.slice(5) : item.date;

        return (
          <text
            key={index}
            x={x}
            y={y}
            textAnchor="middle"
            className="text-[9px] fill-[#705E51] font-mono"
          >
            {displayLabel}
          </text>
        );
      })}
    </svg>
  );
}
