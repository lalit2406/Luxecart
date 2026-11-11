import React, { useState, useEffect, useMemo, useCallback } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import {
  adminSettingsApi,
  mapSettingsToForm,
  buildSettingsPatchPayload,
  validateSettingsForm,
  formatCurrencyRupees,
} from '../../features/admin/settings/api/adminSettingsApi';
import {
  Store,
  Truck,
  RotateCcw,
  CreditCard,
  AlertTriangle,
  Mail,
  Phone,
  MapPin,
  Save,
  RotateCcw as ResetIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Clock,
  Globe,
  Share2,
  Info,
  Lock,
  Layers,
  Sparkles,
} from 'lucide-react';

const SECTIONS = [
  { id: 'general', label: 'General & Branding', icon: Store, description: 'Store identity, logos, and SEO metadata' },
  { id: 'contact', label: 'Contact & Social', icon: Mail, description: 'Support emails, phone, store address, and socials' },
  { id: 'shipping', label: 'Shipping & Fulfillment', icon: Truck, description: 'Delivery fees, free thresholds, and estimate windows' },
  { id: 'returns', label: 'Returns & Policies', icon: RotateCcw, description: 'Return eligibility window and customer return policy' },
  { id: 'payment', label: 'Cash on Delivery', icon: CreditCard, description: 'COD maximum order limits and currency specifications' },
  { id: 'availability', label: 'Store Availability', icon: AlertTriangle, description: 'Maintenance mode and customer-facing downtime alerts' },
];

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Raw server baseline settings and editable form state
  const [serverSettings, setServerSettings] = useState(null);
  const [formData, setFormData] = useState(null);

  // Maintenance mode confirmation modal
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);

  // Fetch settings from server
  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await adminSettingsApi.getAdminSettings();
      const data = res?.data || res;
      setServerSettings(data);
      setFormData(mapSettingsToForm(data));
      setFieldErrors({});
    } catch (err) {
      setFetchError(err.message || 'Failed to load store settings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Determine dirty state by comparing current serialized form with initial baseline form
  const isDirty = useMemo(() => {
    if (!serverSettings || !formData) return false;
    const baselineForm = mapSettingsToForm(serverSettings);
    return JSON.stringify(formData) !== JSON.stringify(baselineForm);
  }, [serverSettings, formData]);

  // Warn before browser window unload if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Discard changes
  const handleDiscard = () => {
    if (!serverSettings) return;
    setFormData(mapSettingsToForm(serverSettings));
    setFieldErrors({});
    setSaveError(null);
    setSuccessMessage('Unsaved changes discarded. Form restored to current saved settings.');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Field change handlers with nested key support
  const handleSimpleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    setSaveError(null);
  };

  const handleNestedChange = (parent, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value,
      },
    }));
    const key = `${parent}.${field}`;
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    setSaveError(null);
  };

  const handleDeepNestedChange = (parent, sub, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [sub]: {
          ...prev[parent]?.[sub],
          [field]: value,
        },
      },
    }));
    const key = `${parent}.${sub}.${field}`;
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    setSaveError(null);
  };

  // Special handler for maintenance mode toggle to trigger confirmation
  const handleMaintenanceToggle = (checked) => {
    if (checked) {
      // Opening maintenance mode requires confirmation
      setIsMaintenanceModalOpen(true);
    } else {
      handleNestedChange('maintenance', 'isMaintenanceMode', false);
    }
  };

  const confirmEnableMaintenance = () => {
    handleNestedChange('maintenance', 'isMaintenanceMode', true);
    setIsMaintenanceModalOpen(false);
  };

  // Save Settings handler
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!formData) return;

    setSaveError(null);
    setSuccessMessage(null);

    // 1. Client-side validation
    const errors = validateSettingsForm(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setSaveError('Please resolve the highlighted validation errors before saving.');

      // Auto-switch to tab containing first error
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey.startsWith('shipping')) setActiveTab('shipping');
      else if (firstErrorKey.startsWith('returns')) setActiveTab('returns');
      else if (firstErrorKey.startsWith('payment')) setActiveTab('payment');
      else if (firstErrorKey.startsWith('maintenance')) setActiveTab('availability');
      else if (firstErrorKey.startsWith('address') || firstErrorKey.startsWith('socialLinks') || firstErrorKey.startsWith('support') || firstErrorKey === 'operatingHours') setActiveTab('contact');
      else setActiveTab('general');

      return;
    }

    // 2. Prepare payload
    setSaving(true);
    try {
      const payload = buildSettingsPatchPayload(formData);
      const res = await adminSettingsApi.updateSettings(payload);
      const updatedData = res?.data || res;

      // Update baseline with authoritative server response
      setServerSettings(updatedData);
      setFormData(mapSettingsToForm(updatedData));
      setFieldErrors({});
      setSuccessMessage('Store settings updated and applied successfully.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setSaveError(err.message || 'Failed to update store settings. Please verify inputs and try again.');
    } finally {
      setSaving(false);
    }
  };

  // Formatted date and author for audit metadata
  const lastUpdatedDisplay = useMemo(() => {
    if (!serverSettings?.updatedAt) return null;
    const dateStr = new Date(serverSettings.updatedAt).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const updaterName = serverSettings.lastUpdatedBy?.name || serverSettings.lastUpdatedBy?.email || 'Administrator';
    return { dateStr, updaterName };
  }, [serverSettings]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-[#7A6B5D]">
          <Loader2 className="w-10 h-10 animate-spin text-[#A85A32] mb-4" />
          <p className="text-sm font-medium">Loading store settings...</p>
        </div>
      </AdminLayout>
    );
  }

  if (fetchError) {
    return (
      <AdminLayout>
        <div className="max-w-4xl mx-auto py-12 px-4">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-rose-600 mx-auto mb-3" />
            <h3 className="text-lg font-serif text-[#171513] mb-2">Unable to Load Settings</h3>
            <p className="text-sm text-rose-700 mb-6">{fetchError}</p>
            <button
              onClick={fetchSettings}
              className="px-5 py-2.5 bg-[#2A211B] text-white rounded-lg text-sm font-medium hover:bg-[#3D3128] transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header and Top Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#E5DFD7]">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-serif text-[#171513]">Store Settings</h1>
              {isDirty && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-sm text-[#7A6B5D] mt-1">
              Configure brand identity, fulfillment rules, returns, and store availability centrally.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={!isDirty || saving}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[#E5DFD7] rounded-lg text-sm font-medium text-[#171513] bg-white hover:bg-[#F7F3EE] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ResetIcon className="w-4 h-4" />
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#2A211B] text-white rounded-lg text-sm font-medium hover:bg-[#3D3128] disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Audit Meta Banner */}
        {lastUpdatedDisplay && (
          <div className="mt-4 flex items-center justify-between flex-wrap gap-2 text-xs text-[#7A6B5D] bg-[#F3EDE6] px-4 py-2 rounded-lg border border-[#E5DFD7]">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Last modified on <strong className="text-[#171513] font-medium">{lastUpdatedDisplay.dateStr}</strong> by <strong className="text-[#171513] font-medium">{lastUpdatedDisplay.updaterName}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-[#E5DFD7]">
                Key: {serverSettings?.singletonKey || 'STORE_SETTINGS_PRIMARY'}
              </span>
            </div>
          </div>
        )}

        {/* Feedback Banners */}
        {successMessage && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 transition-all">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        )}
        {saveError && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 transition-all">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span className="text-sm font-medium">{saveError}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mt-8 border-b border-[#E5DFD7] overflow-x-auto scrollbar-none">
          <nav className="flex space-x-2 sm:space-x-4 min-w-max pb-px" aria-label="Settings Sections">
            {SECTIONS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              // Check if this section contains any errors
              const hasSectionError = Object.keys(fieldErrors).some((k) => {
                if (tab.id === 'general') return k === 'storeName' || k === 'tagline' || k.startsWith('logo') || k.startsWith('favicon') || k.startsWith('seo');
                if (tab.id === 'contact') return k.startsWith('support') || k === 'operatingHours' || k.startsWith('address') || k.startsWith('socialLinks');
                if (tab.id === 'shipping') return k.startsWith('shipping');
                if (tab.id === 'returns') return k.startsWith('returns');
                if (tab.id === 'payment') return k.startsWith('payment');
                if (tab.id === 'availability') return k.startsWith('maintenance');
                return false;
              });

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors relative ${
                    isActive
                      ? 'border-[#2A211B] text-[#171513]'
                      : 'border-transparent text-[#7A6B5D] hover:text-[#171513] hover:border-[#D0C7BD]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#2A211B]' : 'text-[#7A6B5D]'}`} />
                  <span>{tab.label}</span>
                  {hasSectionError && (
                    <span className="w-2 h-2 rounded-full bg-rose-500" title="Section contains validation errors" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Section Content Area */}
        <form onSubmit={handleSave} className="mt-6">
          {/* SECTION A: GENERAL & BRANDING */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-[#E5DFD7] p-6 shadow-xs">
                <h2 className="text-lg font-serif text-[#171513] mb-1">Store Identity & Visuals</h2>
                <p className="text-xs text-[#7A6B5D] mb-6">Manage customer-facing store names, taglines, and branded asset URLs.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Store Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.storeName}
                      onChange={(e) => handleSimpleChange('storeName', e.target.value)}
                      maxLength={100}
                      placeholder="e.g. LuxeCart"
                      className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none transition-colors ${
                        fieldErrors.storeName ? 'border-rose-400 focus:ring-1 focus:ring-rose-500' : 'border-[#E5DFD7] focus:border-[#2A211B]'
                      }`}
                    />
                    {fieldErrors.storeName ? (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.storeName}</p>
                    ) : (
                      <p className="text-xs text-[#7A6B5D] mt-1">Appears across navbar, invoices, emails, and browser titles.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Tagline / Brand Descriptor
                    </label>
                    <input
                      type="text"
                      value={formData.tagline}
                      onChange={(e) => handleSimpleChange('tagline', e.target.value)}
                      maxLength={250}
                      placeholder="Curated Luxury Fashion & Lifestyle"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                    <p className="text-xs text-[#7A6B5D] mt-1">Prominent slogan shown in hero sections and marketing banners.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Light Logo URL
                    </label>
                    <input
                      type="url"
                      value={formData.logoUrlLight}
                      onChange={(e) => handleSimpleChange('logoUrlLight', e.target.value)}
                      maxLength={500}
                      placeholder="https://your-cdn.com/logo-light.svg"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                    <p className="text-xs text-[#7A6B5D] mt-1">Rendered on dark navigation bars and promotional cards.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Dark Logo URL
                    </label>
                    <input
                      type="url"
                      value={formData.logoUrlDark}
                      onChange={(e) => handleSimpleChange('logoUrlDark', e.target.value)}
                      maxLength={500}
                      placeholder="https://your-cdn.com/logo-dark.svg"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                    <p className="text-xs text-[#7A6B5D] mt-1">Rendered on light invoice footers and packaging slips.</p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Favicon URL
                    </label>
                    <input
                      type="url"
                      value={formData.faviconUrl}
                      onChange={(e) => handleSimpleChange('faviconUrl', e.target.value)}
                      maxLength={500}
                      placeholder="https://your-cdn.com/favicon.ico"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                    <p className="text-xs text-[#7A6B5D] mt-1">Browser tab icon (supports .ico, .png, or .svg formats up to 500 characters).</p>
                  </div>
                </div>
              </div>

              {/* SEO Subcard */}
              <div className="bg-white rounded-xl border border-[#E5DFD7] p-6 shadow-xs">
                <h2 className="text-lg font-serif text-[#171513] mb-1">Search Engine Optimization (SEO)</h2>
                <p className="text-xs text-[#7A6B5D] mb-6">Default meta titles, descriptions, and discoverability keywords.</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Default Meta Title
                    </label>
                    <input
                      type="text"
                      value={formData.seo?.metaTitle || ''}
                      onChange={(e) => handleNestedChange('seo', 'metaTitle', e.target.value)}
                      maxLength={150}
                      placeholder="LuxeCart — Curated Luxury Fashion & Lifestyle"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Default Meta Description
                    </label>
                    <textarea
                      rows={3}
                      value={formData.seo?.metaDescription || ''}
                      onChange={(e) => handleNestedChange('seo', 'metaDescription', e.target.value)}
                      maxLength={300}
                      placeholder="Discover premier luxury fashion, accessories, and curated lifestyle collections on LuxeCart."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Meta Keywords (Comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formData.seo?.keywords || ''}
                      onChange={(e) => handleNestedChange('seo', 'keywords', e.target.value)}
                      placeholder="luxury fashion, designer wear, curated apparel, premium lifestyle"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                    <p className="text-xs text-[#7A6B5D] mt-1">Separate keywords with commas (up to 30 items).</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION B: CONTACT & SOCIAL */}
          {activeTab === 'contact' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-[#E5DFD7] p-6 shadow-xs">
                <h2 className="text-lg font-serif text-[#171513] mb-1">Customer Support & Inquiries</h2>
                <p className="text-xs text-[#7A6B5D] mb-6">Contact points shown to customers on support pages and invoices.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Support Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.supportEmail}
                      onChange={(e) => handleSimpleChange('supportEmail', e.target.value)}
                      maxLength={150}
                      placeholder="support@luxecart.com"
                      className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none transition-colors ${
                        fieldErrors.supportEmail ? 'border-rose-400 focus:ring-1 focus:ring-rose-500' : 'border-[#E5DFD7] focus:border-[#2A211B]'
                      }`}
                    />
                    {fieldErrors.supportEmail ? (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors.supportEmail}</p>
                    ) : (
                      <p className="text-xs text-[#7A6B5D] mt-1">Primary mailbox for return approvals and support tickets.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Support Phone Number
                    </label>
                    <input
                      type="text"
                      value={formData.supportPhone}
                      onChange={(e) => handleSimpleChange('supportPhone', e.target.value)}
                      maxLength={30}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                    <p className="text-xs text-[#7A6B5D] mt-1">Customer support helpline phone number.</p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Operating Hours
                    </label>
                    <input
                      type="text"
                      value={formData.operatingHours}
                      onChange={(e) => handleSimpleChange('operatingHours', e.target.value)}
                      maxLength={100}
                      placeholder="Mon - Sat: 10:00 AM - 7:00 PM IST"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                    <p className="text-xs text-[#7A6B5D] mt-1">Displayed on the customer support portal and contact footer.</p>
                  </div>
                </div>
              </div>

              {/* Physical Address Subcard */}
              <div className="bg-white rounded-xl border border-[#E5DFD7] p-6 shadow-xs">
                <h2 className="text-lg font-serif text-[#171513] mb-1">Corporate & Warehouse Address</h2>
                <p className="text-xs text-[#7A6B5D] mb-6">Registered business address printed on GST packing slips and customer invoices.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={formData.address?.street || ''}
                      onChange={(e) => handleNestedChange('address', 'street', e.target.value)}
                      maxLength={200}
                      placeholder="100 Feet Road, Indiranagar"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.address?.city || ''}
                      onChange={(e) => handleNestedChange('address', 'city', e.target.value)}
                      maxLength={100}
                      placeholder="Bengaluru"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={formData.address?.state || ''}
                      onChange={(e) => handleNestedChange('address', 'state', e.target.value)}
                      maxLength={100}
                      placeholder="Karnataka"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Postal Code / PIN
                    </label>
                    <input
                      type="text"
                      value={formData.address?.postalCode || ''}
                      onChange={(e) => handleNestedChange('address', 'postalCode', e.target.value)}
                      maxLength={20}
                      placeholder="560038"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={formData.address?.country || 'India'}
                      onChange={(e) => handleNestedChange('address', 'country', e.target.value)}
                      maxLength={50}
                      placeholder="India"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Social Channels Subcard */}
              <div className="bg-white rounded-xl border border-[#E5DFD7] p-6 shadow-xs">
                <h2 className="text-lg font-serif text-[#171513] mb-1">Official Social Channels</h2>
                <p className="text-xs text-[#7A6B5D] mb-6">Social media profile URLs rendered in the store footer.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Instagram Profile URL
                    </label>
                    <input
                      type="url"
                      value={formData.socialLinks?.instagram || ''}
                      onChange={(e) => handleNestedChange('socialLinks', 'instagram', e.target.value)}
                      maxLength={300}
                      placeholder="https://instagram.com/luxecart"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Facebook Page URL
                    </label>
                    <input
                      type="url"
                      value={formData.socialLinks?.facebook || ''}
                      onChange={(e) => handleNestedChange('socialLinks', 'facebook', e.target.value)}
                      maxLength={300}
                      placeholder="https://facebook.com/luxecart"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Twitter / X URL
                    </label>
                    <input
                      type="url"
                      value={formData.socialLinks?.twitter || ''}
                      onChange={(e) => handleNestedChange('socialLinks', 'twitter', e.target.value)}
                      maxLength={300}
                      placeholder="https://x.com/luxecart"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Pinterest Profile URL
                    </label>
                    <input
                      type="url"
                      value={formData.socialLinks?.pinterest || ''}
                      onChange={(e) => handleNestedChange('socialLinks', 'pinterest', e.target.value)}
                      maxLength={300}
                      placeholder="https://pinterest.com/luxecart"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION C: SHIPPING & FULFILLMENT */}
          {activeTab === 'shipping' && (
            <div className="space-y-6">
              {/* Policy Callout Banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900">
                <Info className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <strong className="font-semibold block mb-0.5">Order Price Protection Invariant:</strong>
                  Shipping fee and threshold changes apply dynamically to new checkouts and carts. Existing placed orders maintain their permanently locked shipping fee snapshots and are never retroactively recalculated.
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E5DFD7] p-6 shadow-xs">
                <h2 className="text-lg font-serif text-[#171513] mb-1">Standard Delivery Rates</h2>
                <p className="text-xs text-[#7A6B5D] mb-6">Define base delivery fees and optional free shipping promotion thresholds.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Standard Shipping Fee (₹) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-sm text-[#7A6B5D]">₹</span>
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        step="1"
                        value={formData.shipping?.standardFeeRupees ?? ''}
                        onChange={(e) => handleNestedChange('shipping', 'standardFeeRupees', e.target.value)}
                        className={`w-full pl-8 pr-3.5 py-2.5 rounded-lg border text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none transition-colors ${
                          fieldErrors['shipping.standardFeeRupees']
                            ? 'border-rose-400 focus:ring-1 focus:ring-rose-500'
                            : 'border-[#E5DFD7] focus:border-[#2A211B]'
                        }`}
                      />
                    </div>
                    {fieldErrors['shipping.standardFeeRupees'] ? (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors['shipping.standardFeeRupees']}</p>
                    ) : (
                      <p className="text-xs text-[#7A6B5D] mt-1">Default flat shipping fee. Set to 0 to provide free shipping on all orders.</p>
                    )}
                  </div>

                  <div className="flex flex-col justify-between">
                    <div>
                      <span className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                        Free Delivery Threshold Promotion
                      </span>
                      <label className="inline-flex items-center gap-3 cursor-pointer mt-1">
                        <input
                          type="checkbox"
                          checked={formData.shipping?.enableFreeShippingThreshold || false}
                          onChange={(e) => handleNestedChange('shipping', 'enableFreeShippingThreshold', e.target.checked)}
                          className="w-4 h-4 rounded text-[#2A211B] border-[#E5DFD7] focus:ring-[#2A211B]"
                        />
                        <span className="text-sm font-medium text-[#171513]">
                          Enable Free Shipping on orders meeting minimum spend
                        </span>
                      </label>
                    </div>
                  </div>

                  {formData.shipping?.enableFreeShippingThreshold && (
                    <div className="md:col-span-2 p-4 bg-[#F7F3EE] rounded-lg border border-[#E5DFD7]">
                      <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                        Qualifying Merchandise Subtotal for Free Delivery (₹) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative max-w-md">
                        <span className="absolute left-3.5 top-2.5 text-sm text-[#7A6B5D]">₹</span>
                        <input
                          type="number"
                          min="0"
                          max="500000"
                          step="100"
                          value={formData.shipping?.freeShippingThresholdRupees ?? ''}
                          onChange={(e) => handleNestedChange('shipping', 'freeShippingThresholdRupees', e.target.value)}
                          className={`w-full pl-8 pr-3.5 py-2.5 rounded-lg border text-sm text-[#171513] bg-white focus:outline-none transition-colors ${
                            fieldErrors['shipping.freeShippingThresholdRupees']
                              ? 'border-rose-400 focus:ring-1 focus:ring-rose-500'
                              : 'border-[#E5DFD7] focus:border-[#2A211B]'
                          }`}
                        />
                      </div>
                      {fieldErrors['shipping.freeShippingThresholdRupees'] ? (
                        <p className="text-xs text-rose-600 mt-1">{fieldErrors['shipping.freeShippingThresholdRupees']}</p>
                      ) : (
                        <p className="text-xs text-[#7A6B5D] mt-1.5">
                          Calculated against pre-coupon merchandise subtotal. If subtotal is greater than or equal to this amount, standard shipping fee is waived.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery Estimates Subcard */}
              <div className="bg-white rounded-xl border border-[#E5DFD7] p-6 shadow-xs">
                <h2 className="text-lg font-serif text-[#171513] mb-1">Estimated Delivery Timeline</h2>
                <p className="text-xs text-[#7A6B5D] mb-6">Displayed on product detail pages and checkout review badges.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl">
                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Minimum Delivery Days <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={formData.shipping?.deliveryEstimateDays?.min ?? 3}
                      onChange={(e) => handleDeepNestedChange('shipping', 'deliveryEstimateDays', 'min', parseInt(e.target.value, 10) || 1)}
                      className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none transition-colors ${
                        fieldErrors['shipping.deliveryEstimateDays.min']
                          ? 'border-rose-400 focus:ring-1 focus:ring-rose-500'
                          : 'border-[#E5DFD7] focus:border-[#2A211B]'
                      }`}
                    />
                    {fieldErrors['shipping.deliveryEstimateDays.min'] && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors['shipping.deliveryEstimateDays.min']}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Maximum Delivery Days <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={formData.shipping?.deliveryEstimateDays?.max ?? 7}
                      onChange={(e) => handleDeepNestedChange('shipping', 'deliveryEstimateDays', 'max', parseInt(e.target.value, 10) || 1)}
                      className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none transition-colors ${
                        fieldErrors['shipping.deliveryEstimateDays.max']
                          ? 'border-rose-400 focus:ring-1 focus:ring-rose-500'
                          : 'border-[#E5DFD7] focus:border-[#2A211B]'
                      }`}
                    />
                    {fieldErrors['shipping.deliveryEstimateDays.max'] && (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors['shipping.deliveryEstimateDays.max']}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4 p-3 bg-[#F9F7F4] rounded-lg border border-[#E5DFD7] text-xs text-[#7A6B5D] max-w-xl flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#A85A32]" />
                  <span>
                    Storefront estimate badge preview: <strong>Arrives within {formData.shipping?.deliveryEstimateDays?.min || 3} to {formData.shipping?.deliveryEstimateDays?.max || 7} business days</strong>.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SECTION D: RETURNS & POLICIES */}
          {activeTab === 'returns' && (
            <div className="space-y-6">
              {/* Dynamic Return Policy Callout Banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <strong className="font-semibold block mb-0.5">Dynamic Policy Notice:</strong>
                  LuxeCart evaluates customer return eligibility dynamically against the delivered timestamp of orders. Modifying or reducing the return window immediately impacts previously delivered customer orders that are within the transition timeframe.
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E5DFD7] p-6 shadow-xs">
                <h2 className="text-lg font-serif text-[#171513] mb-1">Customer Return Policy</h2>
                <p className="text-xs text-[#7A6B5D] mb-6">Govern whether returns are accepted and the permissible post-delivery return window.</p>

                <div className="space-y-6">
                  <div>
                    <label className="inline-flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.returns?.isReturnsEnabled ?? true}
                        onChange={(e) => handleNestedChange('returns', 'isReturnsEnabled', e.target.checked)}
                        className="w-4 h-4 rounded text-[#2A211B] border-[#E5DFD7] focus:ring-[#2A211B]"
                      />
                      <span className="text-sm font-medium text-[#171513]">
                        Allow customer return requests on delivered orders
                      </span>
                    </label>
                    <p className="text-xs text-[#7A6B5D] ml-7 mt-1">
                      If disabled, customers cannot submit new return requests from their order detail portal.
                    </p>
                  </div>

                  {formData.returns?.isReturnsEnabled && (
                    <div className="p-4 bg-[#F7F3EE] rounded-lg border border-[#E5DFD7] max-w-lg">
                      <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                        Return Window Duration (Days) <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="0"
                          max="90"
                          value={formData.returns?.returnWindowDays ?? 7}
                          onChange={(e) => handleNestedChange('returns', 'returnWindowDays', parseInt(e.target.value, 10) || 0)}
                          className={`w-32 px-3.5 py-2.5 rounded-lg border text-sm text-[#171513] bg-white focus:outline-none transition-colors ${
                            fieldErrors['returns.returnWindowDays']
                              ? 'border-rose-400 focus:ring-1 focus:ring-rose-500'
                              : 'border-[#E5DFD7] focus:border-[#2A211B]'
                          }`}
                        />
                        <span className="text-sm text-[#7A6B5D]">days from delivery</span>
                      </div>
                      {fieldErrors['returns.returnWindowDays'] ? (
                        <p className="text-xs text-rose-600 mt-1">{fieldErrors['returns.returnWindowDays']}</p>
                      ) : (
                        <p className="text-xs text-[#7A6B5D] mt-2">
                          Standard industry benchmark is 7 to 14 days. Value cannot exceed 90 days.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SECTION E: CASH ON DELIVERY & CURRENCY */}
          {activeTab === 'payment' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-[#E5DFD7] p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#E5DFD7]">
                  <div>
                    <h2 className="text-lg font-serif text-[#171513]">Payment Method & Settlements</h2>
                    <p className="text-xs text-[#7A6B5D] mt-0.5">Platform payment invariants and maximum Cash on Delivery allowances.</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    COD Active & Enforced
                  </span>
                </div>

                {/* Immutable Notice */}
                <div className="p-4 rounded-lg bg-[#F7F3EE] border border-[#E5DFD7] mb-6 flex items-start gap-3">
                  <Lock className="w-4 h-4 text-[#7A6B5D] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#7A6B5D] leading-relaxed">
                    <strong className="text-[#171513] font-medium block">Platform Invariant:</strong>
                    LuxeCart is configured exclusively for <strong>Cash on Delivery (COD)</strong> settlements in <strong>Indian Rupee (INR — ₹)</strong>. Additional payment gateways and multi-currency exchange are disabled at the platform level and cannot be modified.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Maximum COD Order Ceiling (₹) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-sm text-[#7A6B5D]">₹</span>
                      <input
                        type="number"
                        min="100"
                        max="1000000"
                        step="1000"
                        value={formData.payment?.maxCodOrderRupees ?? 100000}
                        onChange={(e) => handleNestedChange('payment', 'maxCodOrderRupees', e.target.value)}
                        className={`w-full pl-8 pr-3.5 py-2.5 rounded-lg border text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none transition-colors ${
                          fieldErrors['payment.maxCodOrderRupees']
                            ? 'border-rose-400 focus:ring-1 focus:ring-rose-500'
                            : 'border-[#E5DFD7] focus:border-[#2A211B]'
                        }`}
                      />
                    </div>
                    {fieldErrors['payment.maxCodOrderRupees'] ? (
                      <p className="text-xs text-rose-600 mt-1">{fieldErrors['payment.maxCodOrderRupees']}</p>
                    ) : (
                      <p className="text-xs text-[#7A6B5D] mt-1">
                        Orders exceeding {formatCurrencyRupees(formData.payment?.maxCodOrderRupees || 100000)} cannot be checked out with COD. (Range: ₹100 to ₹10,00,000).
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Platform Currency Code & Symbol
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        disabled
                        value="INR (₹) — Indian Rupee"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#7A6B5D] bg-[#F3EDE6] cursor-not-allowed"
                      />
                    </div>
                    <p className="text-xs text-[#7A6B5D] mt-1">Immutable platform standard.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION F: STORE AVAILABILITY & MAINTENANCE */}
          {activeTab === 'availability' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-[#E5DFD7] p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#E5DFD7]">
                  <div>
                    <h2 className="text-lg font-serif text-[#171513]">Scheduled Maintenance Mode</h2>
                    <p className="text-xs text-[#7A6B5D] mt-0.5">Control whether customer transactions and review submissions are paused.</p>
                  </div>
                  {formData.maintenance?.isMaintenanceMode ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Maintenance Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Storefront Live
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed mb-6">
                  <strong className="font-semibold block mb-1">Impact of Enabling Maintenance Mode:</strong>
                  When maintenance mode is active, customer checkout mutations (<code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-300">POST /api/v1/orders</code>) and product review submissions (<code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-300">POST /api/v1/products/:id/reviews</code>) will be blocked with an HTTP 503 Service Unavailable status presenting your custom message. Public product catalog browsing and administrative console access remain completely operational.
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-[#FDFBF7] rounded-lg border border-[#E5DFD7]">
                    <div>
                      <span className="block text-sm font-semibold text-[#171513]">
                        Enable Store Maintenance Mode
                      </span>
                      <span className="text-xs text-[#7A6B5D]">
                        Toggle off when scheduled updates or catalog migrations are complete.
                      </span>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.maintenance?.isMaintenanceMode || false}
                        onChange={(e) => handleMaintenanceToggle(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[#D0C7BD] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D0C7BD] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#171513] uppercase tracking-wider mb-2">
                      Customer Maintenance Alert Message
                    </label>
                    <textarea
                      rows={3}
                      value={formData.maintenance?.maintenanceMessage || ''}
                      onChange={(e) => handleNestedChange('maintenance', 'maintenanceMessage', e.target.value)}
                      maxLength={500}
                      placeholder="The store is currently undergoing scheduled maintenance. Please check back shortly."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5DFD7] text-sm text-[#171513] bg-[#FDFBF7] focus:bg-white focus:outline-none focus:border-[#2A211B] transition-colors"
                    />
                    <p className="text-xs text-[#7A6B5D] mt-1">
                      Rendered on customer error dialogs when transactions are blocked during maintenance (up to 500 characters).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Maintenance Mode Confirmation Modal */}
        {isMaintenanceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#E5DFD7] animate-in fade-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-serif text-[#171513] text-center mb-2">
                Enable Store Maintenance Mode?
              </h3>
              <p className="text-xs text-[#7A6B5D] text-center leading-relaxed mb-6">
                Enabling maintenance mode will temporarily pause customer order placement and review submissions. Customer checkout requests will receive HTTP 503 notifications. Administrator sessions and catalog browsing will not be interrupted.
              </p>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5DFD7]">
                <button
                  type="button"
                  onClick={() => setIsMaintenanceModalOpen(false)}
                  className="px-4 py-2 border border-[#E5DFD7] rounded-lg text-sm font-medium text-[#171513] hover:bg-[#F7F3EE] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmEnableMaintenance}
                  className="px-5 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 shadow-xs transition-colors"
                >
                  Confirm & Enable Maintenance
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
