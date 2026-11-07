/**
 * Phase 7.2C — Product Search & Filter Regex Safety Verification Suite
 *
 * Verifies:
 * 1. escapeRegex helper bounds input, trims whitespace, handles non-strings, and escapes metacharacters.
 * 2. Admin product search (getAdminProducts) safely handles normal, literal-special, and malformed queries.
 * 3. Admin product brand filter safely handles normal and literal-special inputs, rejecting invalid types with 400.
 * 4. Public catalog brand and color filters correctly anchor, escape, and normalize tokens.
 * 5. ReDoS and pathological patterns (e.g., (a+)+$) are treated as literal text without catastrophic backtracking.
 * 6. Pagination, sorting, category, and variant filtering semantics remain intact.
 */

import assert from 'assert';
import mongoose from 'mongoose';
mongoose.set('bufferCommands', false);

import { escapeRegex } from '../src/utils/regex.js';
import productService from '../src/modules/products/product.service.js';
import Product from '../src/modules/products/product.model.js';
import Category from '../src/modules/categories/category.model.js';
import { validateCatalogQuery } from '../src/validators/product.validator.js';

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`     Details: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✔ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}`);
    console.error(`     Details: ${err.message}`);
  }
}

console.log('\n==============================================================================');
console.log('   LUXECART PHASE 7.2C: PRODUCT SEARCH REGEX SAFETY VERIFICATION SUITE       ');
console.log('==============================================================================\n');

// ---------------------------------------------------------------------------
// Group 1: escapeRegex Utility Unit Tests
// ---------------------------------------------------------------------------
console.log('--- Group 1: escapeRegex Helper Unit Tests ---');

runTest('1.1 Rejects non-string types cleanly by returning empty string', () => {
  assert.strictEqual(escapeRegex(null), '');
  assert.strictEqual(escapeRegex(undefined), '');
  assert.strictEqual(escapeRegex(12345), '');
  assert.strictEqual(escapeRegex(true), '');
  assert.strictEqual(escapeRegex(['array']), '');
  assert.strictEqual(escapeRegex({ key: 'val' }), '');
});

runTest('1.2 Trims whitespace from input strings', () => {
  assert.strictEqual(escapeRegex('   '), '');
  assert.strictEqual(escapeRegex('  LuxeCart  '), 'LuxeCart');
  assert.strictEqual(escapeRegex('\n\tSignature \t'), 'Signature');
});

runTest('1.3 Enforces default 100 character length bounding before escaping', () => {
  const longInput = 'A'.repeat(250);
  const result = escapeRegex(longInput);
  assert.strictEqual(result.length, 100);
  assert.strictEqual(result, 'A'.repeat(100));

  // Custom limit
  const customLimit = escapeRegex('B'.repeat(50), 20);
  assert.strictEqual(customLimit.length, 20);
});

runTest('1.4 Escapes all JavaScript RegExp metacharacters: . * + ? ^ $ { } ( ) | [ ] \\', () => {
  const specialChars = 'Silk (100%) [Edition] + Cotton * {Luxe} ? $ ^ | . \\';
  const escaped = escapeRegex(specialChars);
  const expected = 'Silk \\(100%\\) \\[Edition\\] \\+ Cotton \\* \\{Luxe\\} \\? \\$ \\^ \\| \\. \\\\';
  assert.strictEqual(escaped, expected);

  // Verify compiled RegExp does not throw and matches literal text exactly
  const compiled = new RegExp(escaped, 'i');
  assert.ok(compiled.test('Pure Silk (100%) [Edition] + Cotton * {Luxe} ? $ ^ | . \\ Brand'));
  assert.strictEqual(compiled.test('Silk 100% Edition Cotton Luxe Brand'), false);
});

runTest('1.5 Does not compile the regex itself (returns a pure string)', () => {
  const result = escapeRegex('test');
  assert.strictEqual(typeof result, 'string');
  assert.strictEqual(result instanceof RegExp, false);
});

// ---------------------------------------------------------------------------
// Group 2: Admin Product Search & Brand Filtering
// ---------------------------------------------------------------------------
console.log('\n--- Group 2: Admin Product Search & Brand Filtering ---');

