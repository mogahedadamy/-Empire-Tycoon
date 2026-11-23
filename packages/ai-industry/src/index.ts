/** Public API for the AI-sector founding comparison, command and save. */
export { foundAiCompany, quoteAiFounding } from './founding';
export type { AiFoundingCommand, AiFoundingQuote, AiFoundingReceipt } from './founding';
export { createAiFoundingRepository } from './save';
export { createProcurementSession, replayProcurement } from './procurement/session';
export type { ProcurementSessionOptions } from './procurement/session';
export { ProcurementError } from './procurement/types';
export type { ComputeJob, ProcurementAction, ProcurementCommand } from './procurement/types';
