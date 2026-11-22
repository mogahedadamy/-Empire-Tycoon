/** Public API for creating and replaying headless business simulation sessions. */
export { daysPerMonth, maxAdvanceDays } from './clock';
export type { CloseContext, ClosePhase, PhaseSchedule, PhaseWork } from './clock';
export { createSimulationSession, replaySimulation } from './session';
export type { SessionOptions, SimulationSession } from './session';
export type { StagedAdvance } from './session';
export { createFinancialSimulation } from './finance-session';
export type { FinancialSimulationOptions } from './finance-session';
export { readLiquidityInput } from './liquidity';
export type { LiquiditySnapshot } from './liquidity';