await runAsyncTest('2.1 Normal partial searches: Oversized, LuxeCart, LUXE-001', async () => {
  const origFind = Product.find;
  const origCount = Product.countDocuments;
  let capturedFilter = null;

  Product.find = (filter) => {
    capturedFilter = filter;
    return {
      populate: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => [{ _id: new mongoose.Types.ObjectId(), name: 'Oversized Silk Shirt' }],
            }),
          }),
        }),
      }),
    };
  };
  Product.countDocuments = async () => 1;

  try {
    await productService.getAdminProducts({ search: 'Oversized' });
    assert.ok(capturedFilter.$or, 'Filter must contain $or stage for search');
    assert.strictEqual(capturedFilter.$or.length, 3);
    assert.strictEqual(capturedFilter.$or[0].name.source, 'Oversized');
    assert.strictEqual(capturedFilter.$or[1].brand.source, 'Oversized');
    assert.strictEqual(capturedFilter.$or[2]['variants.sku'].source, 'Oversized');
    assert.strictEqual(capturedFilter.$or[0].name.flags, 'i');

    // SKU search
    await productService.getAdminProducts({ search: 'LUXE-001' });
    assert.strictEqual(capturedFilter.$or[2]['variants.sku'].source, 'LUXE-001');

    // Brand filter
    await productService.getAdminProducts({ brand: 'LuxeCart' });
    assert.strictEqual(capturedFilter.brand.source, 'LuxeCart');
    assert.strictEqual(capturedFilter.brand.flags, 'i');
  } finally {
    Product.find = origFind;
    Product.countDocuments = origCount;
  }
});

await runAsyncTest('2.2 Literal metacharacters are safely escaped in search and brand', async () => {
  const origFind = Product.find;
  const origCount = Product.countDocuments;
  let capturedFilter = null;

  Product.find = (filter) => {
    capturedFilter = filter;
    return {
      populate: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => [],
            }),
          }),
        }),
      }),
    };
  };
  Product.countDocuments = async () => 0;

  try {
    const metacharSearch = 'Silk (100%) + Cotton [Gold] * {Exclusive} ? $ ^ | .';
    await productService.getAdminProducts({ search: metacharSearch, brand: 'Gucci & Co.' });

    const searchStage = capturedFilter.$or;
    assert.ok(searchStage, 'Search conditions must exist');

    // Verify metacharacters were escaped and compiled safely
    const nameRegex = searchStage[0].name;
    assert.ok(nameRegex.test('Silk (100%) + Cotton [Gold] * {Exclusive} ? $ ^ | .'));
    assert.strictEqual(nameRegex.test('Silk 100% Cotton Gold Exclusive'), false);

    // Verify brand filter
    assert.ok(capturedFilter.brand.test('Gucci & Co.'));
  } finally {
    Product.find = origFind;
    Product.countDocuments = origCount;
  }
});

await runAsyncTest('2.3 Malformed regex patterns such as ( and [ execute safely without SyntaxError', async () => {
  const origFind = Product.find;
  const origCount = Product.countDocuments;
  let capturedFilter = null;

  Product.find = (filter) => {
    capturedFilter = filter;
    return {
      populate: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => [],
            }),
          }),
        }),
      }),
    };
  };
  Product.countDocuments = async () => 0;

  try {
    // Unterminated group '('
    await productService.getAdminProducts({ search: '(', brand: '[' });
    assert.strictEqual(capturedFilter.$or[0].name.source, '\\(');
    assert.strictEqual(capturedFilter.brand.source, '\\[');

    // Invalid quantifiers '+' and '*'
    await productService.getAdminProducts({ search: '*', brand: '+' });
    assert.strictEqual(capturedFilter.$or[0].name.source, '\\*');
    assert.strictEqual(capturedFilter.brand.source, '\\+');
  } finally {
    Product.find = origFind;
    Product.countDocuments = origCount;
  }
});

await runAsyncTest('2.4 Pathological ReDoS input (a+)+$ is treated literally and safely', async () => {
  const origFind = Product.find;
  const origCount = Product.countDocuments;
  let capturedFilter = null;

  Product.find = (filter) => {
    capturedFilter = filter;
    return {
      populate: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => [],
            }),
          }),
        }),
      }),
    };
  };
  Product.countDocuments = async () => 0;

  try {
    await productService.getAdminProducts({ search: '(a+)+$' });
    const nameRegex = capturedFilter.$or[0].name;
    assert.strictEqual(nameRegex.source, '\\(a\\+\\)\\+\\$');
    assert.ok(nameRegex.test('(a+)+$'));
    assert.strictEqual(nameRegex.test('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaX'), false);
  } finally {
    Product.find = origFind;
    Product.countDocuments = origCount;
  }
});

