# Engineering Standards

## Required
Strict TypeScript; explicit public APIs; small cohesive modules; composition over deep inheritance; SOLID where beneficial; no God Objects or uncontrolled singletons; data-oriented hot paths after profiling; no circular package dependencies; typed commands and events; deterministic simulation boundaries.

## Quality gates
Format, lint, typecheck, unit tests and dependency checks on PR; integration and replay/determinism tests on merge/nightly; device performance, accessibility, network soak and security checks before release. Never fabricate passing tests.

## Testing
Unit: economy, costs, damage, invariants. Property-based: no invalid resources/ownership. Determinism: identical commands/seed -> canonical hashes. Integration: save/load, commands, renderer adapter. E2E: mobile touch, onboarding, accessibility. Security: untrusted commands and storage. Performance: map draw time, memory, tick latency, thermal behavior.

## Code review
At least one qualified reviewer; high-risk security, persistence, protocol and architectural changes require domain owner. Protected main branch; CI required. ADR for changes to package boundaries or runtime strategy.

## Definition of Done
Acceptance criteria, tests, a11y and performance impact, documentation, observability, migration/rollback as applicable. Never commit secrets, credentials, generated native build outputs or third-party licenses without review.

## Metrics
P95 frame time, tick duration, memory, crash-free sessions, build latency, flaky tests, defect escape rate, MTTR. Do not use lines of code as productivity measure.
