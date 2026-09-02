# LuxeCart — Development Phases

**Document Version:** 1.0  
**Project:** LuxeCart  
**Primary AI Coding Partner:** Antigravity  
**Development Strategy:** Incremental, testable, production-oriented  
**Initial Market:** India  
**Initial Payment:** COD  
**Status:** Implementation roadmap

---

# 1. Purpose

This document breaks LuxeCart into controlled development phases.

The project must not be built as one giant AI-generated task.

Each phase has:

- A clear objective.
- Scope.
- Dependencies.
- Deliverables.
- Acceptance criteria.
- Verification requirements.

Antigravity should work on one phase/task at a time.

---

# 2. Development Philosophy

The development process follows:

```text
Plan
  ↓
Implement
  ↓
Test
  ↓
Verify
  ↓
Document
  ↓
Move Forward
```

A phase is not complete simply because the code exists.

It is complete when its acceptance criteria are satisfied and the implementation has been verified.

---

# 3. Phase Dependency Map

```text
Phase 0
Foundation
   ↓
Phase 1
Backend + Database Foundation
   ↓
Phase 2
Authentication + Authorization
   ↓
Phase 3
Product Catalog + Categories
   ↓
Phase 4
Admin Product Management
   ↓
Phase 5
Storefront Discovery + Search + Filters
   ↓
Phase 6
Cart + Wishlist + Addresses
   ↓
Phase 7
Checkout + COD Orders
   ↓
Phase 8
Order Management + Tracking
   ↓
Phase 9
Reviews + Ratings
   ↓
Phase 10
Coupons + Promotions
   ↓
Phase 11
CSV/XLSX Bulk Import
   ↓
Phase 12
Returns + Customer Support
   ↓
Phase 13
Admin Analytics + Dashboard
   ↓
Phase 14
Content + Homepage Management
   ↓
Phase 15
3D Experience
   ↓
Phase 16
SEO + Performance + Accessibility
   ↓
Phase 17
Testing + Security Hardening
   ↓
Phase 18
Production Deployment
   ↓
Phase 19
Post-Launch Enhancements
```

Some phases may be developed in parallel only after their dependencies are stable.

---

# 4. Phase 0 — Project Foundation

## Objective

Create a clean repository and development environment.

## Scope

- Initialize Git.
- Create root project.
- Create `client`.
- Create `server`.
- Create `docs`.
- Configure basic npm scripts.
- Configure environment examples.
- Configure `.gitignore`.
- Initialize React/Vite frontend.
- Initialize Express backend.
- Establish basic project documentation.

## Deliverables

```text
LuxeCart/
├── client/
├── server/
├── docs/
├── .gitignore
├── README.md
└── package.json
```

## Acceptance Criteria

- Frontend starts successfully.
- Backend starts successfully.
- Frontend can communicate with backend.
- Environment variables are not committed.
- Repository is initialized.
- Documentation files are present.

## Verification

```text
Frontend development server
Backend development server
Frontend → Backend test request
Production frontend build
```

---

# 5. Phase 1 — Backend & Database Foundation

## Objective

Create the backend foundation and MongoDB connection.

## Scope

- Express application.
- MongoDB connection.
- Mongoose configuration.
- API versioning.
- Global error handler.
- Standard API response format.
- Health check.
- Basic middleware.
- Environment configuration.
- Database connection handling.

## Initial endpoint

```text
GET /api/v1/health
```

## Acceptance Criteria

- Server starts without errors.
- MongoDB connection works.
- Health endpoint works.
- API response format is consistent.
- Errors are handled centrally.
- Secrets are environment-based.

---

# 6. Phase 2 — Authentication & Authorization

## Objective

Implement secure customer/admin authentication.

## Scope

### Customer

- Registration.
- Login.
- Logout.
- Current user.
- Access token.
- Refresh token.
- Secure HTTP-only cookies.
- Password hashing.
- Protected routes.

### Account

- Profile.
- Password change.
- Forgot password architecture.
- Reset password architecture.

### Admin

- Admin role.
- Admin authorization middleware.
- Protected admin APIs.

