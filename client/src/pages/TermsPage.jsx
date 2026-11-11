import React from 'react';
import PolicyPageLayout from '../components/common/PolicyPageLayout';

export default function TermsPage() {
  const sections = [
    {
      heading: '1. Non-Commercial Portfolio Status',
      paragraphs: [
        'LuxeCart is presented solely as a full-stack software engineering portfolio demonstration. It is not an incorporated business, commercial marketplace, or authorized distributor of any retail brand.',
        'Nothing on this website constitutes a binding offer for sale, commercial warranty, or regulated consumer contract.',
      ],
    },
    {
      heading: '2. Simulated Orders & No Real Payments',
      paragraphs: [
        'Checkout in LuxeCart operates exclusively as a simulated Cash on Delivery demonstration flow:',
      ],
      bullets: [
        'No real payment gateway is connected and no monetary funds, card charges, UPI transfers, or cash settlements ever take place.',
        'Order confirmations, invoice summaries, delivery estimates, and tracking timelines represent simulated application state generated for software evaluation.',
        'Simulated orders do not create any obligation to dispatch or deliver physical goods.',
      ],
    },
    {
      heading: '3. Catalog Content & Pricing',
      paragraphs: [
        'All product titles, variant attributes, stock quantities, INR pricing displays, and promotional coupon codes are portfolio demonstration fixtures maintained to showcase catalog filtering, variant selection, and cart validation logic.',
      ],
    },
    {
      heading: '4. Responsible Use of Demo Features',
      paragraphs: [
        'When creating an account, testing checkout, posting product reviews, or opening tickets in the Support Desk (/support), please use sample or non-sensitive test details and refrain from submitting abusive content or automated stress traffic.',
        'All demonstration data and features may be modified, reset, or paused at any time without prior notice.',
      ],
    },
    {
      heading: '5. As-Is Software Disclaimer',
      paragraphs: [
        'This application is provided "as is" exclusively for technical inspection and portfolio review, without commercial warranties of availability, merchantability, or fitness for real-world retail operations.',
      ],
    },
  ];

  return (
    <PolicyPageLayout
      badgeLabel="Portfolio Terms"
      title="Terms & Conditions"
      seoTitle="Terms & Conditions — Portfolio Demo Disclosure"
      description="Terms of use for LuxeCart, a non-commercial ecommerce portfolio demonstration with simulated checkout, catalog data, and no real transactions."
      canonicalPath="/terms"
      subtitle="Usage terms and clear disclosures confirming that LuxeCart is a non-commercial portfolio showcase with simulated checkout and catalog records."
      sections={sections}
    />
  );
}
