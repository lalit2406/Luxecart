# LuxeCart — Architecture Document

**Document Version:** 1.1  
**Project:** LuxeCart  
**Architecture Style:** Modular Monolith  
**Frontend:** React + Vite  
**Backend:** Node.js + Express.js  
**Database:** MongoDB + Mongoose  
**Initial Payment:** Cash on Delivery (COD)  
**Authentication:** Short-lived access token + refresh token using secure HTTP-only cookies  
**Primary AI Coding Partner:** Antigravity

---

# 1. Purpose of This Document

This document defines how LuxeCart should be technically designed and implemented.

It is the technical source of truth for:

- Application architecture.
- Technology choices.
- Module boundaries.
- Data flow.
- Authentication.
- API design.
- Database design principles.
- Frontend structure.
- Backend structure.
- External integrations.
- Security and performance architecture.
- AI-assisted implementation rules at an architectural level.

The Product Requirements Document (`PRD.md`) defines **what LuxeCart must do**.

This document defines **how LuxeCart should be built**.

`Rules.md` will define the detailed coding and AI-agent constraints.

---

# 2. AI Coding Partner

LuxeCart will be developed with **Antigravity as the primary AI coding partner**.

Antigravity is an implementation partner, not the owner of product or architecture decisions.

## Antigravity responsibilities

Antigravity may:

- Implement features defined in the documentation.
- Create and modify application code.
- Create tests.
- Refactor code when required.
- Identify bugs.
- Suggest improvements.
- Explain implementation decisions.
- Update documentation when instructed.
- Maintain `Memory.md` after implementation begins.

## Antigravity must not independently:

- Redefine product requirements.
- Replace the approved architecture.
- Change the primary technology stack without approval.
- Introduce major dependencies without justification.
- Remove required features.
- Rewrite unrelated working modules.
- Implement multiple unrelated phases simultaneously.
- Invent APIs or external services without documenting the decision.

If an implementation requirement conflicts with the existing architecture, Antigravity should identify the conflict and request/record an architectural decision rather than silently changing the architecture.

---

# 3. Documentation Hierarchy

The project documentation follows this hierarchy:

```text
PRD.md
  |
  | Defines WHAT
  v
Architecture.md
  |
  | Defines HOW
  v
Rules.md
  |
  | Defines CONSTRAINTS
  v
Design.md
  |
  | Defines VISUAL/UX SYSTEM
  v
Phases.md
  |
  | Defines WHEN
  v
Implementation
  |
  v
Memory.md
  |
  | Defines CURRENT STATE
  v
Next implementation task
```

When documents conflict:

1. Explicit user/project decisions take priority.
2. `PRD.md` controls product requirements.
3. `Architecture.md` controls technical architecture.
4. `Rules.md` controls implementation constraints.
5. `Design.md` controls visual/UX decisions.
6. `Phases.md` controls implementation sequencing.
7. `Memory.md` records current implementation state and must not silently override the other source documents.

If a conflict is discovered, it should be surfaced rather than hidden.

---

# 4. Architecture Goals

LuxeCart must be:

- Modular.
- Maintainable.
- Secure.
- Scalable.
- Testable.
- Responsive.
- SEO-friendly.
- Suitable for production deployment.
- Easy for developers and AI coding agents to understand.
- Easy to extend without unnecessary rewrites.

The architecture should avoid premature complexity while maintaining strong separation of concerns.

---

# 5. High-Level Architecture

```text
                         LUXECART
                            |
             +--------------+--------------+
             |                             |
       Customer Storefront             Admin Panel
             |                             |
             +--------------+--------------+
                            |
                     React Frontend
                            |
                        REST API
                            |
                    Node.js + Express
                            |
             +--------------+--------------+
             |              |              |
          Modules        Services      Middleware
             |              |              |
             +--------------+--------------+
                            |
                       MongoDB Atlas
                            |
             +--------------+--------------+
             |                             |
         Cloudinary                 External Services
                                      (Future)
```

LuxeCart will use a **modular monolith** rather than microservices for the initial product.

