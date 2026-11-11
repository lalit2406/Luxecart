import React from 'react';
import PolicyPageLayout from '../components/common/PolicyPageLayout';
import { useStoreSettings } from '../features/settings/context/useStoreSettings';

export default function ShippingPolicyPage() {
  let settings = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ctx = useStoreSettings();
    settings = ctx?.settings;
  } catch {
    settings = null;
  }

  const standardFeeRupees =
    typeof settings?.shipping?.standardFeeRupees === 'number' &&
    settings.shipping.standardFeeRupees >= 0
      ? settings.shipping.standardFeeRupees
      : 200;
  const enableFreeShippingThreshold = Boolean(
    settings?.shipping?.enableFreeShippingThreshold
  );
  const freeShippingThresholdRupees =
    typeof settings?.shipping?.freeShippingThresholdRupees === 'number'
      ? settings.shipping.freeShippingThresholdRupees
      : 5000;
  const minDays = settings?.shipping?.deliveryEstimateDays?.min || 3;
  const maxDays = settings?.shipping?.deliveryEstimateDays?.max || 7;

  const sections = [
    {
      heading: '1. Simulated Logistics & No Physical Dispatch',
      paragraphs: [
        'LuxeCart is a non-commercial ecommerce portfolio demonstration. No physical merchandise is stocked, packed, handed to third-party couriers, or delivered to real-world addresses.',
        'All shipping calculations, estimated arrival windows, and order tracking milestones exist solely to demonstrate full-stack ecommerce logistics state transitions.',
      ],
    },
    {
      heading: '2. Demo Shipping Rate Configuration',
      paragraphs: [
        'During simulated checkout, shipping charges are calculated dynamically from the store configuration:',
      ],
      bullets: [
        `Standard simulated delivery fee: ₹${standardFeeRupees} per demo order.`,
        enableFreeShippingThreshold
          ? `Free simulated delivery threshold: currently enabled for demo order subtotals of ₹${freeShippingThresholdRupees} or more.`
          : 'Free simulated delivery threshold: currently disabled in store settings, so the flat simulated fee applies to demo orders.',
        `Simulated delivery estimate window: ${minDays} to ${maxDays} days displayed as illustrative timing inside order summaries.`,
      ],
    },
    {
      heading: '3. Simulated Shipment Tracking',
      paragraphs: [
        'Once a simulated Cash on Delivery order is placed, signed-in users can view simulated shipment status updates and milestone history from My Orders (/orders). Admin order transitions update these tracking timelines purely inside the application database.',
      ],
    },
  ];

  return (
    <PolicyPageLayout
      badgeLabel="Simulated Logistics"
      title="Shipping Policy"
      seoTitle="Shipping Policy — Simulated Delivery Disclosure"
      description="Disclosure of LuxeCart's simulated shipping calculations, Indian Rupee display settings, and mock tracking workflow for portfolio demonstration."
      canonicalPath="/shipping-policy"
      subtitle="Clear explanation of how shipping fees, delivery estimates, and order tracking are simulated in the LuxeCart portfolio application."
      sections={sections}
    />
  );
}
