import mongoose from 'mongoose';
import Address from './address.model.js';

class AddressService {
  /**
   * Get all addresses for the authenticated customer
   * Default address is sorted first, then newest first
   * @param {string} userId
   * @returns {Promise<Array<Address>>}
   */
  async getAddresses(userId) {
    return Address.find({ userId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();
  }

  /**
   * Create a new customer address
   * @param {string} userId
   * @param {object} addressData
   * @returns {Promise<Address>}
   */
  async createAddress(userId, addressData) {
    const existingCount = await Address.countDocuments({ userId });

    // If first address, it MUST be the default
    let isDefault = existingCount === 0 ? true : Boolean(addressData.isDefault);

    // If explicitly marking as default and existing addresses exist, unset previous default
    if (isDefault && existingCount > 0) {
      await Address.updateMany(
        { userId, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const address = new Address({
      ...addressData,
      userId,
      isDefault,
    });

    await address.save();
    return address;
  }

  /**
   * Update an existing address
   * @param {string} userId
   * @param {string} addressId
   * @param {object} updateData
   * @returns {Promise<Address>}
   */
  async updateAddress(userId, addressId, updateData) {
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      const error = new Error('Address not found');
      error.statusCode = 404;
      error.code = 'ADDRESS_NOT_FOUND';
      throw error;
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      const error = new Error('Address not found');
      error.statusCode = 404;
      error.code = 'ADDRESS_NOT_FOUND';
      throw error;
    }

    // Default address handling
    if (updateData.isDefault === true && !address.isDefault) {
      await Address.updateMany(
        { userId, isDefault: true, _id: { $ne: addressId } },
        { $set: { isDefault: false } }
      );
      address.isDefault = true;
    } else if (updateData.isDefault === false && address.isDefault) {
      // If customer tries to uncheck default on their only default address,
      // maintain default invariant (cannot manually unset without selecting another default)
      const otherAddressesCount = await Address.countDocuments({ userId, _id: { $ne: addressId } });
      if (otherAddressesCount === 0) {
        address.isDefault = true; // Retain default
      }
    }

    // Apply updated fields
    const editableFields = [
      'fullName',
      'phone',
      'addressLine1',
      'addressLine2',
      'landmark',
      'city',
      'state',
      'postalCode',
      'country',
      'addressType',
    ];

    editableFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        address[field] = updateData[field];
      }
    });

    await address.save();
    return address;
  }

  /**
   * Set an address as default for the customer
   * @param {string} userId
   * @param {string} addressId
   * @returns {Promise<Address>}
   */
  async setDefaultAddress(userId, addressId) {
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      const error = new Error('Address not found');
      error.statusCode = 404;
      error.code = 'ADDRESS_NOT_FOUND';
      throw error;
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      const error = new Error('Address not found');
      error.statusCode = 404;
      error.code = 'ADDRESS_NOT_FOUND';
      throw error;
    }

    // Unset previous default
    await Address.updateMany(
      { userId, isDefault: true, _id: { $ne: addressId } },
      { $set: { isDefault: false } }
    );

    address.isDefault = true;
    await address.save();
    return address;
  }

  /**
   * Delete an address
   * If deleting the default address, automatically promote the most recently created remaining address
   * @param {string} userId
   * @param {string} addressId
   * @returns {Promise<{ deletedAddressId: string, newDefaultId: string | null }>}
   */
  async deleteAddress(userId, addressId) {
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      const error = new Error('Address not found');
      error.statusCode = 404;
      error.code = 'ADDRESS_NOT_FOUND';
      throw error;
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      const error = new Error('Address not found');
      error.statusCode = 404;
      error.code = 'ADDRESS_NOT_FOUND';
      throw error;
    }

    const wasDefault = address.isDefault;
    await Address.deleteOne({ _id: addressId, userId });

    let newDefaultId = null;
    if (wasDefault) {
      const nextDefault = await Address.findOne({ userId }).sort({ createdAt: -1 });
      if (nextDefault) {
        nextDefault.isDefault = true;
        await nextDefault.save();
        newDefaultId = nextDefault._id.toString();
      }
    }

    return {
      deletedAddressId: addressId,
      newDefaultId,
    };
  }
}

export default new AddressService();
