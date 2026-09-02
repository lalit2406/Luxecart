# LuxeCart — AI & Development Rules

**Document Version:** 1.0  
**Project:** LuxeCart  
**Primary AI Coding Partner:** Antigravity  
**Status:** Development Rules

---

# 1. Purpose

This document defines the rules that must be followed while developing LuxeCart.

These rules apply to:

- Antigravity.
- Human contributors.
- Frontend code.
- Backend code.
- Database operations.
- API development.
- UI/UX implementation.
- Security.
- Testing.
- Documentation.
- Git workflow.

The purpose is to keep LuxeCart consistent, secure, maintainable and production-oriented.

---

# 2. Source of Truth

Use the project documentation in this order:

```text
User-approved decisions
        ↓
PRD.md
        ↓
Architecture.md
        ↓
Rules.md
        ↓
Design.md
        ↓
Phases.md
        ↓
Memory.md
```

Do not silently contradict these documents.

If a requirement is unclear or two documents conflict, stop and ask for clarification or explicitly identify the conflict.

---

# 3. Antigravity's Role

Antigravity is the primary AI implementation partner.

Antigravity should:

- Understand requirements.
- Inspect the existing code.
- Plan implementation.
- Implement requested features.
- Test changes.
- Fix implementation errors.
- Explain important decisions.
- Update documentation when appropriate.
- Update `Memory.md` after meaningful implementation work.

Antigravity must not:

- Invent major product requirements.
- Replace approved architecture without approval.
- Rewrite the entire project unnecessarily.
- Delete working functionality to simplify implementation.
- Introduce major dependencies without justification.
- Implement unrelated features.
- Skip testing because code appears correct.
- Claim a feature works without verifying it.
- Hide known errors.

---

# 4. Read Before Coding

Before starting a significant task, Antigravity should inspect:

```text
docs/PRD.md
docs/Architecture.md
docs/Rules.md
docs/Design.md
docs/Phases.md
docs/AI_CONTEXT.md
docs/Memory.md
```

If a document does not exist yet, the agent must not invent its contents.

The agent should also inspect the relevant existing source files before modifying them.

---

# 5. One Task at a Time

Development must be incremental.

Bad:

```text
Build the entire LuxeCart platform.
```

Preferred:

```text
Implement customer authentication.

Then:
- Test it.
- Review it.
- Update Memory.
- Move to the next task.
```

Antigravity should not automatically implement unrelated future phases.

---

# 6. Existing Code First

Before creating new code:

1. Search for existing implementations.
2. Reuse appropriate components/functions.
3. Check whether an existing API already provides the required data.
4. Check existing schemas and utilities.
5. Avoid duplicate functionality.

Do not create:

```text
ProductCard2.jsx
ProductCardNew.jsx
ProductCardFinal.jsx
```

when an existing reusable `ProductCard` can be properly extended.

---

# 7. Minimal Safe Changes

Prefer the smallest change that correctly solves the task.

Avoid unrelated refactoring during feature work.

If a refactor is necessary:

- Explain why.
- Keep the scope controlled.
- Verify affected functionality.

---

# 8. Technology Stack Rules

The approved primary stack is:

### Frontend

- React
- Vite
- React Router
- Tailwind CSS
- TanStack Query
- Zustand
- Axios
- React Hook Form
- Zod

### Backend

- Node.js
- Express.js
- MongoDB
- Mongoose

Do not replace these technologies without an explicit architectural decision.

---

# 9. Dependency Rules

Before adding a new npm package, ask:

1. Is it actually necessary?
2. Does the existing stack already solve the problem?
3. Is the package maintained?
4. Does it introduce unnecessary complexity?
5. Is it compatible with the project?

Avoid installing packages simply because they are popular.

Do not add duplicate libraries for the same purpose.

For example, do not introduce another state-management library when Zustand already handles the requirement.

---

# 10. Frontend State Rules

Use:

```text
Zustand
→ Client/UI state

TanStack Query
→ Server/API state
```