## Acceptance Criteria

- Customer can register.
- Customer can log in.
- Customer can log out.
- Access token expires appropriately.
- Refresh flow works.
- Unauthorized API requests are rejected.
- Customers cannot access admin APIs.
- Admin can access authorized admin APIs.
- Passwords are never stored in plaintext.

---

# 7. Phase 3 — Product Catalog & Categories

## Objective

Create the product and category foundation.

## Scope

### Categories

- Category CRUD.
- Subcategories.
- Slugs.
- Active/inactive status.

### Products

- Product model.
- Product CRUD API.
- Product slug.
- Product images.
- Product description.
- Brand.
- Gender.
- Tags.
- Pricing.
- Variants.
- SKU.
- Variant stock.
- Product status.

## Example

```text
Oversized T-Shirt
├── Black / S → SKU001
├── Black / M → SKU002
├── Black / L → SKU003
├── White / S → SKU004
└── White / M → SKU005
```

## Acceptance Criteria

- Admin/API can create products.
- Product variants work.
- SKUs are unique.
- Categories work.
- Product listing API works.
- Product detail API works.
- Product slug works.
- Invalid product data is rejected.

---

# 8. Phase 4 — Admin Product Management

## Objective

Create the operational admin interface for catalog management.

## Scope

- Admin dashboard shell.
- Product list.
- Product creation form.
- Product editing.
- Product archive/delete workflow.
- Variant management.
- SKU management.
- Stock management.
- Image upload.
- Category management.
- Search.
- Filtering.
- Pagination.

## Acceptance Criteria

Admin can:

```text
Create Product
Edit Product
Manage Variants
Upload Images
Manage Stock
Change Status
Search Products
Filter Products
```

All operations must use authenticated admin APIs.

---

# 9. Phase 5 — Storefront Discovery

## Objective

Build the customer shopping experience.

## Scope

### Homepage

- Hero.
- Featured products.
- Categories.
- New arrivals.
- Bestsellers.
- Promotional sections.

### Catalog

- Shop page.
- Category pages.
- Product grid.
- Product cards.
- Product detail page.
- Related products.

### Search

- Search input.
- Suggestions.
- Search results.
- Debouncing.

### Filters

- Category.
- Price.
- Brand.
- Rating.
- Discount.
- Size.
- Color.
- Availability.
- Category-specific attributes.

## Acceptance Criteria

Customer can:

```text
Open Store
    ↓
Browse Categories
    ↓
Search
    ↓
Filter
    ↓
Open Product
    ↓
Select Variant
```

---

# 10. Phase 6 — Cart, Wishlist & Addresses

## Objective

Create the customer's shopping preparation layer.

## Scope

### Cart

- Add item.
- Remove item.
- Change quantity.
- Variant-aware cart.
- Cart totals.
- Guest cart.
- Guest → customer cart merge.

### Wishlist

- Add.
- Remove.
- List.
- Move to cart.

### Addresses

- Add.
- Edit.
- Delete.
- Select default.
- Select checkout address.

## Acceptance Criteria

- Cart works for authenticated users.
- Guest cart works.
- Cart merge works after login.
- Stock limitations are respected.
- Wishlist works.
- Address management works.

---

# 11. Phase 7 — Checkout & COD Orders

## Objective

Implement the complete initial purchase flow using COD.

## Scope

```text
Cart
 ↓
Address
 ↓
Delivery
 ↓
Payment
 ↓
Order Review
 ↓
Place Order
```

Payment:

```text
Cash on Delivery
```

## Backend responsibilities

- Revalidate products.
- Revalidate variants.
- Revalidate stock.
- Recalculate prices.
- Validate coupon if available.
- Calculate shipping.
- Calculate final amount.
- Create order.
- Update inventory.
- Clear/adjust cart.
- Prevent duplicate orders.

## Acceptance Criteria

A customer can:

```text
Add Product
 ↓
Open Cart
 ↓
Select Address
 ↓
Choose COD
 ↓
Review Order
 ↓
Place Order
 ↓
Receive Order Confirmation
```

