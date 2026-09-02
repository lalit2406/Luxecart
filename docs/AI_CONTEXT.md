# LuxeCart — AI Context

**Document Version:** 1.0  
**Project:** LuxeCart  
**Primary AI Coding Partner:** Antigravity  
**Current Status:** Pre-development documentation phase

---

# 1. What Is LuxeCart?

LuxeCart is a **single-vendor fashion and lifestyle e-commerce platform focused on the Indian market**.

It is designed for a shop owner/business that sells products such as:

- Clothing.
- Footwear.
- Beauty products.
- Accessories.
- Other fashion/lifestyle products.

The platform has two primary experiences:

```text
Customer Storefront
        +
Admin Panel
```

The business owner is the single vendor/admin.

LuxeCart is intended to be a serious portfolio project that demonstrates real-world full-stack e-commerce engineering rather than a simple CRUD demo.

---

# 2. Core Business Model

```text
Single Vendor
      |
      v
Admin adds/manages products
      |
      v
Customers browse products
      |
      v
Cart
      |
      v
Checkout
      |
      v
Cash on Delivery
      |
      v
Order
      |
      v
Admin processes order
      |
      v
Customer tracks order
```

The initial market is **India only**.

The initial payment method is **Cash on Delivery (COD)**.

Online payments are future scope.

---

# 3. Technology Stack

## Frontend

```text
React
Vite
React Router
Tailwind CSS
TanStack Query
Zustand
Axios
React Hook Form
Zod
```

## Backend

```text
Node.js
Express.js
MongoDB
Mongoose
```

## External Services

Initial:

```text
MongoDB Atlas
Cloudinary
```

Future:

```text
Razorpay / Online Payment Gateway
Email
SMS
Shipping Provider
AI Services
Push Notifications
```

---

# 4. Architecture

Architecture style:

```text
MODULAR MONOLITH
```

High-level:

```text
Customer Storefront
        |
Admin Panel
        |
React Frontend
        |
REST API
        |
Node + Express
        |
Business Modules
        |
Services
        |
MongoDB
```

Do not introduce microservices unless there is a real requirement and the architecture is explicitly changed.

---

# 5. Backend Modules

Expected business modules include:

```text
auth
users
products
categories
cart
wishlist
addresses
orders
payments
inventory
reviews
coupons
promotions
notifications
analytics
imports
content
admin
```

Modules should have clear boundaries.

---

# 6. Product Architecture

Fashion products must support variants.

Example:

```text
Oversized T-Shirt

Black / S → SKU001
Black / M → SKU002
Black / L → SKU003
White / S → SKU004
White / M → SKU005
```

Important:

- Each sellable variant has a unique SKU.
- Inventory is variant-level.
- Price can be associated with the appropriate product/variant design.
- Orders preserve purchase-time product information.

Never assume every product has only one stock number.

---

# 7. Customer Features

Core customer functionality includes:

```text
Home
Shop
Categories
Search
Filters
Product Details
Product Variants
Wishlist
Cart
Addresses
Checkout
COD
Orders
Order Tracking
Reviews
Returns
Account
```

The customer experience must be responsive and mobile-friendly.

---

# 8. Admin Features

The admin panel should support:

```text
Dashboard
Products
Categories
Inventory
Orders
Customers
Coupons
Promotions
Reviews
Returns
CSV/XLSX Imports
Analytics
Content
Settings
```

The admin is the single store owner/vendor.

Admin APIs must always enforce server-side authorization.

---

# 9. Product Management

Admin should eventually be able to:

```text
Create Product
Edit Product
Archive Product
Manage Categories
Manage Variants
Manage SKU
Manage Stock
Upload Images
```

Product data should be manageable both:

```text
Manually
+
CSV/XLSX
```

Bulk imports must use:

```text
Upload
 ↓
Validate
 ↓
Parse
 ↓
Preview
 ↓
Confirm
 ↓
Import
 ↓
Report
```

Never insert raw spreadsheet data directly into production collections without validation.

---

# 10. Cart Rules

Authenticated users have a server-side cart.

Guest users may have a temporary client-side cart.

On login:

```text
Guest Cart
    ↓
Server Cart
    ↓
Merge
```

Backend remains the source of truth for:

- Price.
- Stock.
- Product availability.

---

# 11. Order Rules

Order creation is backend-controlled.

The server must recalculate:

```text
Product Price
+
Quantity
+
Discount
+
Coupon
+
Shipping
+
Tax where applicable
=
Final Total
```

Never trust a total sent by the frontend.

Orders must be protected against accidental duplicate creation.

Historical order data must remain accurate even if the product changes later.

---

# 12. Inventory Rules

Inventory is variant-level where variants exist.

Never allow stock below zero.

Critical inventory changes must be handled safely.

Use MongoDB transactions for appropriate multi-document critical workflows where supported.

---

# 13. Authentication

Authentication architecture:

```text
Short-lived Access Token
+
Refresh Token
+
Secure HTTP-only Cookies
```

Initial roles:

```text
CUSTOMER
ADMIN
```

Admin authorization must be enforced by backend middleware.

Never store plaintext passwords.

Never expose secrets to the frontend.

---

# 14. API Rules

API base:

```text
/api/v1/
```

REST style.

Example:

```text
GET    /api/v1/products
GET    /api/v1/products/:id
POST   /api/v1/products
PATCH  /api/v1/products/:id
DELETE /api/v1/products/:id
```

Standard successful response:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

Standard error response:

```json
{
  "success": false,
  "message": "Something went wrong",
  "error": {
    "code": "ERROR_CODE"
  }
}
```

