# Plan 2 – Responsive Layout Containers

## Objective
Refactor the main structural wrappers (`app-shell`, `library`, `discover`, etc.) so they rely on responsive Flexbox/Grid layouts, adaptive padding, and max-width constraints instead of fixed height/padding values.

## Key Context
- Library/discover views currently use tall scroll containers with hardcoded padding (see `.library-container`, `.scroll-container`).
- PRD workflows require long lists (personal songs, public library) plus onboarding/modal flows that should stack elegantly on phones.

## Steps
1. **Introduce shared container mixin/class**
   - Reuse `.page-wrapper` from the global plan in `app-shell.component.scss` so the shell centers content and caps width (use `max-width: var(--layout-max-width);` and `padding-inline: clamp(1rem, 4vw, 2rem);`).
   - Ensure `app-shell`’s background, nav, and main section align with the global spacing tokens and don’t introduce extra horizontal scrolling.
2. **Update `.library-container` & `.library-header`**
   - Replace `height: 100%` with `min-height: 100vh` if needed, but allow natural growth. Switch `.library-header` to `flex-wrap: wrap; gap: var(--space-sm);` so its title/actions stack on small screens.
   - Add `padding-block: var(--space-lg); padding-inline: clamp(1rem, 4vw, 2rem);` and align the header to the `page-wrapper` width by centering it inside the new layout helper.
3. **Streamline scrolling areas**
   - For `.loading-state` / `.scroll-container`, keep `flex: 1; overflow-y: auto;` but add `padding-inline: clamp(1rem, 4vw, 2rem);` so content respects responsive margins.
   - Replace `scrollbar` customizations with selective `max-width` logic to avoid overflow on small screens; if necessary, wrap scroll areas in a `min-height` sentinel instead of forcing huge vertical padding.
4. **Discover & viewer layouts**
   - For `discover` and `sheet-music-viewer`, ensure their root wrappers follow the `page-wrapper` width/padding and convert horizontal layouts to `display: grid` with `grid-template-columns` that collapse (e.g., `repeat(auto-fit, minmax(280px, 1fr))`).
   - Ensure viewer controls/actions sit below the sheet music on mobile by stacking them with `flex-direction: column` and adding `gap: var(--space-sm)`.
5. **FAB/CTA placement**
   - Keep `.fab-container` fixed but adjust `bottom`/`right` using `clamp()` or tokens (e.g., `bottom: clamp(1rem, 3vw, 2rem); right: clamp(1rem, 3vw, 2rem);`) so they don’t overlap with content on small screens.
   - Ensure any icons or buttons near the edge have extra padding to avoid conflicting with safe areas.

## Deliverables
- Layout wrappers updated with the shared helper, responsive padding, and gap-based Flexbox/Grid.
- Scroll/secondary containers sized with `clamp` margins, enabling them to live inside the max-width wrapper without overflow.
- Documentation (comments) describing how to use these wrappers for future components.
