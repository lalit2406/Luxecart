# LuxeCart Project Memory

## Current Phase
Phase 18 — Production Deployment (Status: IN PROGRESS)
- **Step 1 — Production Deployment Architecture & Environment Preparation**: COMPLETE (Configuration audit, environment variable inventory, secret safety check, dependency graph, client build verified with 0 errors)
- **Admin Panel Runtime Stabilization & UX/Navigation**: COMPLETE (Fixed `AdminProductsPage` `UploadCloud` import, `AdminCategoriesPage` category array unwrapping, unified all 15 admin pages into `AdminLayout`, collapsible sidebar with localStorage persistence, mobile drawer with Escape key support, dynamic breadcrumbs, contextual back navigation, tooltips, `AdminErrorBoundary` wrapper, 51/51 automated tests passed, build 0 errors).
- **Step 2 — Database & Cloud Infrastructure Provisioning**: PENDING
- **Step 3 — Backend Deployment (Render) & Health Verification**: PENDING
- **Step 4 — Frontend Deployment (Vercel) & Production Smoke Testing**: PENDING

## Completed Phases
- **Phase 17 — Testing & Security Hardening**: COMPLETE (Steps 1–4)
  - **Step 1**: Security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, CSP), recursive NoSQL operator sanitizer, global & auth rate limiters.
  - **Step 2**: 49/49 domain unit verification tests across coupon math, order & return state machines, snapshot immutability, integer paise arithmetic.
  - **Step 3**: 71/71 end-to-end integration tests across complete customer & admin workflows (registration, browse, wishlist, cart, address, COD checkout, order lifecycle, COD payment sync, verified review, return restock, support).
  - **Step 4**: 75/75 master multi-phase regression tests across all 17 phases, zero-defect audit, client production build passed in 22.45s with 0 errors.
- **Phase 16 — SEO, Performance & Accessibility**: COMPLETE (Steps 1–3)
  - **Step 1**: Dynamic SEO manager (`SEO.jsx`), Schema.org Product/Breadcrumb/WebSite JSON-LD, `robots.txt`, dynamic XML sitemap endpoint (`/seo/sitemap.xml`).
  - **Step 2**: Route-level code splitting (`React.lazy`), `Suspense` boundary with `PageLoader`, image loading optimization (`loading="lazy"`, `decoding="async"`, `loading="eager"` on hero LCP), 80.7% main JS bundle reduction.
  - **Step 3**: `SkipToContent`, landmark semantics (`<main id="main-content">`, `<nav aria-label="...">`, `<aside aria-label="...">`, `<header>`, `<footer>`), form semantics (`<label htmlFor>`, `<input id>`, `aria-required`, `aria-invalid`, `role="alert"`), data table `scope="col"` headers, accessible names on icon-only controls.
- **Phase 15 — 3D Experience**: COMPLETE (Steps 1–3)
  - **Step 1 — Foundation, Dependencies & Hero 3D Experience**: COMPLETE (Three.js, React Three Fiber, Drei, WebGL detection, reduced-motion hook, isolated vendor chunk, LuxuryHeroCanvas).
  - **Step 2 — 3D Product Viewer & Product Detail Page Integration**: COMPLETE (Product3DViewer component with Drei useGLTF & OrbitControls, static poster fallback, dynamic 2D/3D gallery switcher on PDP, lazy loading, Admin create/edit 3D metadata controls, model3d validation with HTTPS protocol enforcement, 39/39 verification assertions passed, 0 build errors).
  - **Step 3 — Performance Optimization, Mobile Touch Hardening & Final Verification**: COMPLETE (Three-vendor bundle isolation at 1,183.38 kB gzip 329.64 kB, main JS 119.97 kB, scoped touch-pan-y on Hero and PDP viewers, reduced-motion frame-stopping, WebGL detection & static photography fallback, Drei caching, 45/45 master verification assertions passed, client build 0 errors).
- **Phase 14 — Content & Homepage Management**: COMPLETE (Steps 1–3)
  - Content model, backend CMS API, Admin CMS management interface, public dynamic homepage rendering.
- **Phase 13 — Admin Analytics & Business Dashboard**: COMPLETE (Steps 1–5)
  - Backend analytics foundation, executive dashboard UI, product & category performance, customer & order cohorts, inventory surveillance.
- **Phase 12 — Returns & Customer Support**: COMPLETE (Steps 1–8)
  - Return model, number generator, state machine, customer returns, admin approval/rejection, pickup logistics, physical inspection & restocking, refund settlement, support ticketing domain.

## Completed
- **Coupon Model & Persistence** (`server/src/modules/coupons/coupon.model.js`):
  - Fields: `code` (uppercase, unique index), `description`, `discountType` (`'PERCENTAGE' | 'FIXED'`), `discountValue` (integer paise or 1-100%), `minOrderValue` (paise), `maxDiscountAmount` (paise), `startDate`, `expirationDate`, `totalUsageLimit`, `usedCount`, `perUserLimit`, `eligibleCategories`, `eligibleProducts`, `isActive`.
  - Compound indexes: `{ isActive: 1, expirationDate: 1, startDate: 1 }`.
