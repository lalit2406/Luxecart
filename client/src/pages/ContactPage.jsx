import React from 'react';
import PolicyPageLayout from '../components/common/PolicyPageLayout';

export default function ContactPage() {
  const sections = [
    {
      heading: '1. Non-Commercial Portfolio Project',
      paragraphs: [
        'LuxeCart is a non-commercial ecommerce portfolio demonstration built to showcase ecommerce functionality and full-stack development. It does not operate as a commercial store and does not accept real purchases or provide real delivery services.',
        'All product listings, variant inventory counts, Indian Rupee prices, simulated Cash on Delivery checkout flows, and logistics milestones are software demonstration fixtures.',
      ],
    },
    {
      heading: '2. No Public Customer Support or Commercial Assistance',
      paragraphs: [
        'Because LuxeCart is not an operating retail business, no public customer support desk, commercial order fulfillment assistance, telephone helpline, or retail grievance service is offered.',
        'To respect personal privacy and avoid collecting unsolicited visitor data, LuxeCart intentionally does not publish a personal email address, phone number, residential street address, unverified social profile links, or a public guest contact form.',
      ],
    },
    {
      heading: '3. Authenticated Demo Support Portal (/support)',
      paragraphs: [
        'The application includes an internal ticket workflow at /support strictly as a technical demonstration feature for signed-in demo users reviewing order and support-desk UI capabilities.',
        'Both the /support page and the backend /api/v1/support/* endpoints require user authentication and are not open to unauthenticated public inquiries.',
      ],
    },
    {
      heading: '4. Policy & Disclosure Links',
      paragraphs: [
        'For additional clarity on how the demonstration storefront handles account data, simulated checkout terms, simulated shipping fees, and mock returns, please review the public Privacy Policy, Terms & Conditions, Shipping Policy, and Returns & Refunds Policy linked below.',
      ],
    },
  ];

  return (
    <PolicyPageLayout
      badgeLabel="Portfolio Disclosure"
      title="Project & Contact Information"
      breadcrumbLabel="Contact"
      seoTitle="Contact & Project Information — LuxeCart Portfolio Demo"
      description="Project and contact disclosure for LuxeCart, a non-commercial full-stack ecommerce portfolio demonstration with no commercial support or public contact form."
      canonicalPath="/contact"
      subtitle="Clear project background and contact transparency for visitors reviewing the LuxeCart portfolio demonstration."
      sections={sections}
    />
  );
}
