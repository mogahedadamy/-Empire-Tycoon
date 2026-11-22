# Architecture — Browser-Native Strategy Game

## Stack decision
TypeScript strict mode; browser APIs and Canvas/WebGL renderer (evaluate PixiJS or direct WebGL after benchmark); Capacitor shell for Android/iOS; Vite for web bundling; optional React for application UI; Node/TypeScript backend as a provisional choice. Do not introduce Unity, Unreal, Godot, or a bespoke native C++ engine.

Capacitor packages a web application and exposes native plugins; it does not supply simulation, renderer, backend, or UI design.

## Logical layers
- apps/web: browser bootstrap, responsive shell and UI.
- apps/mobile: Capacitor config and native bridge adapters.
- packages/simulation: pure headless TypeScript state transition engine, no DOM/Capacitor imports.
- packages/gameplay: commands, economy, construction, factions, research, missions, AI.
- packages/renderer: visual projection, camera, scene graph, assets, effects.
- packages/ui: reusable accessible components, tokens, navigation, HUD.
- packages/contracts: versioned commands, state snapshots, events, DTOs.
- services/server: future authoritative simulation, auth and matchmaking.
- tools: content validation, map editors, build and test tooling.

## Data flow
Input/UI -> typed Command -> validation -> deterministic-capable fixed-step simulation -> immutable read model/events -> renderer + UI + audio. Save/load and replay consume versioned canonical state. AI submits the same commands as players.

## Simulation invariants
- No wall-clock, DOM, random global calls or network access in core tick.
- Fixed tick; explicit seeded PRNG; stable entity IDs and processing order.
- Integer/fixed-point math for state-affecting calculations where needed.
- Ownership and resource constraints checked server-side for online.
- State hashes, replays, versioned saves, migration tests.
- SoA/ECS-like processing only where profiling justifies it; composition by default.
- Avoid unbounded allocation and long synchronous pathfinding on the UI thread; consider Web Workers with measured serialization cost.

## Online
Competitive play uses an authoritative server, not trusted clients. Evaluate command replication vs state snapshots based on bandwidth, cheating and latency tests. Single-player runs same core locally. Online backend is a separate deployment lifecycle.

## Rendering & UX
Start with a 2D/isometric performance spike. Use WebGL for map/world rendering and semantic DOM UI for controls and accessibility; avoid rendering every HUD control inside canvas. Responsive layout, touch targets, keyboard and pointer support, reduced motion, RTL-ready localization.

## Nonfunctional targets (provisional)
Measure on named low/mid/high reference devices. Target responsive UI, stable simulation tick, crash-free sessions, memory ceilings, first meaningful interaction time. Define numeric budgets after profiling.

## Open ADRs
Rendering library, UI framework, world camera, backend transport, offline save strategy, minimum mobile devices, asset formats and monetization.
