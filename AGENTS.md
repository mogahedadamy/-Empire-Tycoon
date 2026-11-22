# AGENTS.md — Empire Tycoon

Start with [the product charter](docs/product/CHARTER.md), [the decision log](docs/architecture/DECISIONS.md), and [the task board](docs/production/TASKS.md). The current phase is design and documentation. Begin implementation when the owner asks to start or gives an implementation task. A task marked ready has enough information to start after that instruction. This phase does not prohibit ordinary implementation once authorized.

## Route work independently

1. If the request contains an ET ID, locate that exact record in [the task index](docs/production/tasks/index.json). Read its task file and every guide it names. If the owner says to start from the beginning or continue without an ID, choose the first ready task with completed dependencies in the index.
2. For an unnumbered feature request, match its intent to the board and its paths to the table below. If no task exists, create a task with its own file, owner, guides, dependencies and acceptance criteria, then add it to the index and board. Cross-domain tasks read every matching guide; select a single primary owner from the task.
3. Resolve the next routine design choice within the charter and task constraints. Record the assumption in the task or decisions log. Send unresolved approval items only to their accountable owner when the choice substantively changes accepted scope or a contract.
4. Follow the task scope and acceptance criteria. Test through the normal interface, record actual results, and update status, evidence and dependencies in the task/index. When opening a PR cite the ET ID and evidence.
5. A status of done needs evidence. After recording completion, mark any planned successor ready when all its dependencies are done and its stage gate is satisfied. Update both the index and affected task cards in the same change. Report failures and device checks still outstanding.

| Intent or path | Primary guide |
|---|---|
| Rules, campaigns, content, balance | [Game Design](docs/agents/game-design.md) |
| Ledger, cash, inventory, policies, market, contracts, time, simulation | [Simulation](docs/agents/simulation.md) · [Economy](docs/agents/economy.md) |
| Screens, UI, design system, localization, accessibility | [UI/UX](docs/agents/ui-ux.md) |
| Visual assets, chart rendering or maps | [Art and rendering](docs/agents/rendering.md) |
| Capacitor, iOS/Android, lifecycle or storage | [Mobile](docs/agents/mobile.md) |
| Server, seasons, matchmaking, persistence of online sessions | [Online](docs/agents/backend.md) |
| Test, CI, release, docs routing | [Quality](docs/agents/quality.md) |
| Ownership, scope changes, dependency rules | [Organization](docs/organization/ORG.md) · [Architecture](docs/architecture/ARCHITECTURE.md) |

## Code organization and file size

Use the feature folders and public entry points described in the [engineering standards](docs/engineering/STANDARDS.md#تنظيم-الميزات-وحجم-ملفات-الكود). Keep one cohesive responsibility per hand-written code file. Aim for 200 lines or fewer, review the split when approaching 200, and keep every such file at or below 350 physical lines after formatting. This also applies to UI, styles, tests, build scripts, and workflows. Split by responsibility and preserve the public contract and behavior. Keep inline module and public-contract documentation current, and record the feature entry point and test path in its task card.

Run the repository's file-size check before marking implementation done. [ET-001](docs/production/tasks/ET-001.md) defines its implementation and CI acceptance.

## Product invariants

The provincial grid under src/ is an earlier prototype. Use the product and task specs for rules and UX of the business game. Web technologies and Capacitor package the app with no game engine. The headless domain owns money and operational state; UI consumes read models and sends typed commands. Single-player and online share rules but retain separate authority and saves. Keep original content and assets. [Engineering standards](docs/engineering/STANDARDS.md) govern code and quality.

Repo instructions and the index guide task selection when an agent is invoked. An agent or service that consumes these files must be configured separately to execute unattended.
