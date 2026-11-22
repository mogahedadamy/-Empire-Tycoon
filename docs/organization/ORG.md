# Organization, Teams and Decision Rights

## Executive triad
CEO: funding and business strategy. CTO: technical strategy, architecture and engineering risk. Game Director: creative direction, mechanics, UX vision. Executive Producer: schedule, staffing, delivery coordination. These are parallel responsibilities, not a CTO reporting chain.

## Peak staffing model — 350 FTE, illustrative
| Group | FTE | Accountability |
|---|---:|---|
| Engine/web runtime & core | 55 | Web runtime, rendering, tools, assets, platform |
| Gameplay & simulation | 52 | Features, deterministic rules, campaigns |
| Networking & backend | 28 | Authoritative services, accounts, transport |
| AI & strategy systems | 24 | Planning, navigation, opponent AI |
| Game & level design | 30 | Mechanics, maps, balance, progression |
| Art, animation & technical art | 75 | World visuals, VFX, content pipeline |
| QA & automation | 35 | Test infrastructure, compatibility, accessibility |
| DevOps, build & tools | 18 | CI, builds, deployments, developer productivity |
| Audio, narrative & UX | 17 | Audio, narrative, research, interaction design |
| Production & leadership | 16 | Delivery, staffing, program management |
| **Total** | **350** | Planning estimate only |

**Capacitor pivot:** these legacy budget categories must be revalidated. Replace traditional engine-heavy staffing with web rendering, mobile performance, UI/UX, and tooling roles as discovery results dictate.

## Functional ownership and cross-functional squads
- Platform & Runtime: web rendering, assets, performance, Capacitor bridges.
- Simulation & Gameplay: world state, commands, economy, construction, combat, AI.
- Online: authentication, matchmaking, dedicated authoritative simulation, observability.
- Experience: UI engineering, interaction design, design system, accessibility, localization.
- Content: art, technical art, levels, sound, narrative.
- Quality & Delivery: QA, CI/CD, release, security, production.
Feature squads borrow experts from functional departments; each feature has one accountable owner.

## Decision matrix
| Decision | Final owner | Consult |
|---|---|---|
| Budget and major investment | CEO | CTO, Producer |
| Game rules and creative direction | Game Director | Design, UX, CTO |
| Runtime architecture and stack | CTO | Principal Engineers |
| Simulation protocol | Principal Simulation Lead within CTO-approved constraints | Online, QA |
| UI design direction | UX/Art Director with Game Director | Accessibility, Engineering |
| Release readiness | Release committee | QA, CTO, Game Director, Producer |
| Hiring | Functional manager | Tech Lead, HR |
| Feature acceptance | Feature owner + Design owner | QA |

## Governance
ADRs for cross-module decisions. Protected branches, review ownership, weekly architecture sync, sprint demos, monthly performance/risk reviews. Escalate security, cost, privacy, or irreversible scope decisions.