The final total must be calculated by the backend.

---

# 12. Phase 8 — Order Management & Tracking

## Objective

Build customer and admin order workflows.

## Customer

- Order history.
- Order detail.
- Status.
- Tracking timeline.
- Cancel order where eligible.

## Admin

- Order list.
- Order details.
- Search.
- Filters.
- Status updates.
- Customer information.
- Order item information.

## Suggested order lifecycle

```text
PLACED
 ↓
CONFIRMED
 ↓
PACKED
 ↓
SHIPPED
 ↓
OUT_FOR_DELIVERY
 ↓
DELIVERED
```

Alternative states:

```text
CANCELLED
RETURN_REQUESTED
RETURNED
```

## Acceptance Criteria

- Customer sees order history.
- Customer sees order status.
- Admin can manage orders.
- Status transitions are controlled.
- Inventory changes remain consistent.

---

# 13. Phase 9 — Reviews & Ratings

## Objective

Add trustworthy product feedback.

## Scope

- Product rating.
- Written review.
- Verified purchase.
- Review moderation.
- Admin review management.
- Rating summary.
- Review images where supported.

## Acceptance Criteria

- Only eligible customers can submit verified reviews.
- Review data is validated.
- Admin can moderate reviews.
- Product rating aggregates correctly.

---

# 14. Phase 10 — Coupons & Promotions

## Objective

Create promotional commerce capabilities.

## Coupon types

Potential examples:

```text
Percentage discount
Fixed amount
Minimum order discount
Category discount
Product discount
User-specific coupon
Usage-limited coupon
```

## Scope

- Coupon CRUD.
- Validation.
- Usage limits.
- User limits.
- Start/end date.
- Eligibility.
- Admin management.
- Promotional banners where appropriate.

## Acceptance Criteria

- Invalid coupons are rejected.
- Expired coupons are rejected.
- Usage limits work.
- Discount is calculated server-side.
- Customers see clear coupon feedback.

---

# 15. Phase 11 — CSV/XLSX Bulk Product Import

## Objective

Allow the single-store admin to efficiently upload product catalogs.

## Supported formats

```text
CSV
XLSX
```

## Flow

```text
Upload
 ↓
File Validation
 ↓
Parse
 ↓
Row Validation
 ↓
Business Validation
 ↓
Preview
 ↓
Admin Confirmation
 ↓
Import
 ↓
Import Report
```

## Validation

Detect:

- Missing product name.
- Invalid category.
- Duplicate SKU.
- Invalid price.
- Invalid stock.
- Invalid variant.
- Invalid required fields.

## Acceptance Criteria

- Admin can upload CSV/XLSX.
- Invalid files are rejected.
- Row-level errors are shown.
- Preview is available.
- Admin explicitly confirms import.
- Valid records are imported.
- Import summary is generated.

---

# 16. Phase 12 — Returns & Customer Support

## Objective

Create post-purchase support workflows.

## Scope

### Returns

- Return request.
- Return reason.
- Eligibility rules.
- Admin review.
- Approve/reject.
- Inventory restoration where applicable.
- Return status.

### Support

- Contact/support form.
- Order-related support.
- Customer messages where required.

## Acceptance Criteria

- Customer can request eligible returns.
- Admin can review requests.
- Status transitions are controlled.
- Relevant inventory changes are handled safely.

---

# 17. Phase 13 — Admin Analytics & Dashboard

## Objective

Give the shop owner useful business insights.

## Dashboard metrics

- Revenue.
- Orders.
- Customers.
- Average order value.
- Best-selling products.
- Top categories.
- Low-stock products.
- Order status distribution.

## Charts

Potential:

```text
Revenue over time
Orders over time
Category performance
Top products
Customer growth
```

## Acceptance Criteria

- Metrics reflect database data.
- Date filters work.
- Queries remain efficient.
- Admin-only access is enforced.

---

# 18. Phase 14 — Content & Homepage Management

## Objective

Allow the shop owner to manage storefront content without editing code.

## Scope

- Hero banners.
- Promotional banners.
- Featured collections.
- Homepage sections.
- Announcement bar.
- Basic store settings.

