# Empire Tycoon

AAA-aspiration strategy/tycoon game built **without a traditional game engine**. Browser-native TypeScript game runtime, Canvas/WebGL rendering, and Capacitor packaging for mobile. Web is a first-class target.

> Status: architecture and production foundation. No claim of finished gameplay or production-ready multiplayer.

## Start here
- [Agent routing](AGENTS.md)
- [Product charter](docs/product/CHARTER.md)
- [Architecture](docs/architecture/ARCHITECTURE.md)
- [Organization and decision rights](docs/organization/ORG.md)
- [UI/UX design system](docs/design/DESIGN_SYSTEM.md)
- [Delivery roadmap](docs/production/ROADMAP.md)
- [Engineering quality](docs/engineering/STANDARDS.md)

## Architecture principles
Deterministic-capable headless simulation; commands instead of direct state mutation; rendering as a projection of simulation; modular feature ownership; accessible responsive touch-first UI; backend authority for competitive online play.

## Important constraints
Capacitor is a native web application shell, **not** a renderer, simulation framework, or multiplayer backend. The web runtime implements those capabilities separately. Avoid prematurely promising AAA performance on all mobile hardware.

## Next milestone
Validate target devices and a playable vertical slice before expanding scope. See docs/production/ROADMAP.md.
