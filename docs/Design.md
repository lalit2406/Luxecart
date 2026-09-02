# LuxeCart — Design System

**Document Version:** 1.0  
**Project:** LuxeCart  
**Design Direction:** Premium Modern Indian Fashion & Lifestyle  
**Primary Market:** India  
**Theme:** Light-first premium storefront  
**3D:** Strategic, performance-conscious use  
**Status:** Design system defined

---

# 1. Design Vision

LuxeCart should feel like a premium fashion brand rather than a generic e-commerce template.

The visual experience should communicate:

- Premium.
- Modern.
- Confident.
- Clean.
- Fashion-forward.
- Trustworthy.
- Sophisticated.
- Indian-market friendly without relying on stereotypical visual elements.

The design should combine strong editorial fashion aesthetics with practical e-commerce usability.

---

# 2. Core Design Principle

> **Luxury in appearance, simplicity in shopping.**

Visual richness should never make core shopping tasks difficult.

Customers must be able to quickly:

- Find products.
- Understand prices.
- Select variants.
- Add to cart.
- Checkout.
- Track orders.

---

# 3. Brand Personality

LuxeCart should feel:

```text
Premium       ██████████
Modern        █████████
Minimal       ████████
Fashionable   ██████████
Playful       ████
Technical     █████
Corporate     █████
```

Avoid making the brand:

- Cheap-looking.
- Overly colorful.
- Cluttered.
- Excessively animated.
- Similar to a marketplace dashboard.

---

# 4. Visual Direction

The storefront should combine:

### Editorial fashion

Large imagery, generous whitespace and strong typography.

### Modern commerce

Clear prices, filters, CTAs and shopping interactions.

### Subtle technology

Micro-interactions, smooth transitions and selected 3D experiences.

---

# 5. Color System

LuxeCart should use a warm premium palette.

## Primary Background

```text
#F7F3EE
```

Warm off-white / ivory.

## Surface

```text
#FFFFFF
```

## Primary Text

```text
#171513
```

Near-black warm text.

## Secondary Text

```text
#6F6963
```

Muted warm gray.

## Primary Brand Accent

```text
#9A6A45
```

Warm luxury brown.

## Dark Accent

```text
#2A211B
```

Deep espresso.

## Border

```text
#E7DED5
```

Soft warm border.

## Success

Use a restrained green tone.

## Warning

Use a warm amber tone.

## Error

Use a restrained red tone.

Status colors should be used primarily for communication rather than decoration.

---

# 6. Color Usage Rules

The interface should not use the brand accent everywhere.

Recommended visual hierarchy:

```text
Background
    ↓
Surface
    ↓
Text
    ↓
Secondary text
    ↓
Brand accent
    ↓
Strong CTA
```

Brand accent should highlight:

- Primary CTAs.
- Important interactive elements.
- Selected states.
- Brand details.

Avoid making every button or card brown.

---

# 7. Typography

Typography should feel premium and highly readable.

Recommended font pairing:

### Display / Headings

**Playfair Display**

Use selectively for:

- Hero headings.
- Editorial statements.
- Collection titles.
- Major promotional sections.

### Interface / Body

**Inter**

Use for:

- Product names.
- Prices.
- Navigation.
- Buttons.
- Forms.
- Admin dashboard.
- Body content.

The design should not use excessive decorative typography.

---

# 8. Typography Hierarchy

Example:

```text
Hero Heading
72px desktop
48px tablet
38px mobile

Section Heading
40px desktop
32px tablet
28px mobile

Product Title
16–18px

Body
14–16px

Small Text
12–13px
```

Exact responsive values may be adjusted during implementation based on usability.

---

# 9. Spacing System

Use a consistent spacing scale.

Preferred base unit:

```text
4px
```

Examples:

```text
4
8
12
16
20
24
32
40
48
64
80
96
120
```

Avoid arbitrary spacing values unless there is a strong reason.

---

# 10. Layout Width

Desktop storefront content should generally use a centered max-width container.

Recommended:

```text
max-width: 1440px
```

with responsive horizontal padding.

Large promotional sections may use full-width layouts.

---

# 11. Border Radius

LuxeCart should use moderately rounded elements.

Suggested:

```text
Small controls: 8px
Cards: 12–16px
Large surfaces: 20px
Pills: 999px
```

Avoid excessive rounded corners on every element.

---

# 12. Shadows

Use soft, subtle shadows.

Avoid:

- Heavy drop shadows.
- Glow everywhere.
- Excessive neumorphism.

Cards should generally rely on:

- Image.
- Whitespace.
- Border.
- Subtle elevation.

---

# 13. Header / Navbar

The header should feel premium and clean.

Desktop:

```text
LOGO
Women   Men   Kids   Footwear   Beauty   Accessories
                     Search
                         ♡
                         Bag
                         Account
```