Do not put all API data into Zustand.

Do not use local component state for data that must remain synchronized with the server.

Use the simplest appropriate state solution.

---

# 11. API Rules

All APIs must use:

```text
/api/v1/
```

Example:

```text
GET /api/v1/products
GET /api/v1/products/:id
POST /api/v1/products
PATCH /api/v1/products/:id
DELETE /api/v1/products/:id
```

Use HTTP methods appropriately.

Do not create unnecessarily vague endpoints such as:

```text
POST /api/doEverything
```

API naming should be predictable and resource-oriented.

---

# 12. API Response Rules

Successful responses should follow the standard structure:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}
```

Errors:

```json
{
  "success": false,
  "message": "Human-readable error",
  "error": {
    "code": "ERROR_CODE"
  }
}
```

Paginated responses:

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

Do not expose stack traces, database errors or secrets to clients.

---

# 13. Controller Rules

Controllers must remain thin.

Controllers should:

- Read request information.
- Call services.
- Return responses.
- Pass errors to centralized handling.

Controllers should not contain large business workflows.

Bad:

```text
Controller:
- calculate discount
- check stock
- create order
- update inventory
- send notification
```

Better:

```text
Controller
    ↓
OrderService
    ↓
InventoryService
CouponService
NotificationService
```

---

# 14. Service Rules

Business logic belongs primarily in services.

Examples:

```text
AuthService
ProductService
CartService
OrderService
InventoryService
CouponService
ReviewService
PaymentService
```

A service should have a clear responsibility.

Avoid giant services containing unrelated business domains.

---

# 15. Database Rules

MongoDB is the primary database.

Use Mongoose schemas and appropriate validation.

Important business data must be validated before database writes.

Do not trust frontend values for:

- Price.
- Stock.
- Discount.
- Coupon.
- Order total.
- User role.
- Payment status.

The backend is the source of truth.

---

# 16. Product Rules

Products must support variants.

Example:

```text
Product
├── Black / S
├── Black / M
├── Black / L
├── White / S
└── White / M
```

Every sellable variant must have a unique SKU.

Variant-level inventory is required for products that have variants.

Do not implement fashion inventory as a single product-level stock number when variants exist.

---

# 17. Order Rules

Order creation must happen on the backend.

The backend must independently calculate:

- Product price.
- Quantity.
- Discounts.
- Coupon.
- Shipping.
- Tax where applicable.
- Final total.

The client may display a calculated total, but the server must recalculate and verify it.

---

# 18. Duplicate Order Protection

Order creation must be protected against accidental duplicate requests.

The implementation should use an appropriate idempotency or duplicate-request strategy.

A double click or repeated network request must not unnecessarily create two identical orders.

---

# 19. Inventory Rules

Inventory must be updated safely.

Rules:

- Never allow stock below zero.
- Validate stock before order creation.
- Update inventory through backend business logic.
- Record meaningful inventory changes.
- Restore stock when eligible cancellations/returns require it.
- Avoid client-controlled stock values.

Critical multi-document operations should use MongoDB transactions where appropriate and supported.

---

# 20. Coupon Rules

Coupons must be validated server-side.

Check:

- Existence.
- Active status.
- Start date.
- Expiry.
- Usage limits.
- Per-user limits.
- Minimum order.
- Eligible products/categories.
- Discount limits.

Never trust a discount amount sent by the frontend.

---

# 21. Authentication Rules

Authentication uses:

- Short-lived access tokens.
- Refresh tokens.
- Secure HTTP-only cookies.
- Password hashing.

Never:

- Store plaintext passwords.
- Return password hashes to clients.
- Put authentication secrets in frontend code.
- Hardcode JWT secrets.
- Commit `.env` files containing secrets.

---

# 22. Authorization Rules

Initial roles:

```text
CUSTOMER
ADMIN
```

Admin permissions must always be checked on the backend.

Hiding an admin button in React is not security.

This is insufficient:

```text
if (user.role === "ADMIN") {
   showButton();
}
```

The API itself must reject unauthorized requests.

---

# 23. User Data Rules

Only return information necessary for the requested operation.

Do not expose:

- Password hashes.
- Refresh tokens.
- Internal security data.
- Sensitive administrative information.

Use explicit response shaping where necessary.

---

# 24. Environment Variable Rules

Secrets belong in environment variables.

Examples:

```text
MONGODB_URI
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Never commit secrets to Git.

