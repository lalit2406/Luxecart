/**
 * LuxeCart Phase 6C.1: Admin Customer Management Backend Test Suite
 *
 * Fully isolated in-memory verification suite (Zero writes to live database):
 * 1. Admin Authentication & Role Authorization (401 unauthenticated, 403 non-admin).
 * 2. Admin Account Protection (403 CANNOT_MODIFY_ADMIN_ACCOUNT on get, orders, status update).
 * 3. Customer Directory Listing & Role Isolation (strictly role: 'CUSTOMER', excludes admin accounts).
 * 4. Search & Sanitization (regex escaping, search by name/email/phone).
 * 5. Pagination & Sorting (page, limit, sortBy, sortOrder).
 * 6. Customer Profile & Addresses (sanitized fields, address list, statusHistory).
 * 7. Order Metrics Aggregation & Demo Order Exclusion (isDemo: { $ne: true }).
 * 8. Customer Order History & Demo Order Exclusion.
 * 9. Account Status Modification (only ACTIVE and SUSPENDED permitted, INACTIVE/others rejected).
 * 10. Prohibited Field Injection Rejection (role, password, email, etc.).
 * 11. Session Revocation on Suspension (refreshTokens atomically cleared).
 * 12. Status History Audit Trail (changedBy, changedAt, note recorded).
 */

import assert from 'assert';
import mongoose from 'mongoose';

// Prevent Mongoose from attempting live network connections during mock tests
mongoose.set('bufferCommands', false);

import adminCustomerService from '../src/modules/users/adminCustomer.service.js';
import User from '../src/modules/users/user.model.js';
import Address from '../src/modules/addresses/address.model.js';
import Order from '../src/modules/orders/order.model.js';
import {
  validateAdminCustomerQuery,
  validateCustomerOrdersQuery,
  validateUpdateCustomerStatus,
} from '../src/validators/adminCustomer.validator.js';
import { authenticate, requireRole } from '../src/middlewares/auth.middleware.js';
import { generateAccessToken } from '../src/utils/token.js';

console.log('======================================================================');
console.log('   LUXECART PHASE 6C.1: ADMIN CUSTOMER MANAGEMENT TEST SUITE          ');
console.log('======================================================================\n');

const results = [];

function record(testId, name, status, details = '') {
  results.push({ testId, name, status, details });
  const symbol = status === 'PASS' ? '✔ [PASS]' : status === 'SKIP' ? '⚠ [SKIP]' : '✖ [FAIL]';
  console.log(`${symbol} [${testId}] ${name}`);
  if (details && status === 'FAIL') {
    console.error(`       Details: ${details}`);
  }
}