The exact navigation categories should remain manageable as the catalog evolves.

Header behavior:

- Sticky where appropriate.
- Subtle backdrop treatment while scrolling.
- Clean dropdown/mega-menu.
- Strong search experience.

---

# 14. Search Experience

Search should be a major part of the storefront.

Desktop search:

```text
┌────────────────────────────────────────────┐
│ Search products, brands and categories... │
└────────────────────────────────────────────┘
```

Search suggestions may display:

```text
Popular Searches

Oversized T-Shirts
Sneakers
Dresses
Sunglasses
```

And matching products.

Search interactions should feel fast and lightweight.

---

# 15. Homepage Hero

The homepage hero should be one of LuxeCart's strongest visual areas.

Concept:

```text
┌──────────────────────────────────────────────┐
│                                              │
│  ELEVATE YOUR EVERYDAY                      │
│                                              │
│  Curated fashion & lifestyle                │
│  for modern India.                          │
│                                              │
│  [ SHOP WOMEN ]  [ SHOP MEN ]               │
│                                      3D      │
│                                Fashion Scene │
│                                              │
└──────────────────────────────────────────────┘
```

The hero should use strong editorial imagery or a carefully designed 3D composition.

---

# 16. 3D Strategy

3D is a differentiating feature but must be used strategically.

The objective is:

> **Make LuxeCart memorable without sacrificing shopping performance.**

Use 3D in selected high-impact areas.

---

# 17. 3D Hero Experience

The homepage may feature a 3D object or fashion scene.

Possible concepts:

### Concept A — Floating Fashion Objects

A composition containing:

- Sneaker.
- Handbag.
- Sunglasses.
- Watch.
- Clothing accessory.

Objects subtly float and respond to pointer movement.

### Concept B — 3D Product Pedestal

A premium product sits on a minimal 3D pedestal with:

- Soft lighting.
- Subtle rotation.
- Floating particles only if visually justified.

### Concept C — 3D Fashion Orb

A rotating abstract luxury object incorporating fashion textures.

The chosen concept should depend on available assets and performance.

---

# 18. 3D Technology

Potential implementation:

```text
React
   ↓
React Three Fiber
   ↓
Three.js
```

Possible supporting technology:

```text
@react-three/fiber
@react-three/drei
```

3D dependencies should only be introduced when the actual 3D feature is ready.

Do not add a 3D stack merely for future possibility.

---

# 19. 3D Performance Rules

3D must never block the core shopping experience.

Requirements:

- Lazy-load 3D.
- Avoid unnecessarily large models.
- Compress assets.
- Prefer optimized GLB/GLTF.
- Limit polygon complexity.
- Avoid excessive real-time effects.
- Respect reduced-motion preferences.
- Provide a fallback image.
- Disable or simplify 3D on low-capability devices where appropriate.
- Do not make 3D mandatory for product discovery.

Fallback:

```text
3D available
    ↓
Interactive 3D

3D unavailable / slow device
    ↓
Static optimized image
```

---

# 20. 3D Product Viewer

A selected product may eventually support an interactive 3D viewer.

Example:

```text
Product Gallery

[ Image ]
[ Image ]
[ 3D ]
```

The 3D viewer should support:

- Rotate.
- Zoom.
- Reset.

It should not be required for every product.

Admin should be able to mark whether a product has a 3D asset.

---

# 21. 3D Product Data

Where supported, a product may contain:

```text
model3D
├── url
├── format
├── posterImage
└── enabled
```

The normal product image gallery remains the fallback.

---

# 22. Product Grid

Product grids should prioritize product imagery.

Desktop example:

```text
4 products per row
```

Tablet:

```text
2–3 products per row
```

Mobile:

```text
2 products per row
```

Product cards should contain:

- Image.
- Wishlist button.
- Badge where applicable.
- Product name.
- Brand where appropriate.
- Rating.
- Price.
- MRP.
- Discount.

---

# 23. Product Card

A product card should feel clean rather than dashboard-like.

Example:

```text
┌─────────────────────┐
│               ♡     │
│                     │
│      PRODUCT        │
│       IMAGE         │
│                     │
└─────────────────────┘
Oversized Essential Tee

₹799  ₹1,299  38% OFF

★★★★★ 4.6
```

Hover on desktop may provide:

- Secondary product image.
- Quick add.
- Subtle image zoom.

Avoid excessive hover effects.

---

# 24. Product Page

Recommended layout:

```text
┌──────────────────────┬──────────────────────┐
│                      │ Brand                │
│                      │ Product Name         │
│   Product Gallery    │ Rating               │
│                      │ Price                │
│                      │ Color                │
│                      │ Size                 │
│                      │ Size Guide           │
│                      │ Delivery             │
│                      │                      │
│                      │ [ ADD TO BAG ]       │
│                      │ [ BUY NOW ]          │
└──────────────────────┴──────────────────────┘
```

