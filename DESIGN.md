# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-08-29
- Primary product surfaces: Home, services, tyre availability, contact, blog index, two article routes, shared navigation/footer, cookie notice, mobile navigation.
- Evidence reviewed: `README.md`, `VALIDATION.md`, `index.html`, `app.js`, `styles.css`, `tyre-api.js`, `site-utils.js`, `server.py`, automated tests, all source imagery and brand logos, and fresh full-page captures of every route at 1440px, 768px, and 390px under `artifacts/redesign-baseline/`.

## Brand
- Personality: Direct, capable, industrious, local, reassuring, and value-conscious. The visual identity should feel like a well-run Sheffield workshop rather than a luxury dealership or generic software company.
- Trust signals: 5-star customer quotes, 20 stocked tyre brands, seven-day opening, a real workshop address, real workshop/gallery imagery, direct telephone/WhatsApp access, and a practical registration lookup.
- Avoid: Racing-game neon, luxury-car gloss, generic SaaS cards, decorative gradients, glassmorphism, fake review-widget chrome, inflated evidence, excessive pills, or motion without an interaction purpose.

## Product goals
- Goals: Make checking tyre availability the unmistakable primary action; make urgent call/WhatsApp access immediate; communicate local credibility and service breadth; preserve SEO-rich automotive content and existing integrations.
- Non-goals: Rebuild the application stack, invent an e-commerce checkout, obscure existing hours/address/contact details, or present the availability enquiry as confirmed ordering.
- Success signals: Visitors can identify the business, location, services, and primary action in the opening viewport; the tyre and contact forms remain usable; all routes render cohesively without overflow or broken behavior at desktop, tablet, and mobile.

## Personas and jobs
- Primary personas: Sheffield motorists needing replacement tyres or puncture help, often on a phone and sometimes under time pressure.
- Secondary personas: Drivers looking for routine servicing, price/value reassurance, directions, opening hours, or practical car-care guidance.
- User jobs: Find suitable tyres by registration; confirm stock and pricing; call or message the garage; understand available services; find the workshop; decide whether the business is trustworthy.
- Key contexts of use: Mobile-first urgent visits, local search traffic, poor/variable network conditions, and quick comparison before calling.

## Information architecture
- Primary navigation: Home, Services, Advice, Contact, Find Tyres.
- Core routes/screens: `/`, `/services`, `/blog`, `/blog-post`, `/blog-post1`, `/contact-us`, `/order-your-tyres-online`, and the existing not-found surface.
- Content hierarchy: Primary tyre finder and call action; local/service promise; proof; service breadth; workshop evidence; hours/location; supporting advice.

## Design principles
- Conversion before inventory: Lead with the registration finder and urgent contact paths; move the full brand range into supporting proof.
- Workshop, not template: Use an editorial industrial composition, strong type, square geometry, real imagery, and service-bay signage cues instead of generic rounded-card repetition.
- Honest evidence: Show the three available review quotes without simulated third-party widget controls or unverified totals.
- Calm confidence: Use contrast, scale, whitespace, and alignment as the main visual tools. Decoration must reinforce workshop/road/registration cues.
- Mobile is a distinct layout: Prioritise wordmark, call, finder, and thumb-friendly controls; simplify gallery and navigation rather than merely shrinking desktop.
- Tradeoffs: Existing photography is embedded in large reference composites, so the redesign will art-direct the owned crops through the current source-media system while avoiding new dependencies.

## Visual language
- Color: Soft tyre charcoal `#151a21`; graphite `#242c36`; clean workshop canvas `#f3f6fa`; paper white `#ffffff`; steel `#5f6b7a`; cool line `#cfd8e5`; service cobalt `#1258d6`; bright service blue `#6aa2ff`; deep blue `#0a3c94`; alert red and WhatsApp green reserved for their functional states.
- Typography: `Barlow Condensed` for display, navigation, service numbering, and labels; `IBM Plex Sans` for body, forms, and utility copy. Use system fallbacks so the site remains legible without remote font delivery.
- Type scale: Hero 76/0.94 desktop, 58 tablet, 44 mobile; section headings 54/1.0 desktop down to 36 mobile; body 17/1.6 with 62–68ch maximum reading measure; uppercase utility labels 12–14 with measured tracking.
- Spacing/layout rhythm: 4px base with 8/12/16/24/32/48/72/96/128 steps. Sections use 96–128px desktop, 72px tablet, 56px mobile; intentional dense utility bands break up larger editorial sections.
- Shape/radius/elevation: 0/4/12px radius only; squared workshop blocks, 12px media/form surfaces, rare soft shadows, and strong 1px structural rules.
- Layout/grid: 1280px maximum content container; 12-column desktop with 32px gutters, six-column tablet with 24px gutters, four-column mobile with 18px side padding. Prefer asymmetric 7/5 and 5/7 compositions.
- Motion: 140–180ms hover/focus/press transitions, occasional 300ms menu or hero settling only. No decorative scroll animation. Preserve reduced-motion behavior and pause automatic carousel motion.
- Imagery/iconography: Authentic workshop crops, tyres, fitment activity, the supplied tyre wordmark artwork, full-colour manufacturer marks, the supplied WhatsApp mark, and an interactive Google Maps embed. Images receive confident square crops, restrained 12px radius, and occasional labelled overlays.