---

# 6. Technology Stack

## Frontend

- React
- Vite
- React Router
- Tailwind CSS
- TanStack Query
- Zustand
- Axios
- React Hook Form
- Zod

## Backend

- Node.js
- Express.js
- MongoDB
- Mongoose

## Initial External Services

- MongoDB Atlas.
- Cloudinary.

## Future External Services

- Razorpay/payment gateway.
- Email provider.
- SMS provider.
- Shipping/logistics provider.
- AI provider.
- Push notification provider.

External integrations should be isolated behind service modules where practical.

---

# 7. Repository Structure

The repository should follow:

```text
LuxeCart/
│
├── client/
│   ├── public/
│   └── src/
│
├── server/
│   ├── src/
│   └── tests/
│
├── docs/
│   ├── PRD.md
│   ├── Architecture.md
│   ├── Rules.md
│   ├── Design.md
│   ├── Phases.md
│   ├── AI_CONTEXT.md
│   └── Memory.md
│
├── .gitignore
├── README.md
└── package.json
```

`Memory.md` should be created when implementation begins.

`AI_CONTEXT.md` is a concise briefing for AI coding agents and will be created before serious AI-assisted implementation begins.

---

# 8. Architecture Style — Modular Monolith

The backend will remain one deployable application but will be internally divided into business modules.

```text
server/
└── src/
    └── modules/
        ├── auth/
        ├── users/
        ├── products/
        ├── categories/
        ├── cart/
        ├── wishlist/
        ├── addresses/
        ├── orders/
        ├── payments/
        ├── inventory/
        ├── reviews/
        ├── coupons/
        ├── promotions/
        ├── notifications/
        ├── analytics/
        ├── imports/
        ├── content/
        └── admin/
```

A module should own its related business logic as much as practical.

Microservices are intentionally not part of the initial architecture.

---

# 9. Frontend Architecture

Recommended frontend structure:

```text
client/
└── src/
    ├── app/
    ├── assets/
    ├── components/
    ├── constants/
    ├── features/
    ├── hooks/
    ├── layouts/
    ├── lib/
    ├── pages/
    ├── routes/
    ├── schemas/
    ├── services/
    ├── store/
    ├── utils/
    ├── App.jsx
    └── main.jsx
```

The exact structure may evolve as implementation progresses, but changes should be intentional and documented when they materially affect architecture.

---

# 10. Frontend Feature Structure

Business functionality should be grouped into feature modules.

```text
features/
├── auth/
├── products/
├── categories/
├── cart/
├── wishlist/
├── checkout/
├── orders/
├── reviews/
├── coupons/
├── notifications/
└── admin/
```

A feature may contain:

```text
products/
├── components/
├── hooks/
├── api/
├── schemas/
├── utils/
└── types/
```

Feature modules should not duplicate shared business logic.

---

# 11. Customer and Admin Frontend

The same React application will initially provide both experiences.

## Customer routes

```text
/
/shop
/category/:slug
/product/:slug
/cart
/wishlist
/checkout
/orders
/orders/:id
/account
/account/addresses
/account/reviews
/account/returns
```

## Admin routes

```text
/admin
/admin/dashboard
/admin/products
/admin/products/new
/admin/products/:id
/admin/categories
/admin/inventory
/admin/orders
/admin/orders/:id
/admin/customers
/admin/coupons
/admin/promotions
/admin/reviews
/admin/returns
/admin/analytics
/admin/content
/admin/imports
/admin/settings
```

Separate layouts:

```text
CustomerLayout
AdminLayout
```

Admin routes must be protected by authentication and role authorization.

---

# 12. State Management

LuxeCart will use two complementary approaches.

## Zustand

Use Zustand for client/UI state such as:

- UI preferences.
- Modal state.
- Mobile navigation.
- Temporary client state.
- Guest cart state where appropriate.
- Other lightweight local/global state.

Zustand must not become a replacement for server-state management.

## TanStack Query

Use TanStack Query for server state:

- Products.
- Categories.
- User data.
- Cart data.
- Wishlist.
- Orders.
- Reviews.
- Admin data.
- Analytics.
- Notifications.

Responsibilities:

- Fetching.
- Caching.
- Refetching.
- Loading state.
- Error state.
- Mutation state.
- Cache invalidation.

---

# 13. HTTP Client

Axios will be the primary HTTP client.

A centralized API client should handle:

- Base URL.
- Credentials.
- Common headers.
- Authentication-related behavior.
- Error normalization where appropriate.

Individual features should not create unrelated Axios configurations.

---

# 14. Backend Folder Structure

Recommended structure:

```text
server/
└── src/
    ├── config/
    ├── middlewares/
    ├── modules/
    ├── routes/
    ├── services/
    ├── utils/
    ├── validators/
    ├── constants/
    ├── app.js
    └── server.js
```

The modules folder contains business-domain logic.

---

# 15. Backend Module Structure

A typical module:

```text
modules/
└── products/
    ├── product.model.js
    ├── product.controller.js
    ├── product.service.js
    ├── product.repository.js
    ├── product.routes.js
    ├── product.validation.js
    ├── product.constants.js
    └── product.utils.js
```

Not every module must contain every file.

Files should be added only when they have a clear responsibility.

---

# 16. Backend Request Flow

Standard request flow:

```text
HTTP Request
     |
     v
Route
     |
     v
Middleware
     |
     v
Validation
     |
     v
Controller
     |
     v
Service
     |
     v
Repository / Model
     |
     v
MongoDB
```

Response:

```text
MongoDB
   |
Repository
   |
Service
   |
Controller
   |
HTTP Response
```

---

# 17. Controller Responsibility

Controllers should:

- Read request data.
- Call the appropriate service.
- Return HTTP responses.
- Pass errors to centralized error handling.

Controllers should not contain large business workflows.

Business logic belongs primarily in services.

---

# 18. Service Layer

Services contain business logic.

Examples:

```text
ProductService
CartService
OrderService
InventoryService
CouponService
ReviewService
NotificationService
PaymentService
```

Critical business rules must not be implemented only in React components.

---

# 19. Repository Layer

Repositories handle database-access logic when a separate data-access abstraction provides value.

Examples:

```text
ProductRepository
OrderRepository
InventoryRepository
UserRepository
```

The repository layer should reduce duplicated database queries.

Direct model use inside a service is acceptable for simple operations when it remains clean and consistent.

---

# 20. API Architecture

LuxeCart will use versioned REST APIs:

```text
/api/v1/
```

Major resources:

```text
/api/v1/auth
/api/v1/users
/api/v1/products
/api/v1/categories
/api/v1/cart
/api/v1/wishlist
/api/v1/addresses
/api/v1/orders
/api/v1/payments
/api/v1/inventory
/api/v1/reviews
/api/v1/coupons
/api/v1/promotions
/api/v1/notifications
/api/v1/analytics
/api/v1/imports
/api/v1/content
/api/v1/admin
```

---

# 21. Authentication Architecture

Authentication will use:

- Short-lived access token.
- Refresh token.
- Secure HTTP-only cookies.
- Password hashing.
- Role-based authorization.

High-level flow:

```text
Login
  |
Verify credentials
  |
Create access token
  |
Create refresh token
  |
Set secure HTTP-only cookies
  |
Authenticated requests
```

Exact expiration, rotation, cookie names and environment-specific security settings will be defined during implementation.

---

# 22. Refresh Token Flow

When the access token expires:

```text
API Request
    |
Expired access token
    |
Refresh endpoint
    |
Validate refresh token
    |
Issue new access token
    |
Retry request
```

Refresh tokens must be handled securely according to `Rules.md`.

---

# 23. Authorization

Initial roles:

```text
CUSTOMER
ADMIN
```

Authorization middleware verifies the authenticated user's role before allowing admin operations.

```text
Request
  |
Authentication
  |
Authorization
  |
ADMIN?
  |
Yes → Continue
No  → Forbidden
```

---

