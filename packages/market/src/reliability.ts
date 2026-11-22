/** Derives the next reliability rating from actual, accepted delivery performance. */
import { applyBasisPoints } from '../../finance/src';

export interface ReliabilityObservation {
  readonly promisedUnits: number;
  /** Units accepted by the buyer on time, after any defect or shortfall. */
  readonly onTimeAcceptedUnits: number;
}

/** Smooths the latest observation into the previous rating. Throws on invalid ratings or units. */
export function updateMarketReliability(previousBps: number, observation: ReliabilityObservation, weightBps: number) {
  const { promisedUnits, onTimeAcceptedUnits } = observation;
  if ([previousBps, weightBps].some((n) => !Number.isSafeInteger(n) || n < 0 || n > 10_000) ||
      !Number.isSafeInteger(promisedUnits) || promisedUnits < 1 || !Number.isSafeInteger(onTimeAcceptedUnits) ||
      onTimeAcceptedUnits < 0 || onTimeAcceptedUnits > promisedUnits) {
    throw new RangeError('Invalid market reliability observation');
  }
  const promised = BigInt(promisedUnits);
  const observedBps = (BigInt(onTimeAcceptedUnits) * 10_000n + promised / 2n) / promised;
  return previousBps + Number(applyBasisPoints(observedBps - BigInt(previousBps), weightBps));
}
