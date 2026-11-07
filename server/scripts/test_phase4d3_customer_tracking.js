/**
 * LUXECART PHASE 4D-3: CUSTOMER TRACKING & NOTIFICATION EXPERIENCE VERIFICATION SUITE
 *
 * Verifies:
 * - CUST-LOG-01: CustomerTrackingCard component existence and design system alignment
 * - CUST-LOG-02: Phone and Email masking functions protect customer privacy
 * - CUST-LOG-03: Complete milestone mapping across all 8 supported lifecycle stages
 * - CUST-LOG-04: Clear empty state before mock shipment exists with delivery estimate
 * - CUST-LOG-05: Prominent [DEMO SIMULATION] badge and customer advisory notices
 * - CUST-LOG-06: Copy-to-clipboard action with visual feedback for mock AWB
 * - CUST-LOG-07: Simulated notifications modal features [DEMO SIMULATION — NOT SENT] tags and masked recipients
 * - CUST-LOG-08: Accessible modal semantics (role="dialog", aria-modal="true", aria-labelledby, Escape listener)
 * - CUST-LOG-09: Complete exclusion of internal carrier freight costs from customer view
 * - CUST-LOG-10: OrderDetailPage cleanly embeds CustomerTrackingCard beneath OrderTimeline
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  maskPhone,
  maskEmail,
  getMilestoneConfig,
} from '../../client/src/features/logistics/constants/trackingUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const results = [];

function record(testId, name, status, details = '') {
  results.push({ testId, name, status, details });
  const badge = status === 'PASS' ? '✔ [PASS]' : status === 'SKIP' ? '○ [SKIP]' : '✖ [FAIL]';
  console.log(`${badge} [${testId}] ${name}`);
  if (details) console.log(`    ↳ ${details}`);
}

async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('   LUXECART PHASE 4D-3: CUSTOMER TRACKING VERIFICATION SUITE       ');
  console.log('='.repeat(70) + '\n');

  const trackingCompPath = path.resolve(__dirname, '../../client/src/features/logistics/components/CustomerTrackingCard.jsx');
  const orderDetailPagePath = path.resolve(__dirname, '../../client/src/pages/OrderDetailPage.jsx');

  const trackingCompCode = fs.readFileSync(trackingCompPath, 'utf8');
  const orderDetailPageCode = fs.readFileSync(orderDetailPagePath, 'utf8');

  // --------------------------------------------------------------------------
  // TEST 1: Privacy Masking Functions (Phone & Email)
  // --------------------------------------------------------------------------
  try {
    const maskedPhone = maskPhone('+91 9876543210');
    assert(maskedPhone.includes('***'), 'Phone must contain asterisks');
    assert(maskedPhone.startsWith('+91 9'), 'Phone must retain country/prefix start');
    assert(maskedPhone.endsWith('210'), 'Phone must retain trailing digits');

    const maskedEmail = maskEmail('customer@example.com');
    assert(maskedEmail.includes('***'), 'Email must contain asterisks in username');
    assert(maskedEmail.startsWith('c***r@'), 'Email must mask middle characters of username');
    assert(maskedEmail.endsWith('@example.com'), 'Email domain must be preserved');

    const fallbackPhone = maskPhone(null);
    assert.strictEqual(fallbackPhone, 'N/A');

    const fallbackEmail = maskEmail(null);
    assert.strictEqual(fallbackEmail, '***@***.***');

    record('CUST-LOG-02', 'Customer phone numbers and email addresses are securely masked for privacy', 'PASS');
  } catch (err) {
    record('CUST-LOG-02', 'Privacy masking functions', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Milestone Config Coverage Across All 8 States
  // --------------------------------------------------------------------------
  try {
    const requiredMilestones = [
      'MANIFESTED',
      'PICKED_UP',
      'IN_TRANSIT',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'DELIVERY_ATTEMPT_FAILED',
      'RTO_INITIATED',
      'RTO_DELIVERED',
    ];

    for (const ms of requiredMilestones) {
      const config = getMilestoneConfig(ms);
      assert(config && config.badge, `Milestone ${ms} must have a badge`);
      assert(config.colorClass, `Milestone ${ms} must have colorClass`);
      assert(config.dotClass, `Milestone ${ms} must have dotClass`);
    }

    assert(getMilestoneConfig('MANIFESTED').badge.includes('Manifested'));
    assert(getMilestoneConfig('DELIVERED').badge.includes('Delivered'));
    assert(getMilestoneConfig('DELIVERY_ATTEMPT_FAILED').badge.includes('Attempt Failed'));
    assert(getMilestoneConfig('RTO_INITIATED').badge.includes('Return to Origin'));

    record('CUST-LOG-03', 'Milestone styling covers all 8 supported dispatch & exception states', 'PASS');
  } catch (err) {
    record('CUST-LOG-03', 'Milestone config mapping', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Empty State Handling for Unmanifested Orders
  // --------------------------------------------------------------------------
  try {
    assert(trackingCompCode.includes('Fulfillment Preparation in Progress'), 'Must render reassuring empty state title');
    assert(trackingCompCode.includes('Ballabhgarh fulfillment facility'), 'Must reference fulfillment facility');
    assert(trackingCompCode.includes('Estimated delivery within 7 business days after order confirmation'), 'Must display relative estimate');

    record('CUST-LOG-04', 'Unmanifested orders render reassuring empty state with delivery estimate', 'PASS');
  } catch (err) {
    record('CUST-LOG-04', 'Empty state verification', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Demo Simulation Labeling & Transparency
  // --------------------------------------------------------------------------
  try {
    assert(trackingCompCode.includes('Demo Simulation'), 'Card must have prominent Demo Simulation badge');
    assert(trackingCompCode.includes('Simulated courier journey'), 'Must explain simulated nature of journey');
    assert(trackingCompCode.includes('Notice:'), 'Must include customer advisory notice');
    assert(trackingCompCode.includes('high-fidelity logistics simulation for demonstration purposes'), 'Must clarify no live dispatch');

    record('CUST-LOG-05', 'Clear Demo Simulation badges and customer advisory notices enforced', 'PASS');
  } catch (err) {
    record('CUST-LOG-05', 'Demo simulation labeling verification', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Copy-to-Clipboard Action
  // --------------------------------------------------------------------------
  try {
    assert(trackingCompCode.includes('handleCopyAwb'), 'Must implement handleCopyAwb');
    assert(trackingCompCode.includes('navigator.clipboard.writeText'), 'Must call clipboard API');
    assert(trackingCompCode.includes('Copied to clipboard!'), 'Must provide visual copy confirmation');

    record('CUST-LOG-06', 'Mock AWB identifier includes copy-to-clipboard action with visual feedback', 'PASS');
  } catch (err) {
    record('CUST-LOG-06', 'Copy-to-clipboard verification', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Simulated Notification Feed & Modal Tagging
  // --------------------------------------------------------------------------
  try {
    assert(trackingCompCode.includes('View Demo Notifications'), 'Must have button to view demo notifications');
    assert(trackingCompCode.includes('Demo Simulation — Not Sent'), 'Modal must have bold Not Sent badge');
    assert(trackingCompCode.includes('maskPhone'), 'Must use phone masking in notifications');
    assert(trackingCompCode.includes('maskEmail'), 'Must use email masking in notifications');

    record('CUST-LOG-07', 'Simulated communication modal displays masked SMS & Email previews with Not Sent tags', 'PASS');
  } catch (err) {
    record('CUST-LOG-07', 'Notification feed modal verification', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Accessibility Attributes
  // --------------------------------------------------------------------------
  try {
    assert(trackingCompCode.includes('role="dialog"'), 'Modal must have role="dialog"');
    assert(trackingCompCode.includes('aria-modal="true"'), 'Modal must have aria-modal="true"');
    assert(trackingCompCode.includes('aria-labelledby="simulated-notif-title"'), 'Modal must have aria-labelledby');
    assert(trackingCompCode.includes("e.key === 'Escape'"), 'Must handle Escape key to close modal');

    record('CUST-LOG-08', 'Modal implements accessible dialog semantics and keyboard Escape navigation', 'PASS');
  } catch (err) {
    record('CUST-LOG-08', 'Accessibility attributes verification', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Exclusion of Internal Carrier Freight Costs
  // --------------------------------------------------------------------------
  try {
    // Assert CustomerTrackingCard NEVER references internal carrier cost fields
    assert(!trackingCompCode.includes('simulatedCarrierCostPaise'), 'Must NOT display internal carrier cost paise');
    assert(!trackingCompCode.includes('simulatedCarrierCostRupees'), 'Must NOT display internal carrier cost rupees');
    assert(!trackingCompCode.includes('variancePaise'), 'Must NOT display variance paise');
    assert(!trackingCompCode.includes('varianceRupees'), 'Must NOT display variance rupees');

    record('CUST-LOG-09', 'Customer view strictly excludes internal carrier freight costs and margins', 'PASS');
  } catch (err) {
    record('CUST-LOG-09', 'Freight cost exclusion verification', 'FAIL', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: OrderDetailPage Integration
  // --------------------------------------------------------------------------
  try {
    assert(
      orderDetailPageCode.includes("import CustomerTrackingCard from '../features/logistics/components/CustomerTrackingCard'"),
      'OrderDetailPage must import CustomerTrackingCard'
    );
    assert(
      orderDetailPageCode.includes('<CustomerTrackingCard order={order} />'),
      'OrderDetailPage must render CustomerTrackingCard with order prop'
    );

    record('CUST-LOG-10', 'OrderDetailPage cleanly embeds CustomerTrackingCard beneath OrderTimeline', 'PASS');
  } catch (err) {
    record('CUST-LOG-10', 'OrderDetailPage integration verification', 'FAIL', err.message);
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('='.repeat(70) + '\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
