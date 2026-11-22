/** Baseline for the phase A 30-day clock without operational rules or transport. */
import { performance } from 'node:perf_hooks';
import { simulationProtocolVersion } from '../packages/contracts/src';
import { loadScenario } from '../packages/content/src';
import { createSimulationSession } from '../packages/simulation/src';

const { id: sessionId, seed } = loadScenario('big-order');
const warmup = 50;
const iterations = 500;
const durations: number[] = [];

for (let index = 0; index < warmup + iterations; index += 1) {
  const session = createSimulationSession({ sessionId, seed });
  const start = performance.now();
  const result = session.handle({
    version: simulationProtocolVersion,
    type: 'command',
    sessionId,
    commandId: 'baseline',
    expectedRevision: 0,
    payload: { type: 'advance', days: 30 },
  });
  const duration = performance.now() - start;
  if (result.type !== 'result' || result.outcome.status !== 'accepted' ||
      result.outcome.progress?.lastClosedDay !== 30) throw new Error('Expected 30 closed days');
  if (index >= warmup) durations.push(duration);
}

durations.sort((left, right) => left - right);
const percentile = (value: number) => durations[Math.ceil(durations.length * value) - 1];
console.log(`Clock 30 days, ${iterations} samples: median ${percentile(.5).toFixed(3)} ms, p95 ${percentile(.95).toFixed(3)} ms`);