`.env` files containing secrets must be ignored.

Provide safe `.env.example` files containing placeholder values where useful.

---

# 25. File Upload Rules

Uploaded files must be:

- Validated.
- Restricted by allowed type.
- Restricted by reasonable size.
- Processed safely.

Product images should be stored through Cloudinary rather than directly inside MongoDB.

CSV/XLSX imports must be validated before database changes.

---

# 26. CSV/XLSX Import Rules

Never immediately insert an uploaded spreadsheet into the database.

Required flow:

```text
Upload
 ↓
Validate File
 ↓
Parse
 ↓
Validate Rows
 ↓
Preview
 ↓
Confirm
 ↓
Import
 ↓
Report
```

The system should report row-level errors wherever practical.

Example:

```text
Row 27:
Invalid SKU

Row 42:
Invalid price

Row 73:
Unknown category
```

---

# 27. Error Handling Rules

Every major feature must handle:

- Loading.
- Success.
- Error.
- Empty state.

Never silently swallow errors.

Bad:

```text
try {
   await request();
} catch {
}
```

Errors should be logged/handled appropriately.

User-facing errors should be understandable.

Developer-facing logs should contain enough context to diagnose problems without exposing sensitive data.

---

# 28. Logging Rules

Do not log:

- Passwords.
- Access tokens.
- Refresh tokens.
- API secrets.
- Payment secrets.
- Sensitive personal information unnecessarily.

Use meaningful logs for:

- Errors.
- Important system events.
- Development diagnostics.

Avoid excessive console logging in production code.

---

# 29. Frontend Component Rules

Components should have clear responsibilities.

Avoid giant components such as:

```text
EverythingPage.jsx
```

Prefer:

```text
ProductGallery
ProductInfo
VariantSelector
PriceDisplay
AddToCart
Reviews
RelatedProducts
```

Create shared components when the same UI behavior genuinely appears in multiple places.

Do not over-abstract simple one-off components.

---

# 30. Styling Rules

The project uses Tailwind CSS.

Design decisions must follow `Design.md`.

Avoid randomly introducing inline styles or unrelated CSS systems.

Do not create dozens of slightly different spacing, colors or typography values.

Use the established design tokens wherever possible.

---

# 31. Responsive Design Rules

Every customer-facing feature must be considered for:

- Mobile.
- Tablet.
- Desktop.

Do not implement desktop first and assume mobile will automatically work.

Admin interfaces should also remain usable on smaller screens where practical.

---

# 32. Accessibility Rules

Use:

- Semantic HTML.
- Labels.
- Keyboard navigation.
- Visible focus states.
- Accessible buttons.
- Meaningful alt text.
- Appropriate ARIA only when necessary.

Do not use clickable `<div>` elements when a semantic `<button>` or `<a>` is appropriate.

---

# 33. Performance Rules

Avoid unnecessary:

- API calls.
- Re-renders.
- Database queries.
- Large client-side datasets.
- Unoptimized images.

Use:

- Pagination.
- Query caching.
- Lazy loading.
- Debouncing where appropriate.
- Database indexes.
- Optimized images.

Do not optimize prematurely without a reason.

---

# 34. Search Rules

Search requests should be debounced where user typing triggers API calls.

Search queries must be:

- Validated.
- Bounded.
- Efficient.

Do not perform an unbounded database search on every keystroke.

---

# 35. Pagination Rules

Large datasets must not be returned in one huge response.

Use pagination for:

- Products.
- Orders.
- Customers.
- Reviews.
- Notifications.
- Admin tables.

Default limits should be sensible and server-controlled.

