# Plan 1 – Global Style Foundation

## Objective
Set a responsive, token-driven baseline that makes every page adaptive before touching individual components.

## Key Context
- PRD emphasizes a mobile-friendly library/read/discover experience and a responsive onboarding/feedback flow.
- Global styles currently import tokens but lack responsive `font-size`, spacing, or layout constraints.

## Steps
1. **Enrich tokens** (`src/styles/tokens.scss`)
   - Define custom properties such as `--type-base`, `--type-heading`, `--space-xs`/`--space-sm`/`--space-lg`, `--layout-max-width`, `--page-padding`. Use `clamp()` when defining fonts/spacings (e.g., `--type-base: clamp(0.9rem, 1.8vw, 1.1rem);`).
   - Expose ratio helpers (e.g., `--grid-gap: clamp(0.75rem, 1.5vw, 1.5rem);`).
2. **Responsive root styles** (`src/styles.scss`)
   - Set `html { font-size: clamp(14px, 1.5vw, 16px); }` and `body { padding-inline: clamp(1rem, 5vw, 2.5rem); }`.
   - Ensure `width: 100%; min-height: 100vh;` and `position: relative;` stay intact but integrate new tokens for padding/backdrop.
3. **Layout helper class**
   - Introduce a `.page-wrapper` class (or mixin) that uses `width: min(100%, var(--layout-max-width)); margin-inline: auto; padding-block: var(--space-lg);` so every route/container can reuse it for consistent horizontal breathing room.
   - Encourage pages to wrap their main `<main>` content in this helper to avoid writing per-component width logic.
4. **Typography du jour**
   - Update body font declarations to use new tokens (e.g., `font-size: var(--type-base); line-height: clamp(1.4, 1.5vw, 1.6);`).
   - Consider setting `color: var(--mat-sys-on-surface);` and `background-color: transparent` to keep theme-controlled.
5. **Viewport normalization**
   - Confirm `body`/`html` still have `box-sizing: border-box` (already present). Add `img, svg { max-width: 100%; height: auto; }` to prevent overflow.

## Deliverables
- Updated tokens file with responsive spacing/type variables.
- `styles.scss` referencing new tokens + `.page-wrapper` definition.
- Documented usage pattern (via comments) so component owners know how to wrap their content.