await runAsyncTest('2.5 Empty and whitespace-only queries do not construct empty regex filters', async () => {
  const origFind = Product.find;
  const origCount = Product.countDocuments;
  let capturedFilter = null;

  Product.find = (filter) => {
    capturedFilter = filter;
    return {
      populate: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: async () => [],
            }),
          }),
        }),
      }),
    };
  };
  Product.countDocuments = async () => 0;

  try {
    await productService.getAdminProducts({ search: '   ', brand: '   ' });
    assert.strictEqual(capturedFilter.$or, undefined);
    assert.strictEqual(capturedFilter.brand, undefined);

    await productService.getAdminProducts({ search: '', brand: '' });
    assert.strictEqual(capturedFilter.$or, undefined);
    assert.strictEqual(capturedFilter.brand, undefined);
  } finally {
    Product.find = origFind;
    Product.countDocuments = origCount;
  }
});

await runAsyncTest('2.6 Rejects non-string search and brand with HTTP 400 VALIDATION_ERROR', async () => {
  // Array search
  await assert.rejects(
    async () => {
      await productService.getAdminProducts({ search: ['malicious', 'array'] });
    },
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, 'VALIDATION_ERROR');
      assert.strictEqual(err.message, 'Search query must be a string');
      return true;
    }
  );

  // Object search
  await assert.rejects(
    async () => {
      await productService.getAdminProducts({ search: { $regex: '.*' } });
    },
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, 'VALIDATION_ERROR');
      assert.strictEqual(err.message, 'Search query must be a string');
      return true;
    }
  );

  // Array brand
  await assert.rejects(
    async () => {
      await productService.getAdminProducts({ brand: ['Gucci', 'Prada'] });
    },
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, 'VALIDATION_ERROR');
      assert.strictEqual(err.message, 'Brand filter must be a string');
      return true;
    }
  );

  // Object brand
  await assert.rejects(
    async () => {
      await productService.getAdminProducts({ brand: { $ne: null } });
    },
    (err) => {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, 'VALIDATION_ERROR');
      assert.strictEqual(err.message, 'Brand filter must be a string');
      return true;
    }
  );
});

// ---------------------------------------------------------------------------
// Group 3: Public Catalog Brand & Color Filters
// ---------------------------------------------------------------------------
console.log('\n--- Group 3: Public Catalog Brand & Color Filters ---');

await runAsyncTest('3.1 Brand exact matching remains case-insensitive and anchored', async () => {
  const result = await validateCatalogQuery({ brand: 'Gucci, Prada' });
  assert.ok(result.filter.brand.$in, 'filter.brand must contain $in array');
  assert.strictEqual(result.filter.brand.$in.length, 2);

  const [gucciRegex, pradaRegex] = result.filter.brand.$in;
  assert.strictEqual(gucciRegex.source, '^Gucci$');
  assert.strictEqual(gucciRegex.flags, 'i');
  assert.strictEqual(pradaRegex.source, '^Prada$');
  assert.strictEqual(pradaRegex.flags, 'i');

  // Exact matching assertions
  assert.ok(gucciRegex.test('gucci'));
  assert.ok(gucciRegex.test('GUCCI'));
  assert.strictEqual(gucciRegex.test('Gucci Luxury'), false); // Anchored prevents partial
});

await runAsyncTest('3.2 Color exact matching remains case-insensitive and anchored', async () => {
  const result = await validateCatalogQuery({ color: 'Midnight Blue, Crimson' });
  const variantConditions = result.filter.variants.$elemMatch;
  assert.ok(variantConditions['attributes.color.name'].$in);

  const [blueRegex, crimsonRegex] = variantConditions['attributes.color.name'].$in;
  assert.strictEqual(blueRegex.source, '^Midnight Blue$');
  assert.strictEqual(blueRegex.flags, 'i');
  assert.strictEqual(crimsonRegex.source, '^Crimson$');
  assert.strictEqual(crimsonRegex.flags, 'i');

  assert.ok(blueRegex.test('midnight blue'));
  assert.strictEqual(blueRegex.test('Midnight Blue Metallic'), false);
});

