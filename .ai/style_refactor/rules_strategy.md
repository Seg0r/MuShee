# Style Refactor Rules & Strategy

**Purpose**: Guide the responsive redesign effort so MuShee’s mobile experience stays aligned with the PRD workflows (song library, sheet music renderer, AI suggestions, onboarding/feedback) while respecting Angular 19 + Material 19 best practices.

## Core Constraints
- **Mobile-first baseline**: Design for the smallest viewport first; enhancements for tablets/desktops should be written with `@media (min-width: ...)` so the base cascade naturally fits phones.
- **Material v19 compliance**: Use `@angular/material` tokens/mixins (`mat.theme`, `mat.*-overrides`) and MDC custom properties (`--mdc-*`) instead of any deprecated v20 APIs or `::ng-deep` selectors.
- **Touch & accessibility**: Maintain ≥44px tap targets, clear visual states for thumbs up/down feedback, and ensure dialogs/menus have sufficient padding for finger interaction and screen readers.
- **Custom property system**: Define spacing/type tokens (e.g., `--space-sm`, `--type-base`, `--layout-max-width`) so spacing, typography, and layout scales can be adjusted centrally.
- **Feature preservation**: Keep onboarding modals, library tiles, AI suggestion flows, and feedback controls fully functional/responsive so the PRD success metrics (thumbs-up ratios) remain targetable on mobile.
- **Testing discipline**: After SCSS changes run `npm run lint` and the build script, and verify breakpoints at 320, 375, 428, 768, 1024, 1440 while exercising key flows (upload, discover, AI suggestions, rating flows).

## Implementation Guidance
- Structure the work in additive stages (global styles → layout containers → component behaviors → spacing system) so each plan file can be executed independently while staying consistent with these rules.
- Use `clamp()` for font sizes/gaps where possible and prefer relative units (`rem`, `%`, `vw`) over fixed pixels.
- Document any divergence from these rules before implementation so reviewers understand why (e.g., when a component must keep a fixed width for OpenSheetMusicDisplay).