# 24. Database Architecture

MongoDB will be the primary database.

Core collections/entities:

```text
users
products
categories
carts
wishlists
addresses
orders
reviews
coupons
promotions
notifications
inventory
auditLogs
banners/content
```

The exact schema definitions will be finalized before the relevant implementation phase.

---

# 25. User Model

A user should contain information such as:

```text
_id
name
email
phone
passwordHash
role
status
profile
createdAt
updatedAt
```

Sensitive authentication information must not be exposed through ordinary customer APIs.

---

# 26. Product Model

A product should contain information such as:

```text
_id
name
slug
brand
description
category
subcategory
images
tags
gender
attributes
variants
pricing
seo
status
createdAt
updatedAt
```

The exact schema will be refined based on product variants and category-specific attributes.

---

# 27. Product Variant Architecture

Variants are essential for fashion products.

```text
Product
 |
 +-- Black / S
 |     SKU
 |     Stock
 |     Price
 |
 +-- Black / M
 |     SKU
 |     Stock
 |     Price
 |
 +-- White / M
       SKU
       Stock
       Price
```

Each sellable variant must have a unique SKU.

Variant-level inventory is required.

---

# 28. Historical Order Data

Orders must remain historically accurate even if the product later changes.

When an order is created, relevant purchase-time information should be preserved:

- Product name.
- SKU.
- Variant.
- Quantity.
- Unit price.
- Discount.
- Tax information where applicable.
- Other required snapshot information.

Historical orders must not depend entirely on the current product document.

---

# 29. Inventory Architecture

Inventory operates at variant level.

Conceptual flow:

```text
Available Stock
      |
Order validation
      |
Stock reservation/deduction
      |
Order processing
      |
+----------------------+
|                      |
Delivered          Cancelled/Returned
|                      |
Finalize          Restore if eligible
```

The exact reservation/deduction strategy will be finalized during order implementation.

---

# 30. Order Architecture

Order creation must be backend-controlled.

Flow:

```text
Cart
 |
Validate customer
 |
Validate address
 |
Validate products
 |
Validate variants
 |
Validate stock
 |
Calculate current prices
 |
Validate coupon
 |
Calculate shipping
 |
Calculate final total
 |
Create order
 |
Update inventory
 |
Clear/adjust cart
 |
Create notification
 |
Return confirmation
```

Critical workflows must be protected against duplicate requests and partial updates.

---

# 31. Database Transactions

MongoDB transactions should be used where multiple related database changes must succeed or fail together and the deployment environment supports them.

Potential transactional workflows:

- Order creation + inventory update.
- Return processing + inventory restoration where appropriate.
- Other critical multi-document operations.

Transactions should not be used unnecessarily for simple reads.

---

# 32. Cart Architecture

Authenticated users have a server-side cart.

Guest users may have a temporary client-side cart.

When a guest logs in:

```text
Guest Cart
    |
Login
    |
Fetch Server Cart
    |
Merge according to cart rules
    |
Server Cart
```

The backend remains the source of truth for availability and final pricing.

---

# 33. Wishlist Architecture

Wishlist belongs to the customer account.

Operations:

- Add.
- Remove.
- List.
- Move to Cart.

Wishlist data should reference products/variants appropriately without duplicating complete product documents.

---

# 34. Coupon Architecture

Coupon validation must occur on the backend.

Flow:

```text
Coupon Code
    |
Find Coupon
    |
Check Active
    |
Check Dates
    |
Check Usage
    |
Check User Eligibility
    |
Check Cart Conditions
    |
Calculate Discount
```

The client must never be trusted to determine coupon validity or discount amount.

---

# 35. Review Architecture

Reviews should reference:

- User.
- Product.
- Order/order item where needed.
- Rating.
- Review text.
- Images.
- Verification status.

Verified purchase status must be determined server-side.

---

# 36. Returns Architecture

Return requests should reference:

- Order.
- Order item.
- Customer.
- Reason.
- Status.
- Requested timestamp.
- Admin decision.
- Refund information where applicable.