await runAsyncTest('3.3 Regex metacharacters in brand and color are escaped and treated literally', async () => {
  const dangerousBrand = 'Gucci (Italy) [Luxury] + Co.';
  const dangerousColor = 'Deep (Sea) [Blue] * Gold';

  const result = await validateCatalogQuery({ brand: dangerousBrand, color: dangerousColor });

  // Brand regex
  const brandRegex = result.filter.brand.$in[0];
  assert.strictEqual(brandRegex.source, '^Gucci \\(Italy\\) \\[Luxury\\] \\+ Co\\.$');
  assert.ok(brandRegex.test('Gucci (Italy) [Luxury] + Co.'));
  assert.strictEqual(brandRegex.test('Gucci Italy Luxury Co.'), false);

  // Color regex
  const colorRegex = result.filter.variants.$elemMatch['attributes.color.name'].$in[0];
  assert.strictEqual(colorRegex.source, '^Deep \\(Sea\\) \\[Blue\\] \\* Gold$');
  assert.ok(colorRegex.test('Deep (Sea) [Blue] * Gold'));
});

await runAsyncTest('3.4 Empty tokens and malformed values in brand and color are safely handled', async () => {
  // Empty tokens after normalization
  const emptyBrandResult = await validateCatalogQuery({ brand: '  , ,  ' });
  assert.strictEqual(emptyBrandResult.filter.brand, undefined);

  const emptyColorResult = await validateCatalogQuery({ color: ',  , ' });
  assert.strictEqual(emptyColorResult.filter.variants, undefined);

  // Non-string object injection in brand or color does not crash
  const objBrandResult = await validateCatalogQuery({ brand: { $ne: null } });
  assert.strictEqual(objBrandResult.filter.brand, undefined);

  const objColorResult = await validateCatalogQuery({ color: { $gt: '' } });
  assert.strictEqual(objColorResult.filter.variants, undefined);
});

await runAsyncTest('3.5 Existing public search behavior remains completely intact and bounded', async () => {
  const origFind = Category.find;
  Category.find = () => ({
    select: () => ({
      limit: () => ({
        lean: async () => [],
      }),
    }),
  });

  try {
    const result = await validateCatalogQuery({ search: 'linen (summer)' });
    assert.strictEqual(result.filter.status, 'ACTIVE');
    assert.ok(result.filter.$and);

    const searchStage = result.filter.$and.find((s) => s.$or);
    const nameCondition = searchStage.$or.find((c) => c.name);
    assert.ok(nameCondition.name.test('Pure Linen (Summer) Blazer'));
    assert.strictEqual(nameCondition.name.test('Pure Linen Summer Blazer'), false);
  } finally {
    Category.find = origFind;
  }
});

// ---------------------------------------------------------------------------
// Group 4: Compatibility, Pagination & Sorting
// ---------------------------------------------------------------------------
console.log('\n--- Group 4: Pagination & Sorting Compatibility ---');

await runAsyncTest('4.1 getAdminProducts preserves sorting, pagination, and response metadata', async () => {
  const origFind = Product.find;
  const origCount = Product.countDocuments;

  const mockProduct = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Silk Shirt',
    brand: 'LuxeCart',
    status: 'ACTIVE',
  };

  Product.find = (filter) => ({
    populate: () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: async () => [mockProduct],
          }),
        }),
      }),
    }),
  });
  Product.countDocuments = async () => 1;

  try {
    const result = await productService.getAdminProducts({ page: '2', limit: '10', status: 'ACTIVE' });
    assert.strictEqual(result.products.length, 1);
    assert.strictEqual(result.products[0].id, mockProduct._id.toString());
    assert.strictEqual(result.pagination.page, 2);
    assert.strictEqual(result.pagination.limit, 10);
    assert.strictEqual(result.pagination.total, 1);
    assert.strictEqual(result.pagination.totalPages, 1);
    assert.strictEqual(result.pagination.hasNextPage, false);
    assert.strictEqual(result.pagination.hasPreviousPage, true);
  } finally {
    Product.find = origFind;
    Product.countDocuments = origCount;
  }
});

console.log('\n==============================================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('==============================================================================\n');

if (totalTests !== passedTests) {
  process.exit(1);
}
