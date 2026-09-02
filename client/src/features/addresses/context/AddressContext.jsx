import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { addressApi } from '../api/addressApi';
import { useAuth } from '../../auth/hooks/useAuth';

const AddressContext = createContext(null);

export function AddressProvider({ children }) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);

  const fetchAddresses = useCallback(async () => {
    if (!user) {
      setAddresses([]);
      setSelectedAddressId(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await addressApi.getAddresses();
      const list = res?.data?.addresses || [];
      setAddresses(list);

      // Default selected address to isDefault address or first address
      const defaultAddr = list.find((a) => a.isDefault) || list[0];
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr._id || defaultAddr.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch addresses');
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const addAddress = async (addressData) => {
    setError(null);
    try {
      const res = await addressApi.createAddress(addressData);
      await fetchAddresses();
      return res?.data?.address;
    } catch (err) {
      setError(err.message || 'Failed to create address');
      throw err;
    }
  };

  const editAddress = async (id, updateData) => {
    setError(null);
    try {
      const res = await addressApi.updateAddress(id, updateData);
      await fetchAddresses();
      return res?.data?.address;
    } catch (err) {
      setError(err.message || 'Failed to update address');
      throw err;
    }
  };

  const removeAddress = async (id) => {
    setError(null);
    try {
      await addressApi.deleteAddress(id);
      await fetchAddresses();
    } catch (err) {
      setError(err.message || 'Failed to delete address');
      throw err;
    }
  };

  const makeDefault = async (id) => {
    setError(null);
    try {
      const res = await addressApi.setDefaultAddress(id);
      await fetchAddresses();
      setSelectedAddressId(id);
      return res?.data?.address;
    } catch (err) {
      setError(err.message || 'Failed to set default address');
      throw err;
    }
  };

  const selectAddress = (id) => {
    setSelectedAddressId(id);
  };

  const defaultAddress = addresses.find((a) => a.isDefault) || addresses[0] || null;
  const selectedAddress =
    addresses.find((a) => (a._id || a.id) === selectedAddressId) || defaultAddress;

  const value = {
    addresses,
    loading,
    error,
    defaultAddress,
    selectedAddress,
    selectedAddressId,
    fetchAddresses,
    addAddress,
    editAddress,
    removeAddress,
    makeDefault,
    selectAddress,
  };

  return <AddressContext.Provider value={value}>{children}</AddressContext.Provider>;
}

export function useAddress() {
  const context = useContext(AddressContext);
  if (!context) {
    throw new Error('useAddress must be used within an AddressProvider');
  }
  return context;
}
