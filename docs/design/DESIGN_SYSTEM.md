# Empire Tycoon — UI/UX Design System v0.1

## Creative direction
**Imperial Cartography**: a premium strategy command interface, combining sophisticated mapmaking, architectural detail, rich depth and crisp modern usability. Avoid generic neon dashboards, cluttered fantasy ornament, and copied game IP.

## Visual language
- Base surfaces: ink navy #101C2A; raised slate #1C2D3D; parchment #F3EAD8.
- Accent: antique gold #D6AD62 for meaningful emphasis; teal #46B7AA for positive/selection; danger coral #D66B61.
- Text: warm white #F7F4ED on dark surfaces; ink #172330 on light.
- Type: highly legible UI sans with Arabic coverage; optional editorial serif for major titles only; never sacrifice numeric readability.
- Shape: disciplined 8px spacing grid, restrained radii, 1px separators, purposeful elevation.
- Motion: 120–240ms feedback, cinematic transitions only where non-blocking; honor reduced-motion.
- Iconography: coherent 24px grid, clear silhouettes, always paired with labels for critical actions.

## UX pillars
Map-first interaction; visible economic feedback; discoverable contextual actions; undo/confirm destructive actions; progressive disclosure; responsive information density; excellent onboarding; accessibility as baseline.

## Core screens
1. Splash / account / offline entry.
2. Empire overview and campaign map.
3. Main world: top resource bar, contextual left rail, selection inspector, bottom action dock, minimap.
4. Construction catalogue and placement preview.
5. Research tree and dependencies.
6. Diplomacy and trade.
7. Army composition and battle command panel.
8. Multiplayer lobby, matchmaking, reconnect and result states.
9. Settings: accessibility, graphics, controls, language, privacy.
10. Save/load and conflict resolution.

## Interaction contracts
- Touch: generous target sizes (aim >=44x44 CSS px); no hover-only affordances; pinch/drag/pan gestures must not conflict with scrolling.
- Desktop: keyboard shortcuts, pointer hover, focus rings, tooltip support.
- Responsive: phone uses bottom navigation and modal sheets; tablet uses split panels; desktop uses dockable panels.
- RTL: Arabic-first readiness, mirrored directional controls where appropriate; map and numerical data remain logically consistent.
- Accessibility: semantic DOM, contrast checks, screen reader labels, keyboard navigation, color-blind-safe status encoding, scalable text.
- Loading: skeletons, progress and recoverable error states. No decorative animation blocking gameplay.

## Component inventory
Button, IconButton, ResourceCounter, StatDelta, Tooltip, Modal, Drawer, BottomSheet, Tabs, Toast, Progress, UnitCard, BuildingCard, TechNode, MapMarker, SelectionPanel, CommandPalette, ConfirmationDialog, EmptyState, ErrorState.

## Design workflow
Research -> information architecture -> wireframes -> interactive prototype -> usability review -> tokens/components -> implementation -> visual QA and accessibility checks. Designers own UX intent; engineers own feasible implementation. Record design rationale.

## Acceptance
Every screen has loading/empty/error states, touch and keyboard behavior, narrow-width layout, RTL review, contrast and text-scale checks, and measurable task success criteria.