async function runSuite() {
  const adminId = new mongoose.Types.ObjectId().toString();
  const customerAId = new mongoose.Types.ObjectId().toString();
  const customerBId = new mongoose.Types.ObjectId().toString();

  // --------------------------------------------------------------------------
  // TEST 1: Request Validation - validateAdminCustomerQuery
  // --------------------------------------------------------------------------
  try {
    const defaultVal = validateAdminCustomerQuery({});
    assert.strictEqual(defaultVal.isValid, true);
    assert.strictEqual(defaultVal.sanitized.page, 1);
    assert.strictEqual(defaultVal.sanitized.limit, 20);
    assert.strictEqual(defaultVal.sanitized.status, 'ALL');
    assert.strictEqual(defaultVal.sanitized.sortBy, 'createdAt');
    assert.strictEqual(defaultVal.sanitized.sortOrder, 'desc');

    const validCustom = validateAdminCustomerQuery({
      page: '3',
      limit: '50',
      status: 'SUSPENDED',
      search: '  John Doe  ',
      sortBy: 'name',
      sortOrder: 'asc',
    });
    assert.strictEqual(validCustom.isValid, true);
    assert.strictEqual(validCustom.sanitized.page, 3);
    assert.strictEqual(validCustom.sanitized.limit, 50);
    assert.strictEqual(validCustom.sanitized.status, 'SUSPENDED');
    assert.strictEqual(validCustom.sanitized.search, 'John Doe');
    assert.strictEqual(validCustom.sanitized.sortBy, 'name');
    assert.strictEqual(validCustom.sanitized.sortOrder, 'asc');

    const invalidVal = validateAdminCustomerQuery({
      page: '-1',
      limit: '500',
      status: 'BANNED',
      sortBy: 'password',
      sortOrder: 'sideways',
    });
    assert.strictEqual(invalidVal.isValid, false);
    assert.strictEqual(invalidVal.errors.length, 5);

    record('TEST_01', 'validateAdminCustomerQuery correctly validates defaults and rejects invalid inputs', 'PASS');
  } catch (err) {
    record('TEST_01', 'validateAdminCustomerQuery correctly validates defaults and rejects invalid inputs', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Request Validation - validateUpdateCustomerStatus
  // --------------------------------------------------------------------------
  try {
    // Only ACTIVE and SUSPENDED are valid
    const validActive = validateUpdateCustomerStatus({ status: 'ACTIVE', reason: 'Reinstated by admin' });
    assert.strictEqual(validActive.isValid, true);
    assert.strictEqual(validActive.sanitized.status, 'ACTIVE');
    assert.strictEqual(validActive.sanitized.reason, 'Reinstated by admin');

    const validSuspended = validateUpdateCustomerStatus({ status: 'SUSPENDED' });
    assert.strictEqual(validSuspended.isValid, true);
    assert.strictEqual(validSuspended.sanitized.status, 'SUSPENDED');
    assert.strictEqual(validSuspended.sanitized.reason, '');

    // INACTIVE must be rejected (only ACTIVE or SUSPENDED allowed via customer management)
    const invalidInactive = validateUpdateCustomerStatus({ status: 'INACTIVE' });
    assert.strictEqual(invalidInactive.isValid, false);

    // Prohibited injection fields
    const injectionAttempt = validateUpdateCustomerStatus({
      status: 'SUSPENDED',
      role: 'ADMIN',
      password: 'new-password',
      email: 'hacked@example.com',
    });
    assert.strictEqual(injectionAttempt.isValid, false);
    assert(injectionAttempt.errors.some((e) => e.includes('role')));
    assert(injectionAttempt.errors.some((e) => e.includes('password')));
    assert(injectionAttempt.errors.some((e) => e.includes('email')));

    record('TEST_02', 'validateUpdateCustomerStatus allows only ACTIVE/SUSPENDED and rejects prohibited fields', 'PASS');
  } catch (err) {
    record('TEST_02', 'validateUpdateCustomerStatus allows only ACTIVE/SUSPENDED and rejects prohibited fields', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Route Authorization Middleware
  // --------------------------------------------------------------------------
  try {
    // 1. Unauthenticated request
    let unauthPassed = false;
    let resPayload = null;
    const mockRes = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        resPayload = data;
        return this;
      },
    };

    authenticate({ cookies: {}, headers: {} }, mockRes, () => {
      unauthPassed = true;
    });
    assert.strictEqual(unauthPassed, false);
    assert.strictEqual(mockRes.statusCode, 401);

    // 2. Customer trying to access admin endpoint
    let forbiddenPassed = false;
    const reqWithCustomer = { user: { id: customerAId, role: 'CUSTOMER' } };
    requireRole('ADMIN')(reqWithCustomer, mockRes, () => {
      forbiddenPassed = true;
    });
    assert.strictEqual(forbiddenPassed, false);
    assert.strictEqual(mockRes.statusCode, 403);

    // 3. Admin accessing admin endpoint
    let adminPassed = false;
    const reqWithAdmin = { user: { id: adminId, role: 'ADMIN' } };
    requireRole('ADMIN')(reqWithAdmin, mockRes, () => {
      adminPassed = true;
    });
    assert.strictEqual(adminPassed, true);

    record('TEST_03', 'Authentication and requireRole(ADMIN) guard customer management endpoints', 'PASS');
  } catch (err) {
    record('TEST_03', 'Authentication and requireRole(ADMIN) guard customer management endpoints', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Customer Directory Listing - Role Filter & Demo Isolation
  // --------------------------------------------------------------------------
  try {
    const origCount = User.countDocuments;
    const origFind = User.find;
    const origAggregate = Order.aggregate;

    let appliedFilter = null;
    User.countDocuments = async (filter) => {
      appliedFilter = filter;
      return 1;
    };

    const mockCustomerDoc = {
      _id: new mongoose.Types.ObjectId(customerAId),
      name: 'Alice Smith',
      email: 'alice@example.com',
      phone: '9876543210',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01'),
    };

    User.find = (filter) => {
      appliedFilter = filter;
      const q = {
        sort: () => q,
        skip: () => q,
        limit: () => q,
        select: () => q,
        lean: async () => [mockCustomerDoc],
      };
      return q;
    };

    let orderAggregateMatch = null;
    Order.aggregate = async (pipeline) => {
      orderAggregateMatch = pipeline[0].$match;
      return [
        {
          _id: new mongoose.Types.ObjectId(customerAId),
          totalOrders: 3,
          totalSpentPaise: 450000,
        },
      ];
    };

    const listResult = await adminCustomerService.getCustomers({
      page: 1,
      limit: 20,
      status: 'ALL',
      search: 'Alice',
    });

    // Verify filter strictly isolates role: 'CUSTOMER'
    assert.strictEqual(appliedFilter.role, 'CUSTOMER');
    assert(appliedFilter.$or);
    assert.strictEqual(listResult.customers.length, 1);
    assert.strictEqual(listResult.customers[0].id, customerAId);
    assert.strictEqual(listResult.customers[0].totalOrders, 3);
    assert.strictEqual(listResult.customers[0].totalSpentPaise, 450000);

    // Verify order aggregate strictly excludes demo orders
    assert.deepStrictEqual(orderAggregateMatch.isDemo, { $ne: true });

    User.countDocuments = origCount;
    User.find = origFind;
    Order.aggregate = origAggregate;

    record('TEST_04', 'getCustomers strictly filters role: CUSTOMER and excludes demo orders from metrics', 'PASS');
  } catch (err) {
    record('TEST_04', 'getCustomers strictly filters role: CUSTOMER and excludes demo orders from metrics', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Admin Protection - Cannot View or Modify Admin Accounts
  // --------------------------------------------------------------------------
  try {
    const origUserFindById = User.findById;
    const origUserFindByIdAndUpdate = User.findByIdAndUpdate;

    const mockAdminDoc = {
      _id: new mongoose.Types.ObjectId(adminId),
      name: 'System Administrator',
      email: 'admin@luxecart.com',
      role: 'ADMIN',
      status: 'ACTIVE',
    };

    User.findById = (id) => {
      const q = {
        select: () => q,
        lean: async () => mockAdminDoc,
        ...mockAdminDoc,
      };
      return q;
    };

    // 1. getCustomerById on admin must throw 403 CANNOT_MODIFY_ADMIN_ACCOUNT
    let getAdminError = null;
    try {
      await adminCustomerService.getCustomerById(adminId);
    } catch (err) {
      getAdminError = err;
    }
    assert(getAdminError, 'Expected getCustomerById to throw on admin target');
    assert.strictEqual(getAdminError.statusCode, 403);
    assert.strictEqual(getAdminError.code, 'CANNOT_MODIFY_ADMIN_ACCOUNT');

    // 2. getCustomerOrders on admin must throw 403 CANNOT_MODIFY_ADMIN_ACCOUNT
    let getAdminOrdersError = null;
    try {
      await adminCustomerService.getCustomerOrders(adminId, { page: 1, limit: 10 });
    } catch (err) {
      getAdminOrdersError = err;
    }
    assert(getAdminOrdersError, 'Expected getCustomerOrders to throw on admin target');
    assert.strictEqual(getAdminOrdersError.statusCode, 403);
    assert.strictEqual(getAdminOrdersError.code, 'CANNOT_MODIFY_ADMIN_ACCOUNT');

    // 3. updateCustomerStatus on admin must throw 403 CANNOT_MODIFY_ADMIN_ACCOUNT
    let updateAdminError = null;
    try {
      await adminCustomerService.updateCustomerStatus(adminId, { status: 'SUSPENDED' }, adminId);
    } catch (err) {
      updateAdminError = err;
    }
    assert(updateAdminError, 'Expected updateCustomerStatus to throw on admin target');
    assert.strictEqual(updateAdminError.statusCode, 403);
    assert.strictEqual(updateAdminError.code, 'CANNOT_MODIFY_ADMIN_ACCOUNT');

    User.findById = origUserFindById;
    User.findByIdAndUpdate = origUserFindByIdAndUpdate;

    record('TEST_05', 'Admin accounts are strictly protected with 403 CANNOT_MODIFY_ADMIN_ACCOUNT', 'PASS');
  } catch (err) {
    record('TEST_05', 'Admin accounts are strictly protected with 403 CANNOT_MODIFY_ADMIN_ACCOUNT', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Customer Profile Retrieval & Address Inspection
  // --------------------------------------------------------------------------
  try {
    const origUserFindById = User.findById;
    const origAddressFind = Address.find;
    const origOrderAggregate = Order.aggregate;

    const mockCustomer = {
      _id: new mongoose.Types.ObjectId(customerAId),
      name: 'Alice Smith',
      email: 'alice@example.com',
      phone: '9876543210',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-02-01'),
      statusHistory: [
        {
          _id: new mongoose.Types.ObjectId(),
          status: 'ACTIVE',
          changedAt: new Date('2026-01-01'),
          changedBy: null,
          note: 'Initial account creation',
        },
      ],
    };

    User.findById = () => ({
      select: () => ({
        lean: async () => mockCustomer,
      }),
    });

    const mockAddresses = [
      {
        _id: new mongoose.Types.ObjectId(),
        fullName: 'Alice Smith',
        phone: '9876543210',
        addressLine1: 'Flat 402, Luxury Towers',
        addressLine2: 'Bandra West',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400050',
        country: 'India',
        isDefault: true,
        type: 'HOME',
      },
    ];

    Address.find = () => ({
      sort: () => ({
        lean: async () => mockAddresses,
      }),
    });

    let orderPipelineMatch = null;
    Order.aggregate = async (pipeline) => {
      orderPipelineMatch = pipeline[0].$match;
      return [
        {
          _id: null,
          totalOrders: 2,
          totalSpentPaise: 899900,
          lastOrderDate: new Date('2026-03-01'),
        },
      ];
    };

    const result = await adminCustomerService.getCustomerById(customerAId);
    assert(result.customer);
    assert.strictEqual(result.customer.id, customerAId);
    assert.strictEqual(result.customer.email, 'alice@example.com');
    assert.strictEqual(result.customer.addresses.length, 1);
    assert.strictEqual(result.customer.addresses[0].city, 'Mumbai');
    assert.strictEqual(result.customer.orderSummary.totalOrders, 2);
    assert.strictEqual(result.customer.orderSummary.totalSpentPaise, 899900);
    assert.strictEqual(result.customer.statusHistory.length, 1);
    assert.deepStrictEqual(orderPipelineMatch.isDemo, { $ne: true });

    // Ensure no sensitive fields are present
    assert.strictEqual(result.customer.passwordHash, undefined);
    assert.strictEqual(result.customer.refreshTokens, undefined);

    User.findById = origUserFindById;
    Address.find = origAddressFind;
    Order.aggregate = origOrderAggregate;

    record('TEST_06', 'getCustomerById returns sanitized customer details, addresses, and order summary', 'PASS');
  } catch (err) {
    record('TEST_06', 'getCustomerById returns sanitized customer details, addresses, and order summary', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Customer Order History & Demo Exclusion
  // --------------------------------------------------------------------------
  try {
    const origUserFindById = User.findById;
    const origOrderCount = Order.countDocuments;
    const origOrderFind = Order.find;

    User.findById = () => ({
      select: () => ({
        lean: async () => ({ _id: customerAId, role: 'CUSTOMER' }),
      }),
    });

    let countFilter = null;
    let findFilter = null;

    Order.countDocuments = async (filter) => {
      countFilter = filter;
      return 1;
    };

    Order.find = (filter) => {
      findFilter = filter;
      const q = {
        sort: () => q,
        skip: () => q,
        limit: () => q,
        select: () => q,
        lean: async () => [
          {
            _id: new mongoose.Types.ObjectId(),
            orderNumber: 'LC-20260301-LIVE01',
            status: 'DELIVERED',
            payment: { method: 'CASH_ON_DELIVERY', status: 'COMPLETED' },
            pricing: { grandTotal: 250000, itemCount: 1 },
            items: [{ title: 'Silk Scarf', quantity: 1, totalPrice: 250000 }],
            createdAt: new Date('2026-03-01'),
            updatedAt: new Date('2026-03-05'),
          },
        ],
      };
      return q;
    };

    const ordersResult = await adminCustomerService.getCustomerOrders(customerAId, { page: 1, limit: 10 });
    assert.strictEqual(ordersResult.orders.length, 1);
    assert.strictEqual(ordersResult.orders[0].orderNumber, 'LC-20260301-LIVE01');
    assert.strictEqual(ordersResult.orders[0].grandTotalPaise, 250000);

    // Verify demo order exclusion
    assert.deepStrictEqual(countFilter.isDemo, { $ne: true });
    assert.deepStrictEqual(findFilter.isDemo, { $ne: true });

    User.findById = origUserFindById;
    Order.countDocuments = origOrderCount;
    Order.find = origOrderFind;

    record('TEST_07', 'getCustomerOrders strictly excludes demo orders using isDemo: { $ne: true }', 'PASS');
  } catch (err) {
    record('TEST_07', 'getCustomerOrders strictly excludes demo orders using isDemo: { $ne: true }', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Account Status Modification & Session Revocation
  // --------------------------------------------------------------------------
  try {
    const origUserFindById = User.findById;
    const origUserFindByIdAndUpdate = User.findByIdAndUpdate;

    User.findById = () => ({
      select: async () => ({
        _id: new mongoose.Types.ObjectId(customerAId),
        role: 'CUSTOMER',
        status: 'ACTIVE',
      }),
    });

    let executedUpdateOps = null;
    User.findByIdAndUpdate = (id, updateOps) => {
      executedUpdateOps = updateOps;
      return {
        select: () => ({
          lean: async () => ({
            _id: new mongoose.Types.ObjectId(customerAId),
            name: 'Alice Smith',
            email: 'alice@example.com',
            status: updateOps.$set.status,
            updatedAt: new Date(),
            statusHistory: updateOps.$push?.statusHistory ? [updateOps.$push.statusHistory] : [],
          }),
        }),
      };
    };

    // 1. Suspend account -> refreshTokens must be atomically cleared to []
    const suspendRes = await adminCustomerService.updateCustomerStatus(
      customerAId,
      { status: 'SUSPENDED', reason: 'Suspicious card attempts' },
      adminId
    );

    assert.strictEqual(suspendRes.status, 'SUSPENDED');
    assert.strictEqual(executedUpdateOps.$set.status, 'SUSPENDED');
    assert.deepStrictEqual(executedUpdateOps.$set.refreshTokens, []);
    assert.strictEqual(executedUpdateOps.$push.statusHistory.status, 'SUSPENDED');
    assert.strictEqual(executedUpdateOps.$push.statusHistory.changedBy, adminId);
    assert.strictEqual(executedUpdateOps.$push.statusHistory.note, 'Suspicious card attempts');

    // 2. Reactivate account -> status set to ACTIVE
    const activateRes = await adminCustomerService.updateCustomerStatus(
      customerAId,
      { status: 'ACTIVE', reason: 'Identity verified' },
      adminId
    );

    assert.strictEqual(activateRes.status, 'ACTIVE');
    assert.strictEqual(executedUpdateOps.$set.status, 'ACTIVE');
    assert.strictEqual(executedUpdateOps.$set.refreshTokens, undefined);
    assert.strictEqual(executedUpdateOps.$push.statusHistory.status, 'ACTIVE');

    User.findById = origUserFindById;
    User.findByIdAndUpdate = origUserFindByIdAndUpdate;

    record('TEST_08', 'updateCustomerStatus atomically clears refreshTokens on suspension and records audit history', 'PASS');
  } catch (err) {
    record('TEST_08', 'updateCustomerStatus atomically clears refreshTokens on suspension and records audit history', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Invalid ObjectId and Not Found Error Handling
  // --------------------------------------------------------------------------
  try {
    let invalidIdCaught = 0;
    try {
      await adminCustomerService.getCustomerById('not-a-valid-id');
    } catch (err) {
      if (err.statusCode === 400 && err.code === 'INVALID_ID') invalidIdCaught++;
    }
    try {
      await adminCustomerService.getCustomerOrders('not-a-valid-id', { page: 1, limit: 10 });
    } catch (err) {
      if (err.statusCode === 400 && err.code === 'INVALID_ID') invalidIdCaught++;
    }
    try {
      await adminCustomerService.updateCustomerStatus('not-a-valid-id', { status: 'ACTIVE' }, adminId);
    } catch (err) {
      if (err.statusCode === 400 && err.code === 'INVALID_ID') invalidIdCaught++;
    }
    assert.strictEqual(invalidIdCaught, 3, 'All 3 methods must reject invalid ObjectId with 400 INVALID_ID');

    // Test 404 when customer does not exist
    const origFindById = User.findById;
    User.findById = () => ({
      select: () => ({
        lean: async () => null,
      }),
    });

    let notFoundCaught = 0;
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    try {
      await adminCustomerService.getCustomerById(nonExistentId);
    } catch (err) {
      if (err.statusCode === 404 && err.code === 'CUSTOMER_NOT_FOUND') notFoundCaught++;
    }
    try {
      await adminCustomerService.getCustomerOrders(nonExistentId, { page: 1, limit: 10 });
    } catch (err) {
      if (err.statusCode === 404 && err.code === 'CUSTOMER_NOT_FOUND') notFoundCaught++;
    }

    User.findById = () => ({
      select: async () => null,
    });
    try {
      await adminCustomerService.updateCustomerStatus(nonExistentId, { status: 'ACTIVE' }, adminId);
    } catch (err) {
      if (err.statusCode === 404 && err.code === 'CUSTOMER_NOT_FOUND') notFoundCaught++;
    }
    assert.strictEqual(notFoundCaught, 3, 'All 3 methods must return 404 CUSTOMER_NOT_FOUND for non-existent users');

    User.findById = origFindById;
    record('TEST_09', 'Services correctly reject invalid ObjectIds with 400 and missing records with 404', 'PASS');
  } catch (err) {
    record('TEST_09', 'Services correctly reject invalid ObjectIds with 400 and missing records with 404', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 10: Special Character Regex Escaping in Search
  // --------------------------------------------------------------------------
  try {
    const origCount = User.countDocuments;
    const origFind = User.find;
    let capturedFilter = null;

    User.countDocuments = async (filter) => {
      capturedFilter = filter;
      return 0;
    };
    User.find = () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            select: () => ({
              lean: async () => [],
            }),
          }),
        }),
      }),
    });

    // Special regex chars that would throw SyntaxError if not escaped: [ + * ? ( ) { } ^ $ | \
    await adminCustomerService.getCustomers({
      page: 1,
      limit: 10,
      search: 'user+[test](regex)*?^$',
    });

    assert(capturedFilter.$or);
    assert.strictEqual(capturedFilter.$or.length, 3);
    const regexPattern = capturedFilter.$or[0].name.source;
    assert(regexPattern.includes('\\+\\[test\\]\\(regex\\)\\*\\?\\^\\$'));

    User.countDocuments = origCount;
    User.find = origFind;
    record('TEST_10', 'Search safely escapes regex metacharacters preventing ReDoS or syntax exceptions', 'PASS');
  } catch (err) {
    record('TEST_10', 'Search safely escapes regex metacharacters preventing ReDoS or syntax exceptions', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 11: User Schema compound indexes and statusHistory schema definition
  // --------------------------------------------------------------------------
  try {
    const indexes = User.schema.indexes();
    const hasRoleCreatedIndex = indexes.some(
      ([fields]) => fields.role === 1 && fields.createdAt === -1
    );
    const hasRoleStatusIndex = indexes.some(
      ([fields]) => fields.role === 1 && fields.status === 1
    );

    assert(hasRoleCreatedIndex, 'Missing compound index { role: 1, createdAt: -1 } on User');
    assert(!hasRoleStatusIndex, 'Index { role: 1, status: 1 } must not exist on User schema per Phase 7.2B.5 cleanup');

    const statusHistoryField = User.schema.path('statusHistory');
    assert(statusHistoryField, 'Missing statusHistory field on User schema');
    assert(statusHistoryField.schema.path('status'), 'Missing status field on statusHistory schema');
    assert(statusHistoryField.schema.path('changedAt'), 'Missing changedAt field on statusHistory schema');
    assert(statusHistoryField.schema.path('changedBy'), 'Missing changedBy field on statusHistory schema');
    assert(statusHistoryField.schema.path('note'), 'Missing note field on statusHistory schema');

    record('TEST_11', 'User schema includes approved { role: 1, createdAt: -1 } index, excludes { role: 1, status: 1 }, and validates statusHistory audit schema', 'PASS');
  } catch (err) {
    record('TEST_11', 'User schema includes approved { role: 1, createdAt: -1 } index, excludes { role: 1, status: 1 }, and validates statusHistory audit schema', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 12: Controller Layer Response & Status Code Contract
  // --------------------------------------------------------------------------
  try {
    const { getCustomers: ctrlGetCustomers, updateCustomerStatus: ctrlUpdateStatus } = await import(
      '../src/modules/users/adminCustomer.controller.js'
    );

    let nextError = null;
    const mockNext = (err) => {
      nextError = err;
    };

    // Controller validation failure on query
    await ctrlGetCustomers({ query: { page: 'invalid' } }, {}, mockNext);
    assert(nextError);
    assert.strictEqual(nextError.statusCode, 400);
    assert.strictEqual(nextError.code, 'VALIDATION_ERROR');

    // Controller validation failure on status update
    nextError = null;
    await ctrlUpdateStatus({ params: { id: customerAId }, body: { status: 'INVALID' }, user: { id: adminId } }, {}, mockNext);
    assert(nextError);
    assert.strictEqual(nextError.statusCode, 400);
    assert.strictEqual(nextError.code, 'VALIDATION_ERROR');

    record('TEST_12', 'Controller correctly catches validation failures and propagates error with 400 status', 'PASS');
  } catch (err) {
    record('TEST_12', 'Controller correctly catches validation failures and propagates error with 400 status', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log('   TEST RUN SUMMARY');
  console.log('======================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  console.log(`Total Tests : ${total}`);
  console.log(`Passed      : ${passed}`);
  console.log(`Failed      : ${failed}`);

  if (failed > 0) {
    console.error('\nSome tests failed. See details above.');
    process.exit(1);
  } else {
    console.log('\nAll Phase 6C.1 Admin Customer Management tests passed successfully!');
    process.exit(0);
  }
}

runSuite().catch((err) => {
  console.error('Unhandled suite error:', err);
  process.exit(1);
});