Below:

- Description.
- Specifications.
- Delivery.
- Reviews.
- Related products.
- Frequently bought together.

---

# 25. Add to Cart CTA

Primary CTA should be visually strong.

Desktop:

```text
[ ADD TO BAG ]
```

Secondary:

```text
[ BUY NOW ]
```

Mobile may use a sticky bottom action bar.

---

# 26. Wishlist Interaction

Wishlist should use a familiar heart icon.

States:

```text
♡ Not selected

♥ Selected
```

The interaction should provide subtle feedback without large animations.

---

# 27. Cart Design

Cart should provide a clear summary.

```text
YOUR BAG

Product
Variant
Quantity
Price

---------------------

Subtotal
Discount
Shipping
---------------------
Total

[ PROCEED TO CHECKOUT ]
```

The customer should always be able to understand how the final total was calculated.

---

# 28. Checkout Design

Checkout should minimize distractions.

Steps:

```text
Address
  ↓
Delivery
  ↓
Payment
  ↓
Review
  ↓
Place Order
```

Because the initial payment method is COD, checkout should remain simple.

---

# 29. COD Presentation

Example:

```text
Payment Method

● Cash on Delivery

Pay when your order arrives.
```

Future payment methods can appear here without redesigning the entire checkout.

---

# 30. Order Tracking UI

Use a clean timeline.

```text
✓ Order Placed
│
✓ Confirmed
│
✓ Packed
│
● Shipped
│
○ Out for Delivery
│
○ Delivered
```

Use subtle animation only for the active stage.

---

# 31. Admin Design Direction

The admin panel should be visually consistent with LuxeCart but more functional.

Priorities:

- Information density.
- Clear tables.
- Strong hierarchy.
- Fast navigation.
- Filters.
- Search.
- Bulk actions.

Avoid making the admin dashboard look like the marketing storefront.

---

# 32. Admin Dashboard

Suggested structure:

```text
Sidebar
│
├── Dashboard
├── Products
├── Categories
├── Inventory
├── Orders
├── Customers
├── Coupons
├── Promotions
├── Reviews
├── Returns
├── Imports
├── Analytics
├── Content
└── Settings
```

Main area:

```text
Revenue
Orders
Customers
AOV

Sales Chart

Recent Orders

Low Stock

Top Products
```

---

# 33. Admin Tables

Tables should support:

- Search.
- Filters.
- Sorting.
- Pagination.
- Bulk selection.
- Bulk actions where safe.

Avoid overly wide tables on mobile.

---

# 34. Forms

Forms should:

- Have clear labels.
- Group related fields.
- Show validation close to the relevant field.
- Preserve user input after recoverable errors.
- Clearly identify required fields.
- Provide helpful error messages.

---

# 35. Buttons

Button hierarchy:

### Primary

Main action.

```text
[ ADD TO BAG ]
```

### Secondary

Supporting action.

```text
[ VIEW DETAILS ]
```

### Tertiary

Low-emphasis action.

```text
Cancel
```

### Destructive

Actions such as:

```text
Delete
Reject
Cancel Order
```

should be clearly distinguishable and require confirmation when appropriate.

---

# 36. Badges

Use badges sparingly.

Examples:

```text
NEW
BESTSELLER
SALE
LIMITED
```

Do not place multiple badges on every product.

---

# 37. Micro-interactions

Use subtle animation for:

- Button hover.
- Wishlist selection.
- Cart addition.
- Dropdown opening.
- Modal opening.
- Image transitions.
- Page transitions where useful.
- Order status changes.

Animation should communicate state, not distract.

---

# 38. Animation Timing

General guideline:

```text
Micro interaction: 150–250ms
UI transition: 200–350ms
Large visual transition: 350–600ms
```

Avoid long animations on normal shopping interactions.

---

# 39. Motion Accessibility

Respect:

```text
prefers-reduced-motion
```

When reduced motion is requested:

- Disable decorative 3D movement.
- Reduce transitions.
- Avoid continuous animation.
- Keep functional feedback.

---

# 40. Loading States

Use skeletons for:

- Product grids.
- Product details.
- Dashboard cards.
- Tables.

Avoid showing a blank screen while data is loading.

---

# 41. Empty States

Examples:

### Wishlist

```text
Your wishlist is waiting for something special.

[ EXPLORE PRODUCTS ]
```

### Cart

```text
Your bag is empty.

[ START SHOPPING ]
```

Empty states should be useful and brand-consistent.

---

# 42. Error States

Example:

```text
Something went wrong.

We couldn't load this page.

[ TRY AGAIN ]
```

For forms, errors should be displayed close to the affected field.

---

# 43. Mobile Navigation

Mobile should use a compact navigation system.

Possible structure:

```text
Home
Shop
Wishlist
Bag
Account
```