## Components
- Existing components to reuse: SPA header/footer shell, source-media crop system, tyre lookup logic, contact mailto flow, location/map section, review carousel logic, cookie choice, WhatsApp link, brand image list, and shared routing/focus handling.
- New/changed components: Explicit wordmark, desktop find-tyres header CTA, home hero tyre-finder panel, proof rail, labelled service ledger, honest review cards, editorial blog header/list, order-page process panel, contact decision paths, richer utility footer, and mobile bottom action dock.
- Variants and states: Yellow primary, dark secondary, light/outline tertiary; light/dark cards; compact/full tyre form; active navigation; hover/pressed/focus/disabled/loading/success/error/manual form states; open/closed mobile menu; visible/dismissed cookie notice.
- Token/component ownership: CSS custom properties and shared component selectors live in `styles.css`; structural page templates and behavior hooks stay in `app.js`.

## Accessibility
- Target standard: WCAG 2.2 AA intent for colour contrast, keyboard access, visible focus, semantics, responsive text, and touch targets.
- Keyboard/focus behavior: Preserve skip link, SPA main focus, `aria-current`, menu `aria-expanded`, form labels, live regions, and review pause control. Add clearly visible `:focus-visible` treatment and minimum 44px interactive targets.
- Contrast/readability: Use white/canvas against tyre black and graphite; reserve cobalt for CTAs, focus states and service-signage cues; use white text on blue controls and avoid low-contrast muted copy at small sizes.
- Screen-reader semantics: Keep semantic header/nav/main/footer, labelled forms, meaningful image labels/alts, iframe title, and buttons for actions. Decorative geometry remains hidden.
- Reduced motion and sensory considerations: Disable transforms/transitions when reduced motion is requested; never rely on colour or animation alone to convey state.

## Responsive behavior
- Supported breakpoints/devices: Large desktop around 1440px, tablet around 768px, mobile around 390px, with resilient behavior between 320px and wide desktop.
- Layout adaptations: Hero 7/5 desktop becomes stacked at tablet/mobile; service editorial split becomes a single ordered flow; gallery shifts from mosaic to two columns then one/two mixed mobile; forms become single-column; footer becomes stacked; mobile action dock replaces the isolated floating WhatsApp button.
- Touch/hover differences: 48px core controls, 44px minimum utility controls, persistent mobile call/find/WhatsApp access, no hover-only meaning, and menu content that keeps the primary conversion first.

## Interaction states
- Loading: Tyre finder disables the submit button, displays a concise progress message, and retains layout stability.
- Empty: Forms use helpful placeholders and clear labels; no content depends on placeholder-only instruction.
- Error: Field-level native validation plus visible live-region copy; errors use text and icon/structure, not colour alone.
- Success: Vehicle/fitment results use a high-contrast confirmation surface and a clear call-to-confirm next step.
- Disabled: Buttons retain readable text and use reduced opacity/cursor without disappearing.
- Offline/slow network: Existing manual email/call fallback remains visible when lookup is unavailable or times out.

## Content voice
- Tone: Plain-spoken, local, competent, and specific.
- Terminology: Prefer “Find tyres”, “Check availability”, “registration”, “workshop”, “call to confirm stock and price”, and “Sheffield”. Do not call an enquiry a completed order.
- Microcopy rules: Put the action first; keep urgent paths concise; use sentence case; correct obvious grammar/spelling while preserving SEO-relevant service and location language.

## Implementation constraints
- Framework/styling system: Dependency-free vanilla JavaScript SPA with a single global stylesheet and Python standard-library server. Preserve existing route and API contracts.
- Design-token constraints: Extend/replace the current CSS variables in `styles.css`; do not add a CSS framework or component library.
- Performance constraints: Reuse current owned assets and lazy loading; no new JavaScript or runtime dependencies; use resilient font fallbacks.
- Compatibility constraints: Current browser support and server public allowlist must remain valid; data hooks and form field names used by tests/capture tooling must be preserved.
- Test/screenshot expectations: `npm run check`, `npm test`, `git diff --check`, and full-page rendered audits for every route at 1440, 768, and 390px, plus mobile menu/cookie/review/tyre-manual interaction states.

## Open questions
- [ ] No blocking questions. Any future verified review totals or original high-resolution workshop photography can replace the conservative proof copy and sprite-based crops without changing the component system.
