/** Verifies published forecasts and replay parity through the simulation's market phase. */
import { expect, it } from 'vitest';
import { clearMarketDay, forecastMarket, type MarketDay } from '../../packages/market/src';
import { createSimulationSession, replaySimulation, type SessionOptions } from '../../packages/simulation/src';
import { options, snapshot, submit } from '../simulation/fixtures';
import { offers, scenario } from './fixtures';

function marketSession(seed = scenario.seed) {
  let results: readonly MarketDay[] = [];
  const sessionOptions: SessionOptions = {
    ...options, seed,
    prepareAdvance() {
      const staged: MarketDay[] = [];
      return {
        schedule: ({ phase, day }) => phase === 'market-alerts' ? [{
          id: scenario.market.id, virtualTime: 0, sequence: 0,
          run(nextRandomUint32) {
            staged.push(clearMarketDay(scenario.market, { day, offers, randomUint32: nextRandomUint32() }));
          },
        }] : [],
        commit() { results = [...results, ...staged]; },
      };
    },
  };
  return { sessionOptions, results: () => results };
}

it('forecasts the deterministic base, low, and high ranges without consuming a session draw', () => {
  const { market } = scenario;
  const { sessionOptions } = marketSession();
  const session = createSimulationSession(sessionOptions);
  const before = snapshot(session);
  const forecast = forecastMarket(market);
  expect(forecast.demandUnits).toEqual({ min: 73, max: 100 });
  expect(forecast.referencePriceMinor).toEqual({ min: '7680', max: '9200' });
  expect(forecast.baseline).toMatchObject({ shockId: null, referencePriceMinor: '8000', demandUnits: 100 });
  expect(forecast.scenarios.map(({ chanceBps }) => chanceBps)).toEqual([5900, 1400, 1800, 900]);
  expect(forecastMarket({ ...market, shocks: [...market.shocks].reverse() })).toEqual(forecast);
  expect(snapshot(session)).toEqual(before);
});

it('replays daily shocks and allocations from a fixed seed with the same result in batch and single days', () => {
  const batch = marketSession();
  const session = createSimulationSession(batch.sessionOptions);
  const reply = submit(session, 'market-month', 0, { type: 'advance', days: 30 });
  const step = marketSession();
  const stepped = createSimulationSession(step.sessionOptions);
  for (let i = 0; i < 30; i += 1) submit(stepped, `day-${i}`, i, { type: 'advance', days: 1 });
  const reopened = marketSession();
  const replayed = replaySimulation(reopened.sessionOptions, session.commandLog());

  expect(reply.outcome.status).toBe('accepted');
  expect(submit(session, 'market-month', 0, { type: 'advance', days: 30 })).toEqual(reply);
  expect(batch.results()).toHaveLength(30);
  expect(batch.results()).toEqual(step.results());
  expect(batch.results()).toEqual(reopened.results());
  expect(snapshot(session)).toEqual(snapshot(stepped));
  expect(snapshot(session)).toEqual(snapshot(replayed));
  expect(new Set(batch.results().map(({ conditions }) => conditions.shockId))).toEqual(new Set([
    null, 'harbor-festival', 'harvest-shortfall', 'retail-slowdown',
  ]));

  const different = marketSession(scenario.seed + 1);
  submit(createSimulationSession(different.sessionOptions), 'market-month', 0, { type: 'advance', days: 30 });
  expect(different.results()).not.toEqual(batch.results());
});