Return status should follow controlled transitions.

---

# 37. Payment Architecture

Initial payment method:

```text
COD
```

Payment module:

```text
payments/
├── payment.service.js
├── payment.controller.js
├── payment.routes.js
└── providers/
    └── cod.provider.js
```

Future:

```text
providers/
├── cod.provider.js
└── razorpay.provider.js
```

Online payments should be added through the payment layer without redesigning the core order system.

---

# 38. Image Architecture

Product and promotional images should not be stored as large binary objects inside MongoDB.

Flow:

```text
Admin
  |
Upload
  |
Cloudinary
  |
Image URL / metadata
  |
MongoDB
```

The application should use optimized image URLs and responsive image strategies.

---

# 39. CSV/XLSX Import Architecture

Bulk product import should be isolated in an import module.

Flow:

```text
Admin
  |
Upload CSV/XLSX
  |
File validation
  |
Parser
  |
Schema validation
  |
Business validation
  |
Preview
  |
Admin confirmation
  |
Database write
  |
Import report
```

Import must identify:

- Missing fields.
- Invalid values.
- Duplicate SKUs.
- Invalid categories.
- Invalid variants.
- Invalid prices.
- Invalid stock.

Large imports should be designed so background processing can be introduced later if required.

---

# 40. Search Architecture

Initial search can use MongoDB-supported text/index strategies appropriate to the selected deployment.

Search should support:

- Product name.
- Brand.
- Category.
- SKU.
- Tags.

The architecture should allow future migration to a dedicated search engine if catalog size or search complexity justifies it.

---

# 41. Filtering Architecture

Product filtering should use indexed fields where practical.

Potential filters:

- Category.
- Price.
- Brand.
- Rating.
- Discount.
- Availability.
- Size.
- Color.
- Material.
- Fit.
- Category-specific attributes.

The backend must construct safe and validated queries from filter parameters.

---

# 42. Pincode & Delivery Architecture

Initial delivery logic can be configurable.

```text
Pincode
   |
Delivery Rules
   |
Available?
   |
Estimated delivery range
```

Future delivery-provider integration should be isolated from core order logic.

---

# 43. Notification Architecture

Notifications should be represented as a reusable module.

Initial:

```text
In-App Notification
```

Future channels:

```text
Email
SMS
Push
```

Example:

```text
OrderService
     |
NotificationService
     |
+----+----+----+
|    |    |    |
In-app Email SMS Push
```

---

# 44. Analytics Architecture

Analytics should derive business metrics from reliable order, product and customer data.

Initial metrics:

- Revenue.
- Orders.
- Average order value.
- Customers.
- Best-selling products.
- Category performance.
- Order status.
- Customer growth.

Analytics queries should avoid unnecessarily loading large datasets into application memory.

---

# 45. Audit Log Architecture

Important admin actions should create audit records.

Example:

```text
Actor
Action
Resource
Resource ID
Previous Value
New Value
Timestamp
Metadata
```

Audit logs should be append-oriented and protected from ordinary customer access.

---

# 46. Error Handling Architecture

A centralized error-handling middleware should normalize API errors.

```text
Error
 |
Service
 |
Controller
 |
Global Error Middleware
 |
Standard API Response
```

Example:

```json
{
  "success": false,
  "message": "Product not found",
  "error": {
    "code": "PRODUCT_NOT_FOUND"
  }
}
```

Sensitive internal details must not be exposed in production responses.

---

# 47. Validation Architecture

Validation should occur at multiple levels.

```text
Frontend validation
        |
        v
Backend request validation
        |
        v
Business validation
        |
        v
Database constraints
```

Frontend validation improves user experience.

Backend validation protects the application.

Database constraints provide an additional integrity layer.

---

# 48. Security Middleware

The backend should include appropriate security middleware for:

- CORS.
- Security headers.
- Rate limiting.
- Request validation.
- Authentication.
- Authorization.
- Input sanitization where appropriate.

Security configuration must be environment-aware.

---

# 49. API Response Standard

Successful response:

```json
{
  "success": true,
  "message": "Product fetched successfully",
  "data": {}
}
```

Error response:

```json
{
  "success": false,
  "message": "Product not found",
  "error": {
    "code": "PRODUCT_NOT_FOUND"
  }
}
```

Paginated response:

```json
{
  "success": true,
  "message": "Products fetched successfully",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

The final API response contract should remain consistent.

---

# 50. Environment Configuration

Secrets and environment-specific configuration must be stored outside source code.

Examples:

```text
MONGODB_URI
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLIENT_URL
```

No secret should be committed to Git.

Separate environment configurations may be used for:

- Development.
- Testing.
- Production.

---

# 51. API Versioning

All application APIs should initially use:

```text
/api/v1/
```

Breaking changes should use a new API version rather than silently changing the existing contract.

---

# 52. Caching Strategy

Caching should be introduced only where it provides measurable value.

Potential cache candidates:

- Product catalog queries.
- Categories.
- Popular products.
- Store configuration.
- Static/reference data.

Initial implementation may rely primarily on TanStack Query client caching and database indexes.

Redis can be introduced later if justified.

---

# 53. Performance Architecture

Frontend:

- Code splitting.
- Lazy-loaded routes.
- Optimized images.
- Debounced search.
- Query caching.
- Skeleton loading.

Backend:

- Pagination.
- Efficient queries.
- Database indexes.
- Projection of required fields.
- Avoid unnecessary database calls.

Database:

- Index frequently queried fields.
- Avoid unbounded queries.
- Analyze expensive queries during optimization.

---

# 54. SEO Architecture

Public storefront pages should support:

- SEO-friendly URLs.
- Dynamic metadata.
- Canonical URLs.
- Structured data.
- Breadcrumbs.
- Sitemap.
- Robots.txt.

Product pages should expose appropriate structured product information.

---

# 55. Responsive Architecture

The frontend must be responsive rather than maintaining separate desktop and mobile applications.

Responsive design rules will be defined in `Design.md`.

---

# 56. Testing Architecture

Testing should occur at multiple levels.

## Unit

- Utility functions.
- Business rules.
- Services.

## Integration

- API endpoints.
- Database workflows.
- Authentication.
- Authorization.
- Orders.

## End-to-End

Critical workflow:

```text
Register/Login
    |
Browse
    |
Product
    |
Add to Cart
    |
Checkout
    |
COD Order
    |
Admin Order
    |
Status Update
    |
Customer Tracking
```

---

# 57. Deployment Architecture

Initial target architecture:

```text
                  Internet
                     |
          +----------+----------+
          |                     |
          v                     v
       Vercel                 Render
     Frontend                Backend
          |                     |
          +----------+----------+
                     |
                     v
                MongoDB Atlas
                     |
                 Cloudinary
```

Hosting providers can change later without changing the application architecture.

---

# 58. Observability

The production application should eventually support:

- Structured server logs.
- Error logging.
- Request logging where appropriate.
- Health checks.
- Basic performance monitoring.

Sensitive data must never be written to logs.

---

# 59. Health Check

The backend should expose a lightweight health endpoint such as:

```text
/api/v1/health
```

It should indicate whether the service is running and, where appropriate, whether required dependencies are available.

---

# 60. AI-Assisted Development Workflow

Antigravity should work in small, controlled implementation units.

Standard workflow:

```text
Read Documentation
       |
Read Current Memory
       |
Identify Current Phase
       |
Understand Existing Code
       |
Plan Task
       |
Implement
       |
Run Tests / Build
       |
Review Changes
       |
Update Memory
       |
