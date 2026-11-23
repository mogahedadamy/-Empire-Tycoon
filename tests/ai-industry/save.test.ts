/** Tests AI founding persistence, food-slot isolation, and optimistic writes. */
import { expect, it } from 'vitest';
import { createAiFoundingRepository, foundAiCompany, type AiFoundingCommand } from '../../packages/ai-industry/src';
import { loadAiScenario } from '../../packages/content/src/ai';
import { type SaveRecord, type SaveStore } from '../../packages/storage/src';

const scenario = loadAiScenario();
const aiSlot = 'single-player:ai:contract-before-launch';
const foodSlot = 'single-player:journey:big-order';
const now = () => '2026-01-01T00:00:00.000Z';
const first: AiFoundingCommand = { type: 'found-ai-company', pathId: 'specialized-api' };
const second: AiFoundingCommand = { type: 'found-ai-company', pathId: 'open-weight-hosting' };

function setup() {
  const food = { head: 'food-head', previous: 'food-backup' };
  const records = new Map<string, SaveRecord>([[foodSlot, food]]);
  const store: SaveStore = {
    async read(slot) { return records.get(slot) ?? null; },
    async compareAndSwap(slot, token, next) {
      if ((records.get(slot)?.head ?? null) !== token) return false;
      records.set(slot, next);
      return true;
    },
  };
  return { store, records, food };
}

it('commits one choice across two tabs and leaves the food save byte-for-byte intact', async () => {
  const { store, records, food } = setup();
  const left = createAiFoundingRepository(scenario, store, now);
  const right = createAiFoundingRepository(scenario, store, now);
  expect(await left.load()).toBeNull();
  expect(await right.load()).toBeNull();
  const results = await Promise.allSettled([
    left.confirm(first, foundAiCompany(scenario, first)),
    right.confirm(second, foundAiCompany(scenario, second)),
  ]);
  expect(results[0].status).toBe('fulfilled');
  expect(results[1]).toMatchObject({ status: 'rejected', reason: { code: 'write-conflict' } });
  expect(await right.load()).toEqual(first);
  expect(records.get(foodSlot)).toEqual(food);
});

it('rejects a mismatched receipt before saving and an altered checkpoint on restart', async () => {
  const { store, records } = setup();
  const repository = createAiFoundingRepository(scenario, store, now);
  await expect(repository.confirm(first, foundAiCompany(scenario, second))).rejects.toMatchObject({ code: 'invalid-save' });
  expect(await repository.load()).toBeNull();
  await repository.confirm(first, foundAiCompany(scenario, first));
  const envelope = JSON.parse(records.get(aiSlot)!.head);
  envelope.checkpoint.randomState += 1;
  records.set(aiSlot, { head: JSON.stringify(envelope), previous: null });
  await expect(repository.load()).rejects.toMatchObject({ code: 'invalid-save' });
});
