/** Exercises optimistic commits, corruption recovery, interruption and version migration. */
import { expect, it } from 'vitest';
import { createSaveRepository, type SaveRecord, type SaveStore } from '../../packages/storage/src';
import { loadScenario } from '../../packages/content/src';
import { createCompanyHost, type CompanyCommand } from '../../apps/game/src/company/host';

const scenario = loadScenario('big-order');
const identity = { scenarioId: scenario.id, rulesetVersion: scenario.rulesetVersion, contentVersion: scenario.contentVersion };
const savedAt = '2026-01-01T00:00:00.000Z';

function setup() {
  let current: SaveRecord | null = null;
  let interrupt = false;
  let loseAcknowledgement = false;
  const store: SaveStore = {
    async read() { return current; },
    async compareAndSwap(_slot, token, next) {
      if (token !== (current?.head ?? null)) return false;
      if (interrupt) throw new Error('interrupted');
      current = next;
      if (loseAcknowledgement) throw new Error('acknowledgement lost');
      return true;
    },
  };
  const repository = createSaveRepository<CompanyCommand>({
    store, slot: 'test', identity, now: () => savedAt,
    verify: (progress) => { createCompanyHost(scenario, progress); },
  });
  return {
    repository,
    host: createCompanyHost(scenario),
    raw: () => current,
    replace: (raw: SaveRecord) => { current = raw; },
    interrupt: () => { interrupt = true; },
    dropAck: () => { loseAcknowledgement = true; },
  };
}

it('restores the last valid checkpoint when a new write stops before the commit', async () => {
  const { repository, host, interrupt, raw } = setup();
  const initial = host.capture();
  const token = await repository.save(initial, null);
  host.advance();
  interrupt();

  await expect(repository.save(host.capture(), token)).rejects.toThrow('interrupted');
  expect(raw()?.head).toBe(token);
  expect((await repository.load())?.envelope.checkpoint).toEqual(initial.checkpoint);
});

it('restores the new checkpoint after a commit whose acknowledgement was lost', async () => {
  const { repository, host, dropAck } = setup();
  const token = await repository.save(host.capture(), null);
  host.advance();
  dropAck();
  await expect(repository.save(host.capture(), token)).rejects.toThrow('acknowledgement lost');
  expect((await repository.load())?.envelope.checkpoint).toEqual(host.capture().checkpoint);
});

it('recovers a replay-invalid head and preserves its last verified predecessor when repairing it', async () => {
  const { repository, host, replace, raw } = setup();
  const valid = await repository.save(host.capture(), null);
  host.advance();
  await repository.save(host.capture(), valid);
  const malformed = JSON.parse(raw()!.head);
  malformed.checkpoint.day += 1;
  replace({ head: JSON.stringify(malformed), previous: valid });

  const opened = (await repository.load())!;
  expect(opened.recovered).toBe(true);
  expect(opened.envelope.checkpoint.day).toBe(18);
  const repaired = await repository.save(opened.envelope, opened.token);
  expect((await repository.load())?.recovered).toBe(false);
  expect(raw()).toEqual({ head: repaired, previous: valid });
});

it('migrates the legacy envelope through replay and leaves the original intact as backup', async () => {
  const { repository, host, replace, raw } = setup();
  host.advance();
  const preview = host.preview(10);
  const receipt = host.confirm(preview);
  const { checkpoint, commands } = host.capture();
  const { day, revision, randomState, state } = checkpoint;
  const legacy = JSON.stringify({
    ...identity, schemaVersion: 1, savedAt, day, revision, seed: randomState, snapshot: state, commands,
  });
  replace({ head: legacy, previous: null });

  const opened = (await repository.load())!;
  expect(opened.migrated).toBe(true);
  expect(raw()?.head).toBe(legacy);
  expect(opened.envelope).toMatchObject({ schemaVersion: 2, mode: 'single-player', checkpoint, commands });
  await repository.save(opened.envelope, opened.token);
  expect(raw()?.previous).toBe(legacy);
  const reopened = createCompanyHost(scenario, (await repository.load())!.envelope);
  expect(reopened.capture()).toEqual(host.capture());
  expect(reopened.confirm(preview)).toEqual(receipt);
  expect(reopened.read().invoices).toHaveLength(2);
});

it.each([
  ['schemaVersion', 3, 'future-schema', 2],
  ['rulesetVersion', 2, 'future-ruleset', 1],
  ['contentVersion', 2, 'future-content', 1],
] as const)('refuses future %s without replacing it with the backup', async (field, found, code, supported) => {
  const { repository, host, replace, raw } = setup();
  const backup = await repository.save(host.capture(), null);
  const head = JSON.stringify({ ...JSON.parse(backup), [field]: found });
  replace({ head, previous: backup });

  await expect(repository.load()).rejects.toMatchObject({ code, found, supported });
  await expect(repository.save(host.capture(), head)).rejects.toMatchObject({ code, found, supported });
  expect(raw()?.head).toBe(head);
});

it('atomically rejects a competing tab and a delayed writer even with a larger local revision', async () => {
  const { repository, host } = setup();
  const initial = host.capture();
  const token = await repository.save(initial, null);
  const other = createCompanyHost(scenario, initial);
  host.advance();
  other.confirm(other.preview(10));
  const contenders = await Promise.allSettled([
    repository.save(host.capture(), token),
    repository.save(other.capture(), token),
  ]);

  expect(contenders.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
  const latest = (await repository.load())!;
  await expect(repository.save(initial, latest.token)).rejects.toMatchObject({ code: 'write-conflict' });
  other.advance();
  other.advance();
  expect(other.capture().checkpoint.revision).toBeGreaterThan(latest.envelope.checkpoint.revision);
  await expect(repository.save(other.capture(), token)).rejects.toMatchObject({ code: 'write-conflict' });
  expect((await repository.load())?.token).toBe(latest.token);
});