Stop
```

Antigravity should not automatically continue into unrelated features after completing the requested task.

---

# 61. Context Loading Protocol for Antigravity

Before starting a significant task, Antigravity should read:

```text
docs/PRD.md
docs/Architecture.md
docs/Rules.md
docs/Design.md
docs/Phases.md
docs/AI_CONTEXT.md
docs/Memory.md
```

If `Memory.md` does not yet exist, it should not invent previous progress.

For small tasks, the agent may use the relevant subset of documents if the task clearly does not require the full context.

---

# 62. Existing Code Inspection Protocol

Before modifying existing code, Antigravity should:

1. Locate the relevant files.
2. Read the current implementation.
3. Identify dependencies.
4. Identify related API/UI/database code.
5. Determine whether reusable components already exist.
6. Check for existing tests.
7. Make the smallest appropriate change.
8. Verify that existing functionality remains intact.

The agent must not replace working code simply because another implementation appears cleaner.

---

# 63. Task Boundaries

Each implementation request should have:

- A clear objective.
- A defined feature/module.
- Expected behavior.
- Relevant documentation.
- Acceptance criteria where appropriate.

Example:

```text
Task:
Implement customer product listing.

Allowed:
- Product listing API.
- Product listing UI.
- Required product-card changes.

Not allowed:
- Checkout.
- Payment.
- Admin analytics.
- Unrelated refactoring.
```

---

# 64. Change Management

When an architectural change is genuinely necessary:

```text
Identify problem
      |
Explain impact
      |
Propose change
      |
Obtain approval
      |
Update Architecture.md
      |
Implement
      |
Update Memory.md
```

Architectural changes must not be silently introduced during ordinary feature implementation.

---

# 65. Definition of Done

A feature is not considered complete merely because the code was generated.

A task should generally satisfy:

- Requirements implemented.
- Existing functionality preserved.
- Validation implemented where needed.
- Error states handled.
- Loading/empty states handled where relevant.
- Security considerations addressed.
- Tests added/updated where appropriate.
- Build passes.
- Relevant tests pass.
- No unnecessary files or dependencies introduced.
- Documentation updated if the feature changes architecture or workflow.
- `Memory.md` updated after implementation.

---

# 66. Future Extensibility

The architecture should allow future addition of:

- Online payments.
- Razorpay.
- AI shopping assistant.
- ML recommendations.
- Product comparison.
- Email.
- SMS.
- Push notifications.
- Delivery partners.
- Loyalty program.
- PWA.
- Advanced search engine.
- Redis caching.

Future features should integrate into existing modules rather than forcing unnecessary rewrites.

---

# 67. Architectural Principles

1. Backend is the source of truth for business-critical data.
2. Business logic belongs in services rather than UI components.
3. Controllers should remain thin.
4. API contracts should remain consistent.
5. Features should be modular.
6. Shared utilities should be genuinely reusable.
7. Avoid premature abstraction.
8. Avoid unnecessary dependencies.
9. Avoid microservices until there is a genuine requirement.
10. Critical multi-step database operations should be consistent and transactional where appropriate.
11. Historical orders must preserve purchase-time data.
12. Authentication and authorization must be enforced server-side.
13. External integrations should be isolated.
14. Security must be considered from the beginning.
15. Performance optimizations should be evidence-driven.
16. Documentation must be updated when important architecture decisions change.
17. AI agents must implement approved architecture rather than silently redefining it.
18. Small, verifiable changes are preferred over large uncontrolled changes.

---

# 68. Architecture Decision Summary

| Area | Decision |
|---|---|
| Architecture | Modular Monolith |
| AI Coding Partner | Antigravity |
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Routing | React Router |
| Server State | TanStack Query |
| Client State | Zustand |
| HTTP | Axios |
| Forms | React Hook Form |
| Validation | Zod + backend validation |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Authentication | Short-lived access + refresh tokens |
| Token Storage | Secure HTTP-only Cookies |
| Authorization | Role-Based Access Control |
| API | REST + `/api/v1` |
| Images | Cloudinary |
| Initial Payment | COD |
| Future Payment | Razorpay/online gateway |
| Import | CSV/XLSX |
| Deployment | Vercel + Render + MongoDB Atlas |
| Architecture Style | Modular Monolith |

---

# 69. Document Status

**Architecture Version:** 1.1  
**Project:** LuxeCart  
**Status:** Antigravity-ready architecture defined  
**Next Documentation:** `Rules.md`