Search should remain easily accessible.

---

# 44. Mobile Product Experience

Mobile product pages should prioritize:

1. Images.
2. Product name.
3. Price.
4. Rating.
5. Variant selection.
6. Delivery.
7. Add to Bag.

A sticky bottom CTA may be used.

---

# 45. Image Guidelines

Product images should:

- Have consistent aspect ratios where possible.
- Use high-quality sources.
- Use optimized delivery.
- Include descriptive alt text.
- Support lazy loading below the fold.

Avoid stretching product images.

---

# 46. Iconography

Use one consistent icon system.

Recommended:

**Lucide React**

Icons should be:

- Simple.
- Consistent.
- Lightweight.
- Familiar.

Avoid mixing multiple icon libraries.

---

# 47. Toasts and Notifications

Use toast notifications for lightweight feedback.

Examples:

```text
✓ Added to wishlist
✓ Added to bag
✓ Coupon applied
```

Do not use toasts for critical information that must remain visible.

---

# 48. Modal Rules

Use modals for:

- Confirmation.
- Quick view.
- Important short forms.
- Variant selection where appropriate.

Do not put complex multi-step workflows into tiny modals.

---

# 49. Accessibility

The design must support:

- Keyboard navigation.
- Visible focus.
- Semantic structure.
- Accessible labels.
- Sufficient contrast.
- Screen readers.
- Reduced motion.

Accessibility is part of the design system, not an optional enhancement.

---

# 50. Design Consistency

All pages should share:

- Typography.
- Spacing.
- Buttons.
- Form controls.
- Border radius.
- Icons.
- Interaction patterns.

Do not design every page as a separate visual experiment.

---

# 51. Storefront vs Admin

### Storefront

Prioritize:

```text
Emotion
Visuals
Discovery
Shopping
Conversion
```

### Admin

Prioritize:

```text
Efficiency
Information
Control
Accuracy
Speed
```

The two experiences should feel related but not identical.

---

# 52. Performance Budget for Visual Design

Visual quality must not come at the expense of performance.

Priorities:

```text
Fast page load
    ↓
Product visibility
    ↓
Interaction responsiveness
    ↓
Decorative effects
```

3D, video and heavy animations must always be secondary to the shopping experience.

---

# 53. Design Anti-Patterns

Avoid:

- Excessive gradients.
- Excessive glassmorphism.
- Excessive 3D.
- Excessive animations.
- Huge text everywhere.
- Low-contrast text.
- Tiny mobile controls.
- Too many popups.
- Fake urgency.
- Cluttered product cards.
- Excessive badges.
- Inconsistent spacing.
- Random colors.
- Multiple unrelated font families.

---

# 54. 3D Anti-Patterns

Do not:

- Make every product 3D.
- Load large 3D models immediately on page load.
- Use 3D behind important text if it reduces readability.
- Use continuous CPU/GPU-heavy animations.
- Require WebGL for basic shopping.
- Use 3D merely because it is technically impressive.

3D should answer:

> **Does this improve the customer's understanding or perception of the product/brand?**

If not, use normal imagery.

---

# 55. Design Tokens

The implementation should centralize design tokens where practical.

Example conceptual structure:

```text
colors
typography
spacing
radius
shadows
transitions
breakpoints
```

Components should consume these tokens rather than scattering arbitrary values throughout the application.

---

# 56. Design Implementation Priority

When implementing visual features:

```text
1. Layout
2. Typography
3. Product imagery
4. Spacing
5. Colors
6. Components
7. Interaction
8. Animation
9. 3D enhancement
```

3D should never be used to compensate for weak layout or poor product presentation.

---

# 57. Design Success Criteria

The LuxeCart storefront should feel:

- Premium within the first few seconds.
- Easy to navigate.
- Product-focused.
- Trustworthy.
- Fast.
- Modern.
- Distinct from generic e-commerce templates.

The customer should notice the brand first and the technology second.

---

# 58. Design Decision Summary

| Area | Decision |
|---|---|
| Visual Direction | Premium modern fashion |
| Market | India |
| Theme | Light-first |
| Primary Background | Warm ivory |
| Primary Accent | Warm luxury brown |
| Display Font | Playfair Display |
| Interface Font | Inter |
| Icons | Lucide React |
| CSS | Tailwind CSS |
| Storefront | Editorial + commerce |
| Admin | Functional + information-dense |
| 3D | Strategic, optional |
| 3D Stack | React Three Fiber + Three.js |
| 3D Assets | Optimized GLB/GLTF |
| 3D Fallback | Static image |
| Motion | Subtle |
| Accessibility | Required |
| Responsive | Mobile-first considerations |
| Performance | Priority over decoration |

---

# 59. Document Status

**Design Version:** 1.0  
**Project:** LuxeCart  
**Status:** Design system defined  
**Next Documentation:** `Phases.md`
