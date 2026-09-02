import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAddress } from '../features/addresses/context/AddressContext';
import {
  MapPin,
  Plus,
  Home,
  Briefcase,
  Building,
  CheckCircle2,
  Edit2,
  Trash2,
  Star,
  RefreshCw,
  AlertTriangle,
  X,
  Phone,
  ShieldCheck,
  ArrowLeft,
  Check,
} from 'lucide-react';

const INITIAL_FORM = {
  fullName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  addressType: 'HOME',
  isDefault: false,
};

export default function AddressesPage() {
  const { addresses, loading, error, addAddress, editAddress, removeAddress, makeDefault } = useAddress();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleOpenAdd = () => {
    setEditingAddress(null);
    setFormData({
      ...INITIAL_FORM,
      isDefault: addresses.length === 0, // Auto-check default if first address
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (addr) => {
    setEditingAddress(addr);
    setFormData({
      fullName: addr.fullName || '',
      phone: addr.phone || '',
      addressLine1: addr.addressLine1 || '',
      addressLine2: addr.addressLine2 || '',
      landmark: addr.landmark || '',
      city: addr.city || '',
      state: addr.state || '',
      postalCode: addr.postalCode || '',
      country: 'India',
      addressType: addr.addressType || 'HOME',
      isDefault: Boolean(addr.isDefault),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingAddress(null);
    setFormData(INITIAL_FORM);
    setFormError(null);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Client validation
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      setFormError('Full name must be at least 2 characters long');
      return;
    }

    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setFormError('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    if (!formData.addressLine1.trim() || formData.addressLine1.trim().length < 3) {
      setFormError('Address Line 1 must be at least 3 characters long');
      return;
    }

    if (!formData.city.trim() || !formData.state.trim()) {
      setFormError('City and State are required');
      return;
    }

    if (!/^\d{6}$/.test(formData.postalCode.trim())) {
      setFormError('Please enter a valid 6-digit Indian PIN code');
      return;
    }

    setSubmitting(true);
    try {
      if (editingAddress) {
        await editAddress(editingAddress._id || editingAddress.id, formData);
      } else {
        await addAddress(formData);
      }
      handleCloseModal();
    } catch (err) {
      setFormError(err.message || 'Failed to save address');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDelete = (addr) => {
    setAddressToDelete(addr);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!addressToDelete) return;
    setDeleting(true);
    try {
      await removeAddress(addressToDelete._id || addressToDelete.id);
      setDeleteModalOpen(false);
      setAddressToDelete(null);
    } catch (err) {
      // Handled via context
    } finally {
      setDeleting(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'HOME':
        return <Home className="w-3.5 h-3.5" />;
      case 'WORK':
        return <Briefcase className="w-3.5 h-3.5" />;
      default:
        return <Building className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3EE] text-[#171513] flex flex-col justify-between">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1">
        {/* Breadcrumbs & Header */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-2 text-xs text-[#6F6963]">
            <Link to="/" className="hover:text-[#2A211B]">
              Home
            </Link>
            <span>/</span>
            <span className="text-[#2A211B] font-semibold">Saved Addresses</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E7DED5] pb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2A211B]">
                Saved Delivery Addresses
              </h1>
              <p className="text-xs text-[#6F6963] mt-1">
                Manage your home, office, and preferred delivery locations across India.
              </p>
            </div>

            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] transition-colors text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Address</span>
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 mb-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Body */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-[#9A6A45] animate-spin" />
            <p className="text-xs text-[#6F6963]">Loading saved addresses...</p>
          </div>
        ) : addresses.length === 0 ? (
          <div className="bg-white border border-[#E7DED5] rounded-3xl p-12 text-center max-w-md mx-auto space-y-4 shadow-xs">
            <div className="w-16 h-16 rounded-full bg-[#F7F3EE] flex items-center justify-center mx-auto text-[#9A6A45]">
              <MapPin className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-base font-serif font-bold text-[#2A211B]">
                No Saved Addresses Yet
              </h2>
              <p className="text-xs text-[#6F6963] mt-1">
                Add your delivery address now for a seamless checkout experience.
              </p>
            </div>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Address</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {addresses.map((addr) => {
              const isDefault = addr.isDefault;
              const addrId = addr._id || addr.id;

              return (
                <div
                  key={addrId}
                  className={`bg-white rounded-3xl border p-6 flex flex-col justify-between shadow-xs transition-all ${
                    isDefault
                      ? 'border-[#9A6A45] ring-2 ring-[#9A6A45]/20'
                      : 'border-[#E7DED5] hover:border-[#2A211B]'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F7F3EE] border border-[#E7DED5] text-[10px] font-bold text-[#2A211B] uppercase tracking-wider">
                        {getTypeIcon(addr.addressType)}
                        <span>{addr.addressType}</span>
                      </span>

                      {isDefault && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Default</span>
                        </span>
                      )}
                    </div>

                    {/* Customer Info */}
                    <div>
                      <h3 className="text-sm font-bold text-[#2A211B]">{addr.fullName}</h3>
                      <p className="text-xs text-[#6F6963] flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3" />
                        <span>+91 {addr.phone}</span>
                      </p>
                    </div>

                    {/* Formatted Address */}
                    <div className="text-xs text-[#2A211B] space-y-0.5 leading-relaxed pt-1">
                      <p>{addr.addressLine1}</p>
                      {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                      {addr.landmark && (
                        <p className="text-[#6F6963] italic">Landmark: {addr.landmark}</p>
                      )}
                      <p className="font-medium">
                        {addr.city}, {addr.state} — <span className="font-mono font-bold">{addr.postalCode}</span>
                      </p>
                      <p className="text-[#6F6963]">{addr.country}</p>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 mt-4 border-t border-[#E7DED5] flex items-center justify-between gap-2">
                    {!isDefault ? (
                      <button
                        onClick={() => makeDefault(addrId)}
                        className="text-[11px] font-semibold text-[#6F6963] hover:text-[#9A6A45] flex items-center gap-1 cursor-pointer"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>Set Default</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-[#9A6A45] flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Primary Address</span>
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(addr)}
                        className="p-1.5 rounded-lg border border-[#E7DED5] text-[#2A211B] hover:bg-[#F7F3EE] transition-colors cursor-pointer"
                        title="Edit Address"
                        aria-label="Edit address"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenDelete(addr)}
                        className="p-1.5 rounded-lg border border-[#E7DED5] text-[#6F6963] hover:text-red-700 hover:border-red-300 transition-colors cursor-pointer"
                        title="Delete Address"
                        aria-label="Delete address"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add / Edit Address Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E7DED5] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E7DED5] pb-4">
              <div>
                <h2 className="text-lg font-serif font-bold text-[#2A211B]">
                  {editingAddress ? 'Edit Delivery Address' : 'Add New Address'}
                </h2>
                <p className="text-xs text-[#6F6963] mt-0.5">
                  Shipment delivery within India only.
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 text-[#6F6963] hover:text-[#2A211B] rounded-xl hover:bg-[#F7F3EE]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {/* Full Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lalit Kumar"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6F6963]">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                      className="w-full pl-12 pr-3.5 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] font-mono focus:outline-none focus:border-[#2A211B]"
                    />
                  </div>
                </div>
              </div>

              {/* Address Line 1 */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                  Flat / House No. / Building / Street *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flat 402, Royal Residency, 12th Main Road"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                />
              </div>

              {/* Address Line 2 & Landmark */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                    Area / Colony (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Indiranagar"
                    value={formData.addressLine2}
                    onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                    Landmark (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Near Metro Station"
                    value={formData.landmark}
                    onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  />
                </div>
              </div>

              {/* City, State, PIN */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bengaluru"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Karnataka"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] focus:outline-none focus:border-[#2A211B]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                    PIN Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="560038"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3.5 py-2.5 bg-[#F7F3EE] border border-[#E7DED5] rounded-xl text-xs text-[#2A211B] font-mono focus:outline-none focus:border-[#2A211B]"
                  />
                </div>
              </div>

              {/* Address Type Selector */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#6F6963]">
                  Address Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['HOME', 'WORK', 'OTHER'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({ ...formData, addressType: t })}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        formData.addressType === t
                          ? 'bg-[#2A211B] text-white border-[#2A211B]'
                          : 'bg-[#F7F3EE] text-[#6F6963] border-[#E7DED5] hover:bg-[#E7DED5]'
                      }`}
                    >
                      {getTypeIcon(t)}
                      <span>{t}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Make Default Checkbox */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                    className="w-4 h-4 rounded text-[#9A6A45] focus:ring-[#9A6A45]"
                  />
                  <span className="text-xs font-semibold text-[#2A211B]">
                    Make this my default delivery address
                  </span>
                </label>
              </div>

              {/* Form Footer */}
              <div className="pt-4 border-t border-[#E7DED5] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 rounded-xl border border-[#E7DED5] bg-white text-[#2A211B] hover:bg-[#F7F3EE] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#2A211B] text-white hover:bg-[#9A6A45] text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingAddress ? 'Update Address' : 'Save Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && addressToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-[#E7DED5] rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-serif font-bold text-[#2A211B]">
                Delete Address?
              </h3>
              <p className="text-xs text-[#6F6963] mt-1">
                Are you sure you want to delete the address for{' '}
                <span className="font-semibold text-[#2A211B]">{addressToDelete.fullName}</span>?
              </p>
              {addressToDelete.isDefault && addresses.length > 1 && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-xl border border-amber-200 mt-2 font-medium">
                  This is your default address. Another saved address will automatically become the new default.
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="w-1/2 py-2.5 rounded-xl border border-[#E7DED5] bg-white text-[#2A211B] hover:bg-[#F7F3EE] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="w-1/2 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
