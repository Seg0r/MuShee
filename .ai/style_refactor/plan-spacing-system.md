# Plan 4 – Adaptive Spacing & Typography System

## Objective
Implement a spacing/type design system based on custom properties and `clamp()` so every component shares consistent rhythm and scales without duplicating breakpoints.

## Key Context
- Current spacing/padding definitions are scattered in component SCSS, leading to inconsistent touch areas and overflow.
- PRD interactions (song tiles, dialogs, forms) need predictable spacing regardless of viewport.

## Steps
1. **Define spacing/type tokens**
   - Add tokens in `src/styles/tokens.scss`: `--space-xs`, `--space-sm`, `--space-md`, `--space-lg`, `--space-xl`, and `--line-height-base`, all using `clamp()` to adapt between, e.g., `clamp(0.5rem, 1vw, 0.75rem)`.
   - Introduce typography tokens like `--type-base`, `--type-body`, `--type-heading`, each referencing `clamp()` for size and optionally line height/sp letter spacing (align with Material tokens if possible).
2. **Apply tokens in components**
   - Replace hard-coded paddings/margins with `var(--space-*)` values in `.library-header`, `.empty-state`, `.fab-container`, etc.; prefer `gap` for consistent spacing instead of manual `margin` on child elements.
   - Use `clamp()` for card spacing (e.g., `padding: clamp(0.75rem, 1.6vw, 1.25rem);`) to keep inner content legible on small screens and not too loose on large ones.
3. **Responsive typography mixin**
   - Create a mixin (or SCSS placeholder) that sets `font-size`, `line-height`, and optionally `letter-spacing` for headings/body text via tokens, so future components can `@include responsive-text(heading-lg);`.
   - Ensure text in dialogs and tiles uses these tokens to stay consistent with global typography while scaling gracefully.
4. **Touch target spacing**
   - For interactive components (buttons, icon buttons), set `padding: clamp(0.5rem, 1vw, 0.75rem); min-height/min-width: clamp(44px, 5vw, 52px);` so the layout remains comfortable on phones.
   - Add `gap: var(--space-sm);` between stacked elements (e.g., thumbs up/down buttons, library item actions) to avoid cramped UI.
5. **Document the system**
   - In each plan file (especially this one) include comments referencing the tokens/mixins so implementers know where to apply them.
   - Mention any exceptions (e.g., sheet music viewer may require bespoke spacing due to rendering canvas) and how to keep those cases compatible.

## Deliverables
- Token definitions with `clamp()` that are referenced by components for padding/margins/typography.
- Mixins/placeholders for consistent spacing/typography usage.
- Instructions in SCSS files for using the new tokens when adding responsive spacing.
