# Empire Tycoon — Agent Operating Contract

This is the root instruction file for all coding/design agents. **Always read this file before acting.** For each task, identify affected paths and read the linked domain guide(s) BEFORE editing. Do not ask the CEO to route routine tasks.

## Automatic task routing
| Task keywords / paths | Mandatory instructions | Primary owner |
|---|---|---|
| Product, rules, monetization, balance | docs/product/CHARTER.md; docs/agents/game-design.md | Game Design |
| Simulation, entities, economy, combat, AI | docs/architecture/ARCHITECTURE.md; docs/agents/simulation.md | Simulation |
| Renderer, map, sprites, animation, performance | docs/agents/rendering.md; docs/design/DESIGN_SYSTEM.md | Rendering |
| UI, UX, screens, layout, icons, typography, accessibility | docs/design/DESIGN_SYSTEM.md; docs/agents/ui-ux.md | UI/UX |
| Capacitor, Android, iOS, native bridges | docs/agents/mobile.md; docs/architecture/ARCHITECTURE.md | Mobile |
| Multiplayer, accounts, persistence, networking | docs/agents/backend.md; docs/architecture/ARCHITECTURE.md | Online |
| Tests, build, CI, release, security | docs/engineering/STANDARDS.md; docs/agents/quality.md | Quality/Platform |
| Architecture, dependencies, organizational decisions | docs/organization/ORG.md; docs/architecture/ADR-0001.md | CTO/Architecture |

## Mandatory execution loop
1. Read the relevant instructions and existing code; identify requirements and acceptance criteria.
2. Classify work as **routine**, **architectural**, **product/design**, or **high risk**. Record assumptions.
3. Write or update a scoped task plan and list impacted modules; avoid unrelated changes.
4. Implement the smallest coherent change respecting module public APIs and component ownership.
5. Add appropriate unit, integration, UI, accessibility, determinism, and/or performance tests.
6. Run available checks; report commands, results, and any unverified behavior honestly.
7. Update docs/ADRs when contracts or architectural decisions change; summarize changed files and risks.
8. Open a PR for review; never bypass required checks or self-approve high-risk changes.

## Autonomy boundaries
Agents may independently route, plan, implement, test, and document routine work. Do not claim background autonomous execution unless an actual runner is configured. Do not deploy production, purchase services, expose secrets, delete data, or change security/financial policy without explicit authorized approval. Product scope and architectural reversals require owners in docs/organization/ORG.md.

## Definition of Done
Functional acceptance criteria met; code readable and modular; tests passing or documented blocker; no secrets; accessible UI where applicable; performance budget checked; docs updated; no broken existing behavior.

## Dependency direction
apps -> game feature APIs -> simulation contracts; presentation never mutates simulation directly. Native adapters are isolated. Backend validates all competitive commands.

## Conflict priority
Explicit current task > security and safety constraints > ADRs and product charter > this root file > domain guides > local conventions. Escalate contradictory requirements; never silently override an approved ADR.
