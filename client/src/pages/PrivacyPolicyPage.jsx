import React from 'react';
import PolicyPageLayout from '../components/common/PolicyPageLayout';

export default function PrivacyPolicyPage() {
  const sections = [
    {
      heading: '1. Portfolio Demonstration Scope',
      paragraphs: [
        'LuxeCart is a non-commercial full-stack ecommerce portfolio demonstration project, not a registered or operating retail business. No real products are sold, no commercial transactions occur, and no personal support email, phone line, or physical office address is published.',
        'Visitors browsing the public catalog are encouraged to treat all checkout, order, and logistics workflows strictly as software demonstrations and avoid entering sensitive personal, government ID, or real financial information.',
      ],
    },
    {
      heading: '2. Information Processed When You Test Account Features',
      paragraphs: [
        'Browsing the homepage, product catalog, and product pages does not require logging in. If you voluntarily register an account or test authenticated features, the application stores the following demonstration records in its MongoDB database:',
      ],
      bullets: [
        'Account credentials: your submitted name, email address, optional phone number, and a bcrypt-hashed password (plaintext passwords are never stored). If you choose Google Sign-In, the backend verifies your Google ID token via google-auth-library and stores your name, email, and profile avatar URL.',
        'Session & security records: hashed refresh tokens (up to five active sessions) and password reset token hashes when password recovery is requested.',
        'Simulated ecommerce records: saved shipping addresses, shopping cart and wishlist selections, simulated Cash on Delivery orders, simulated return requests, submitted product reviews, and support tickets created through the authenticated Support Desk.',
        'Payment information: Cash on Delivery is the sole simulated checkout flow. LuxeCart does not collect, process, or store credit cards, debit cards, UPI IDs, bank details, or online payment credentials.',
      ],
    },
    {
      heading: '3. Cookies, Browser Storage & Analytics',
      paragraphs: [
        'LuxeCart uses HTTP-only JWT cookies (accessToken and refreshToken, with cross-site Secure / SameSite=None attributes in hosted deployments) and Authorization Bearer headers solely to maintain signed-in sessions and protect authenticated endpoints.',
        'The storefront AnnouncementBar also uses browser sessionStorage (luxecart:announcement:v1:dismissed) so dismissing the banner lasts for your current browser tab session. No third-party advertising networks, marketing pixels, or analytics tracking scripts are installed.',
      ],
    },
    {
      heading: '4. Hosting & Technical Service Providers',
      paragraphs: [
        'As a live full-stack web portfolio deployment, LuxeCart relies on third-party infrastructure providers strictly to serve and run the demo application:',
      ],
      bullets: [
        'Frontend & backend application hosting: Vercel (frontend SPA hosting) and Render (Node.js / Express API hosting).',
        'Database & media delivery: MongoDB Atlas for application data storage and Cloudinary for serving product imagery.',
        'Optional identity, typography & email APIs: Google Identity Services (accounts.google.com) for optional Google Sign-In, Google Fonts for storefront typography, and Resend for password-reset email delivery when an API key is configured.',
      ],
    },
    {
      heading: '5. Data Retention & Limitations',
      paragraphs: [
        'Automated scheduled deletion or periodic purging of test accounts and demo order records is not currently implemented in the application codebase.',
        'Signed-in demo users can manage saved shipping addresses and review/support submissions from their account pages. Because LuxeCart is a non-commercial portfolio project without a dedicated privacy officer mailbox, please test only with non-sensitive sample data and use the in-app Support Desk (/support) for demo-related inquiries.',
      ],
    },
  ];

  return (
    <PolicyPageLayout
      badgeLabel="Portfolio Transparency"
      title="Privacy Policy"
      seoTitle="Privacy Policy — Portfolio Data Disclosure"
      description="Transparent disclosure of how LuxeCart, a non-commercial ecommerce portfolio demonstration, handles demo account data, cookies, and third-party hosting."
      canonicalPath="/privacy-policy"
      subtitle="An honest explanation of how data, authentication cookies, and third-party infrastructure are used in the LuxeCart portfolio demonstration."
      sections={sections}
    />
  );
}