## Acceptance Criteria

Admin can:

```text
Create
Edit
Activate
Deactivate
Reorder
```

supported homepage content.

---

# 19. Phase 15 — 3D Experience

## Objective

Introduce a premium, portfolio-worthy 3D experience without hurting performance.

## Stage 1 — 3D Hero

Implement a selected 3D fashion/lifestyle scene.

Potential:

```text
Floating sneaker
Handbag
Watch
Accessory
Fashion object
```

The scene should be visually premium and brand-consistent.

## Stage 2 — Optional Product 3D

Allow selected products to have a 3D model.

```text
Product Gallery
├── Image
├── Image
└── 3D Viewer
```

## Technology

Potential:

```text
Three.js
React Three Fiber
React Three Drei
```

Only introduce these dependencies during this phase.

## Acceptance Criteria

- 3D loads lazily.
- Static fallback exists.
- Mobile experience remains usable.
- Reduced-motion preference is respected.
- 3D does not block core shopping.
- Large assets are optimized.
- Product page remains functional without WebGL.

---

# 20. Phase 16 — SEO, Performance & Accessibility

## Objective

Prepare LuxeCart for search visibility and strong user experience.

## SEO

- Metadata.
- Product metadata.
- Canonical URLs.
- Structured data.
- Sitemap.
- Robots.
- Breadcrumbs.
- SEO-friendly slugs.

## Performance

- Code splitting.
- Lazy loading.
- Image optimization.
- Query caching.
- Database indexing.
- API pagination.
- Remove unnecessary requests.

## Accessibility

- Keyboard navigation.
- Focus states.
- Semantic HTML.
- Accessible forms.
- Alt text.
- Reduced motion.
- Appropriate contrast.

## Acceptance Criteria

- Core pages have correct metadata.
- Images are optimized.
- Major routes load efficiently.
- Keyboard navigation works.
- Major forms are accessible.
- No obvious accessibility blockers remain.

---

# 21. Phase 17 — Testing & Security Hardening

## Objective

Perform a systematic quality pass.

## Testing

### Unit

- Services.
- Business rules.
- Utilities.

### Integration

- Auth.
- Products.
- Cart.
- Orders.
- Inventory.
- Coupons.
- Admin APIs.

### End-to-End

Complete customer journey:

```text
Register
 ↓
Login
 ↓
Browse
 ↓
Search
 ↓
Product
 ↓
Add to Cart
 ↓
Checkout
 ↓
COD
 ↓
Place Order
 ↓
Order Tracking
```

Admin journey:

```text
Login
 ↓
Create Product
 ↓
Manage Inventory
 ↓
View Order
 ↓
Update Status
 ↓
View Analytics
```

## Security review

Check:

- Authentication.
- Authorization.
- Cookies.
- CORS.
- Rate limiting.
- Validation.
- File uploads.
- Secrets.
- Error leakage.
- Admin permissions.
- Injection risks.

---

# 22. Phase 18 — Production Deployment

## Objective

Deploy the first production-ready version.

Target:

```text
Frontend → Vercel
Backend  → Render
Database → MongoDB Atlas
Images   → Cloudinary
```

## Deployment checklist

```text
Environment variables
CORS
Production URLs
Database connection
Cloudinary
Build
API health
Authentication
Cookies
HTTPS
Error handling
Logs
```

## Acceptance Criteria

- Production frontend loads.
- Production backend responds.
- Database works.
- Authentication works.
- Product browsing works.
- COD checkout works.
- Admin works.
- Images work.
- No secrets are exposed.

---

# 23. Phase 19 — Post-Launch Enhancements

These features are intentionally after the core product is stable.

Potential features:

- Online payments.
- Razorpay integration.
- Email notifications.
- SMS notifications.
- Push notifications.
- Shipping provider integration.
- Redis caching.
- Dedicated search engine.
- AI shopping assistant.
- AI recommendations.
- Product comparison.
- Loyalty program.
- PWA.
- Advanced analytics.
- Multi-language support.
- Multi-currency support if the market expands.