---

# 36. Database Query Rules

Avoid:

- Unbounded queries.
- N+1 query patterns.
- Loading entire collections unnecessarily.
- Returning fields that are not required.

Use indexes for frequently queried fields where appropriate.

Database optimization should be based on actual query patterns.

---

# 37. SEO Rules

Public pages should have:

- Meaningful URLs.
- Dynamic titles.
- Meta descriptions.
- Canonical URLs where appropriate.
- Structured data where appropriate.
- Sitemap support.
- Robots configuration.

Do not sacrifice usability purely for keyword stuffing.

---

# 38. Security Rules

Security is a requirement, not a later feature.

Consider:

- Authentication.
- Authorization.
- Input validation.
- Rate limiting.
- CORS.
- Security headers.
- Secure cookies.
- Password hashing.
- File validation.
- Injection protection.
- Sensitive-data handling.

Never assume frontend validation is sufficient.

---

# 39. Admin Security

Admin functionality is high-risk.

Require:

- Authentication.
- Role authorization.
- Server-side permission checks.
- Appropriate validation.

Important administrative actions should be auditable.

---

# 40. Payment Rules

Initial payment method:

```text
COD
```

Do not implement online payment functionality before the project phase explicitly calls for it.

Payment architecture must remain extensible.

Future providers may include:

```text
COD
Razorpay
Other gateway
```

Do not fake successful online payments for production behavior.

---

# 41. Third-Party Service Rules

Before integrating an external service:

1. Confirm it is required.
2. Check official documentation.
3. Keep credentials in environment variables.
4. Isolate integration code.
5. Handle failure gracefully.
6. Avoid tightly coupling core business logic to a provider.

Provider-specific code should live behind a service/provider boundary when practical.

---

# 42. Testing Rules

Do not consider a feature complete without verification.

At minimum, test critical business behavior.

Examples:

### Authentication

- Valid login.
- Invalid login.
- Expired access token.
- Refresh flow.
- Unauthorized access.

### Products

- Create.
- Update.
- Delete/archive.
- Variant validation.

### Orders

- Stock validation.
- Price calculation.
- Coupon calculation.
- Order creation.
- Duplicate-order protection.

### Admin

- Authorized admin.
- Unauthorized customer.
- Invalid input.

---

# 43. Build Verification

Before declaring a frontend task complete:

```text
npm run build
```

or the project's equivalent build command should pass.

Backend tests/linting or appropriate verification should also be run when configured.

If verification fails, the task is not complete.

---

# 44. No False Completion

Antigravity must not say:

> "Done"

when:

- The feature was not tested.
- The build fails.
- Known errors remain.
- Required files are missing.
- The implementation is only partially complete.

Instead, report:

- What was completed.
- What was tested.
- What failed.
- What remains.

---

# 45. Git Rules

Use Git throughout development.

Commit changes in logical units.

Good:

```text
feat(auth): add customer registration
feat(products): add product listing API
fix(cart): prevent negative quantity
```

Avoid meaningless commits such as:

```text
update
changes
final
new
test123
```

Do not commit:

- `.env`
- Secrets.
- Build artifacts unless explicitly required.
- Large generated files that do not belong in the repository.

---

# 46. Git Safety

Antigravity must be careful with destructive Git commands.

Do not automatically run commands such as:

```text
git reset --hard
git clean -fd
git push --force
```

unless explicitly authorized.

Never overwrite user work without confirmation.

---

# 47. Refactoring Rules

Refactoring is allowed when:

- It reduces duplication.
- It fixes architectural problems.
- It improves maintainability.
- It is required for the current feature.

Refactoring should not become an excuse to rewrite the project during every task.

---

# 48. Documentation Rules

Update documentation when implementation materially changes:

- Architecture.
- Business rules.
- Development phase.
- Important technical decisions.

Do not update documentation with false claims.

---

# 49. Memory.md Rules

Once implementation begins, `Memory.md` records the current project state.

After meaningful work, update:

```text
Current Phase
Current Task
Completed Work
Important Decisions
Known Issues
Next Tasks
Last Updated
```

Example:

```markdown
## Current Phase
Phase 2 — Authentication

## Completed
- Registration API
- Login API
- Refresh token flow

## Known Issues
- Password reset email not implemented

## Next
- Protected routes
- Admin authorization
```

`Memory.md` is a status record, not a replacement for the PRD or architecture.

---

# 50. AI Context Rules

`AI_CONTEXT.md` should remain short.

It should provide:

- Project identity.
- Current stack.
- Core architecture.
- Current phase.
- Important constraints.
- Links/references to detailed documentation.

Detailed requirements should remain in the appropriate documents.

Do not copy the entire PRD into `AI_CONTEXT.md`.

---

# 51. No Hallucinated Project State

If Antigravity does not know whether something exists:

```text
Inspect the repository.
```

Do not assume:

- An API exists.
- A component exists.
- A dependency is installed.
- A database schema exists.
- A feature was previously implemented.

If `Memory.md` says something was completed but the code does not reflect it, inspect the code and report the discrepancy.

---

# 52. No Unapproved Architecture Changes

The following require explicit approval or an architecture update:

- Changing database technology.
- Changing frontend framework.
- Changing backend framework.
- Replacing state-management strategy.
- Introducing microservices.
- Introducing a major external service.
- Changing authentication architecture.
- Replacing the API style.
- Major folder-structure changes.

Small implementation improvements do not require architectural approval when they remain consistent with the documented architecture.

---

# 53. Feature Completion Checklist

Before marking a feature complete:

```text
[ ] Requirements understood
[ ] Existing code inspected
[ ] Implementation completed
[ ] Validation added
[ ] Error states handled
[ ] Loading states handled where needed
[ ] Empty states handled where needed
[ ] Responsive behavior considered
[ ] Accessibility considered
[ ] Security considered
[ ] Tests added/updated where appropriate
[ ] Build passes
[ ] No unnecessary dependency added
[ ] No unrelated functionality broken
[ ] Documentation updated if required
[ ] Memory.md updated
```

---

# 54. AI Task Prompt Pattern

When assigning a task to Antigravity, use a structure like:

```text
Task:
[What should be implemented]

Context:
[Why it is needed]

Requirements:
- Requirement 1
- Requirement 2
- Requirement 3

Constraints:
- Follow PRD.md
- Follow Architecture.md
- Follow Rules.md
- Do not modify unrelated features

Acceptance Criteria:
- Criterion 1
- Criterion 2
- Criterion 3

After implementation:
- Test the feature.
- Run the appropriate build/tests.
- Report files changed.
- Report verification results.
- Update Memory.md.
```

This should be the preferred way to work with Antigravity.

---

# 55. Final Development Principle

> **Build LuxeCart like a real product, not like a code-generation demo.**

The priority order is:

```text
Correctness
    ↓
Security
    ↓
Maintainability
    ↓
User Experience
    ↓
Performance
    ↓
Additional Features
```

A smaller feature that works correctly is better than ten partially implemented features.

---

# 56. Rules Summary

The most important rules are:

1. Read the documentation before significant implementation.
2. Inspect existing code before modifying it.
3. Work one task/phase at a time.
4. Follow the approved architecture.
5. Keep controllers thin.
6. Put business logic in services.
7. Validate on the backend.
8. Never trust client-controlled prices or inventory.
9. Protect admin APIs server-side.
10. Never commit secrets.
11. Test before declaring completion.
12. Do not hide known errors.
13. Avoid unnecessary dependencies.
14. Avoid unnecessary rewrites.
15. Keep the application responsive and accessible.
16. Update `Memory.md` after meaningful implementation work.
17. Ask before making major architectural changes.
18. Never overwrite user work without permission.

---

## Document Status

**Rules Version:** 1.0  
**Project:** LuxeCart  
**Primary AI Partner:** Antigravity  
**Status:** Development rules defined  
**Next Documentation:** `Design.md`
