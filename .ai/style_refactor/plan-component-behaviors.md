# Plan 3 – Component-Level Responsive Behaviors

## Objective
Ensure every complex component (headers, navigation, lists, dialogs, feedback controls) adapts across breakpoints while keeping PRD interactions (upload, AI suggestions, feedback) easy to use on mobile.

## Key Context
- Tiles, dialogs, and feedback controls currently use desktop-focused layouts with fixed widths/paddings.
- The PRD requires clear onboarding, upload, AI suggestion modals, and thumbs-up/down feedback that must remain tactile on phones.

## Steps
1. **Navigation & header actions**
   - For `app-shell`/`library-header`, allow action groups to wrap via `flex-wrap: wrap` and `gap: var(--space-sm)` under `@media (max-width: 640px)`.
   - Collapse secondary actions (e.g., logout, settings) into a `mat-menu` or vertical stack that only shows when space is limited.
2. **Song tiles & list items**
   - Convert `.song-tile`, `.library-grid`, etc., to `display: grid` with `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-2);` so tiles shrink/stack naturally.
   - Ensure each tile contains composer/title at the top, metadata & controls stacked below, and any action buttons (delete, add to library) wrapped in a fluid layout that goes columnar at `< 600px`.
3. **Dialogs and overlays**
   - Apply Material overrides using mixins (e.g., `@include mat.dialog-overrides` or `.mdc-dialog__surface`) to set `width: min(90vw, 440px)` and responsive padding (`padding: clamp(1rem, 2vw, 1.5rem);`).
   - For onboarding (FR-7) ensure the modal cards stack vertically on mobile with clear action buttons; use `gap: var(--space-lg)` when columns collapse.
   - For the suggestions dialog, ensure the loading state, error state, and results list can scroll within the modal without overflowing the viewport height.
4. **Feedback controls (thumbs-up/down)**
   - Wrap icon buttons inside padded containers and use `min-width: 44px; min-height: 44px;` along with `margin-inline: var(--space-sm)` so the controls stay spaced on narrow screens.
   - Add `aria-labels` and focus-visible styles to maintain accessibility when the layout changes.
5. **Forms & inputs (upload, login, registration)**
   - Stack form fields vertically by default with `width: 100%` and `gap: var(--space-sm)`; at `min-width: 768px` they can align horizontally if necessary.
   - Ensure file upload controls don’t create horizontal scroll by using `max-width: 100%;` and `text-align: center` for helper text.

## Deliverables
- Each component has responsive Flexbox/Grid definitions plus clear fallback at `min-width` breakpoints.
- Dialogs & modals sized with `clamp()` so they stay legible on phones and don’t exceed viewport height.
- Feedback icons/form controls maintain touch-friendly sizing even as the layout stacks.