---

# 15. Frontend State

Use:

```text
Zustand
→ UI/client state

TanStack Query
→ Server/API state
```

Do not put all server data into Zustand.

---

# 16. Visual Design

LuxeCart should feel:

```text
Premium
Modern
Clean
Fashion-forward
Sophisticated
Trustworthy
```

Design direction:

```text
Editorial Fashion
+
Modern Commerce
+
Subtle Technology
```

---

# 17. Visual System

Primary visual direction:

```text
Warm ivory background
White surfaces
Near-black text
Warm luxury brown accent
Deep espresso
Soft borders
Subtle shadows
```

Typography:

```text
Playfair Display
→ Major/editorial headings

Inter
→ Body/UI/interface
```

Icon system:

```text
Lucide React
```

Styling:

```text
Tailwind CSS
```

---

# 18. 3D Strategy

3D is an important portfolio differentiator but must be used strategically.

Preferred locations:

```text
Homepage
   ↓
Premium 3D hero

Selected Product Page
   ↓
Optional interactive 3D viewer
```

Potential technology:

```text
Three.js
React Three Fiber
React Three Drei
```

3D must be:

- Lazy-loaded.
- Optimized.
- Optional.
- Responsive.
- Accessible.
- Reduced-motion aware.
- Equipped with a static fallback.

Never make 3D required for basic shopping.

---

# 19. Performance Priority

Priority order:

```text
Fast Loading
      ↓
Product Visibility
      ↓
Interaction Responsiveness
      ↓
Visual Effects
      ↓
3D
```

Technology should enhance the shopping experience, not slow it down.

---

# 20. Security Priority

Always consider:

```text
Authentication
Authorization
Input Validation
CORS
Rate Limiting
Secure Cookies
Password Hashing
File Validation
Secret Management
Error Handling
```

Frontend security checks are never a substitute for backend authorization.

---

# 21. SEO

Public storefront should eventually support:

- SEO-friendly URLs.
- Dynamic metadata.
- Canonical URLs.
- Structured data.
- Breadcrumbs.
- Sitemap.
- Robots configuration.

---

# 22. Development Method

Build incrementally.

```text
One Phase
   ↓
One Task
   ↓
Implement
   ↓
Test
   ↓
Build
   ↓
Review
   ↓
Update Memory
   ↓
Next Task
```

Do not build the entire platform in one AI prompt.

---

# 23. Documentation Files

The `docs` directory contains:

```text
PRD.md
Architecture.md
Rules.md
Design.md
Phases.md
AI_CONTEXT.md
Memory.md
```

Purpose:

```text
PRD.md
→ What

Architecture.md
→ How

Rules.md
→ Constraints

Design.md
→ Visual/UX system

Phases.md
→ When

AI_CONTEXT.md
→ Short AI briefing

Memory.md
→ Current implementation state
```

---

# 24. Antigravity Operating Protocol

Before significant implementation:

```text
1. Read relevant documentation.
2. Read Memory.md if it exists.
3. Inspect the repository.
4. Identify the current phase.
5. Understand the exact task.
6. Plan before editing.
```

During implementation:

```text
Implement only the requested scope.
Follow architecture.
Follow rules.
Reuse existing code.
Avoid unrelated changes.
```

After implementation:

```text
Run tests.
Run build.
Inspect changed files.
Fix relevant errors.
Report verification results.
Update Memory.md.
```

---

# 25. Antigravity Must Not

Do not:

- Rewrite the entire application unnecessarily.
- Change frameworks without approval.
- Replace MongoDB without approval.
- Replace Zustand/TanStack Query without approval.
- Introduce microservices without approval.
- Add major dependencies without justification.
- Implement future phases prematurely.
- Delete working features to simplify code.
- Invent previous implementation progress.
- Claim untested code is complete.
- Hide known issues.
- Commit secrets.
- Use destructive Git commands without authorization.

---

# 26. Current Development State

Current state:

```text
Documentation Planning
```

Completed documentation:

```text
PRD.md
Architecture.md
Rules.md
Design.md
Phases.md
AI_CONTEXT.md
```

Application implementation:

```text
Not started yet
```

Therefore, do not assume that any application feature already exists.

---

# 27. Current Phase

When implementation begins:

```text
Phase 0 — Project Foundation
```

First objective:

```text
Create clean project foundation
+
Initialize frontend
+
Initialize backend
+
Configure development environment
+
Verify frontend/backend communication
```

Do not start authentication, products, payments or other future phases during Phase 0.

---

# 28. Current Immediate Task

The next implementation task will be:

```text
Phase 0 — Project Foundation
```

Before starting, ensure the documentation files are present and readable.

Then initialize the application according to:

```text
PRD.md
Architecture.md
Rules.md
Design.md
Phases.md
AI_CONTEXT.md
```

---

# 29. Communication Style for Antigravity

When reporting work, use:

```text
## Completed
- ...

## Files Changed
- ...

## Verification
- ...

## Known Issues
- ...

## Architecture Notes
- ...

## Next Task
- ...
```

Keep reports factual.

If something was not tested, explicitly say so.

---

# 30. Golden Rule

> **Do not optimize for generating the most code. Optimize for building the most reliable product.**

LuxeCart should become a project that can be:

```text
Built
Tested
Explained
Demonstrated
Deployed
Maintained
```

and confidently presented in a professional portfolio or technical interview.

---

## Document Status

**AI Context Version:** 1.0  
**Project:** LuxeCart  
**Primary AI Partner:** Antigravity  
**Current State:** Pre-development  
**Next Phase:** Phase 0 — Project Foundation