Do not start these features before the core platform is stable unless explicitly prioritized.

---

# 24. Phase Completion Protocol

At the end of each phase:

```text
Implementation
     ↓
Run Tests
     ↓
Run Build
     ↓
Manual Verification
     ↓
Review Changes
     ↓
Update Memory.md
     ↓
Record Known Issues
     ↓
Mark Phase Complete
```

Antigravity must report:

```text
Completed
Files Changed
Tests Run
Build Result
Known Issues
Next Recommended Task
```

---

# 25. Phase Scope Rule

If a task belongs to a future phase, do not implement it early unless it is a direct dependency.

Example:

If implementing authentication requires a user model, create the user model.

But do not build the complete customer profile system during authentication unless required.

---

# 26. MVP Boundary

The first meaningful MVP should reach approximately:

```text
Phase 0
Phase 1
Phase 2
Phase 3
Phase 4
Phase 5
Phase 6
Phase 7
Phase 8
```

This provides:

```text
Authentication
+
Admin
+
Products
+
Catalog
+
Search
+
Cart
+
Wishlist
+
Checkout
+
COD
+
Orders
+
Tracking
```

This is the minimum version that should feel like a real single-vendor e-commerce platform.

---

# 27. Portfolio Enhancement Boundary

After the MVP works correctly:

```text
Phase 9
Reviews
 ↓
Phase 10
Coupons
 ↓
Phase 11
CSV/XLSX
 ↓
Phase 13
Analytics
 ↓
Phase 15
3D
 ↓
Phase 16
SEO/Performance
```

These features significantly strengthen the project for a resume and portfolio because they demonstrate more than basic CRUD.

---

# 28. Recommended Antigravity Working Sequence

Do not give Antigravity all phases at once.

Start with:

```text
Task 1
Phase 0 — Project Foundation
```

After verification:

```text
Task 2
Phase 1 — Backend & Database Foundation
```

Then:

```text
Task 3
Phase 2 — Authentication
```

Continue sequentially.

Each task should reference:

```text
PRD.md
Architecture.md
Rules.md
Design.md
Phases.md
AI_CONTEXT.md
Memory.md
```

---

# 29. Suggested First Implementation Prompt

When we are ready to begin coding, use:

```text
We are building LuxeCart, a single-vendor fashion and lifestyle
e-commerce platform for the Indian market.

You are the primary AI coding partner.

Before changing anything:

1. Read:
   - docs/PRD.md
   - docs/Architecture.md
   - docs/Rules.md
   - docs/Design.md
   - docs/Phases.md
   - docs/AI_CONTEXT.md if it exists
   - docs/Memory.md if it exists

2. Inspect the existing repository.

3. Do not implement future phases.

4. Do not change the approved architecture without explaining
   the reason and receiving approval.

Current task:
Phase 0 — Project Foundation.

Implement only the foundation required for Phase 0.

After implementation:
- Run the appropriate development/build checks.
- Verify frontend/backend communication.
- Report files created/changed.
- Report verification results.
- Report known issues.
- Update docs/Memory.md with the current project state.
```

---

# 30. Definition of Complete Project

LuxeCart is considered initially production-ready when:

```text
Core functionality works
        +
Admin works
        +
Customer journey works
        +
COD orders work
        +
Inventory is reliable
        +
Security review passes
        +
Testing is sufficient
        +
SEO is implemented
        +
Performance is acceptable
        +
Responsive UI works
        +
Deployment works
```

Additional future features are not required for the initial production release.

---

# 31. Final Development Principle

> **Do not optimize for the number of features. Optimize for the quality of the complete experience.**

The goal is not:

```text
"Look how many features AI generated."
```

The goal is:

```text
"Here is a complete e-commerce product
I designed, architected, built, tested,
deployed and can explain."
```

That is the standard LuxeCart should aim for.

---

## Document Status

**Phases Version:** 1.0  
**Project:** LuxeCart  
**Primary AI Partner:** Antigravity  
**Status:** Development roadmap defined  
**Next Documentation:** `AI_CONTEXT.md`
