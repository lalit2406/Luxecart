import React from 'react';
import PolicyPageLayout from '../components/common/PolicyPageLayout';
import { useStoreSettings } from '../features/settings/context/useStoreSettings';

export default function ReturnsPolicyPage() {
  let settings = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ctx = useStoreSettings();
    settings = ctx?.settings;
  } catch {
    settings = null;
  }

  const isReturnsEnabled = settings?.returns?.isReturnsEnabled !== false;
  const returnWindowDays = settings?.returns?.returnWindowDays || 7;

  const sections = [
    {
      heading: '1. Simulated Returns — No Real Financial Refunds',
      paragraphs: [
        'Because LuxeCart is a non-commercial portfolio demonstration and all Cash on Delivery orders are simulated without monetary payments or physical shipments, no real product returns, courier pickups, or financial refunds take place.',
      ],
    },
    {
      heading: '2. Current Demo Return Workflow Settings',
      paragraphs: [
        isReturnsEnabled
          ? `The portfolio application currently demonstrates an interactive post-delivery return request flow configured for a ${returnWindowDays}-day simulated window inside the order history portal.`
          : 'Simulated return requests are currently paused in store settings.',
      ],
      bullets: [
        'Eligibility showcase: return request creation is gated in software against simulated delivered order timestamps and the configured return window.',
        'Workflow states: simulated return tickets, pickup scheduling steps, inspection outcomes, and mock refund statuses are tracked exclusively as demonstration database records.',
        'No real monetary settlement occurs at any stage of the return lifecycle.',
      ],
    },
    {
      heading: '3. Demo Order Questions',
      paragraphs: [
        'Signed-in users testing order or return workflows can submit demonstration tickets through the authenticated Support Desk (/support).',
      ],
    },
  ];

  return (
    <PolicyPageLayout
      badgeLabel="Simulated Returns"
      title="Returns & Refunds Policy"
      seoTitle="Returns & Refunds Policy — Simulated Workflow Disclosure"
      description="Explanation of LuxeCart's simulated return request and mock refund status workflow for non-commercial portfolio demonstration."
      canonicalPath="/returns-policy"
      subtitle="How simulated post-delivery return requests and mock refund statuses work inside the LuxeCart portfolio project."
      sections={sections}
    />
  );
}
