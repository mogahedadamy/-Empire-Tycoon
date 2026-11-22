# Production Roadmap & Hiring Gates

## Stage 0: Days 1–15
Confirm game subgenre, camera, devices, budget, visual ambition; appoint CTO/architecture, game design, UX/art, technical production. Publish product charter and technical risk register.

## Stage 1: Days 16–30
Architecture spike: TypeScript simulation, WebGL renderer benchmark, Capacitor test builds, touch interaction prototype, CI. Decide UI library and asset pipeline via ADR.

## Stage 2: Days 31–60
Playable core: select units, pan/zoom, place buildings, produce resources, deterministic tick, basic save/load, first UI kit components.

## Stage 3: Days 61–90
Vertical-slice feasibility review: one map, 2 resources, 3 buildings, one mission, responsive HUD, accessibility, performance measurements on real devices, online transport spike.

## Longer horizon
Preproduction -> vertical slice -> production -> alpha -> beta -> launch/live operations. Expansion to 350 FTE is a ceiling planning scenario, not an immediate hiring order. Staffing ramps only after measured technical/product gates.

## Milestone exit criteria
Playable artifact; tests and reproducible build; recorded device benchmarks; UX usability feedback; top risks and cost forecast; explicit go/no-go by accountable leadership.

## Risks
WebView rendering limits; battery/thermal; large-world performance; deterministic replay across devices; cheating; content production throughput; UI complexity; accessibility/localization; scope creep. Maintain risk owner and mitigation per item.
