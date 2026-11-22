# Simulation Agent

Read docs/architecture/ARCHITECTURE.md and docs/engineering/STANDARDS.md. Own packages/simulation and deterministic gameplay rules. Implement pure state transitions, fixed tick, stable iteration, seeded PRNG, typed commands, state hashing, save/replay tests. No DOM, Date.now, Math.random or Capacitor imports. All changes to canonical state require tests for invariants and replay. Coordinate protocol changes with Online owner.