- **Coupon Validation Layer** (`server/src/validators/coupon.validator.js`):
  - `validateCreateCoupon`, `validateUpdateCoupon`, `validateCustomerValidateCoupon`, `validateAdminCouponQuery`, `validateToggleCouponStatus`.
  - Strict rejection of client-supplied injection fields (`usedCount`, `userId`, `discountAmount`, `pricing`, `subtotal`, `grandTotal`).
- **Coupon Domain Service & Dynamic Calculations** (`server/src/modules/coupons/coupon.service.js`):
  - `validateAndCalculateCoupon`: Evaluates status, date range, total usage limit, per-user order history limit, category/product eligibility filters, and applies percentage/fixed calculations bounded by eligible subtotal and max discount cap.
  - `reserveCouponUsage`: Atomically increments `usedCount` with concurrency protection (`usedCount < totalUsageLimit`).
  - `rollbackCouponUsage`: Atomically decrements `usedCount` upon order cancellation.
  - Admin CRUD: `createCoupon`, `getAdminCoupons`, `getCouponById`, `updateCoupon`, `toggleCouponStatus`, `deleteCoupon`.
- **Checkout & Order Integration** (`server/src/modules/checkout/checkout.service.js`, `server/src/modules/orders/order.service.js`, `server/src/modules/orders/order.model.js`):
  - `CheckoutService.prepareCheckout` revalidates live catalog and evaluates coupon code server-side.
  - `OrderService.placeCodOrder` accepts `couponCode`, reserves usage atomically, records immutable coupon snapshot (`coupon: { code, discountType, discountValue, discountAmount }`), and records `pricing.couponDiscount`.
  - `OrderService.updateOrderStatus` automatically rolls back coupon usage on `ORDER_STATUS.CANCELLED`.
- **Frontend Components & Integration** (`client/src/components/coupons/`, `client/src/pages/CartPage.jsx`, `client/src/pages/CheckoutPage.jsx`, `client/src/pages/admin/AdminCouponsPage.jsx`):
  - `CouponInput.jsx`: Promo code input, apply/remove button, live discount banner, accessible error feedback.
  - `CartPage.jsx`: Integrated coupon entry and bag summary savings recalculation.
  - `CheckoutPage.jsx`: Integrated coupon entry in price details sidebar and order creation.
  - `AdminCouponsPage.jsx`: Full admin portal with KPI cards, search, status filter tabs, coupon creation/edit modal, and toggle switches.
  - `AdminLayout.jsx` & `App.jsx`: Mounted `/admin/coupons` route and sidebar navigation.

## Files Created / Modified Across Phase 10
- `server/src/modules/coupons/coupon.model.js` (NEW)
- `server/src/validators/coupon.validator.js` (NEW)
- `server/src/modules/coupons/coupon.service.js` (NEW)
- `server/src/modules/coupons/coupon.controller.js` (NEW)
- `server/src/modules/coupons/coupon.routes.js` (NEW)
- `server/src/modules/coupons/adminCoupon.controller.js` (NEW)
- `server/src/modules/coupons/adminCoupon.routes.js` (NEW)
- `server/src/routes/api.routes.js` (MODIFIED)
- `server/src/validators/checkout.validator.js` (MODIFIED)
- `server/src/validators/order.validator.js` (MODIFIED)
- `server/src/modules/checkout/checkout.service.js` (MODIFIED)
- `server/src/modules/orders/order.model.js` (MODIFIED)
- `server/src/modules/orders/order.service.js` (MODIFIED)
- `client/src/features/coupons/api/couponApi.js` (NEW)
- `client/src/features/admin/coupons/api/adminCouponApi.js` (NEW)
- `client/src/features/checkout/api/checkoutApi.js` (MODIFIED)
- `client/src/features/checkout/context/CheckoutContext.jsx` (MODIFIED)
- `client/src/features/orders/api/orderApi.js` (MODIFIED)
- `client/src/components/coupons/CouponInput.jsx` (NEW)
- `client/src/pages/CartPage.jsx` (MODIFIED)
- `client/src/pages/CheckoutPage.jsx` (MODIFIED)
- `client/src/pages/admin/AdminCouponsPage.jsx` (NEW)
- `client/src/layouts/AdminLayout.jsx` (MODIFIED)
- `client/src/App.jsx` (MODIFIED)
- `docs/Memory.md` (MODIFIED)

## Security Invariants
- Admin endpoints strictly enforce `authenticate` and `requireRole('ADMIN')`.
- All monetary discounts and limits are authoritatively calculated server-side in integer paise.
- Client attempts to supply `usedCount`, `userId`, `discountAmount`, `pricing`, or arbitrary totals are rejected.
- Per-user limit is derived from non-cancelled customer `Order` documents.
- Atomic MongoDB compare-and-swap guarantees `usedCount <= totalUsageLimit` under concurrent checkout requests.
- Cancellation state machine guarantees coupon usage is rolled back at most once.

## Tests & Build Results
- Phase 10 Automated Verification Suite (`verify_phase10.js`): **47/47 tests passed**.
- Client Production Build (`npm.cmd run build` inside `client/`): **PASSED with 0 errors** in 18.58s (`dist/assets/index-Q1v6AFQI.js` 641.42 kB │ gzip: 160.10 kB).

## Known Issues
- None.

## Next Phase
- Phase 12 — Returns & Refunds (Phase 11 Bulk Import is already complete in Phase 5C).
