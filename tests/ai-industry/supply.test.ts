/** Verifies procurement references, seeded correlated arrivals and the reference power calculation. */
import { expect, it } from 'vitest';
import authored from '../../packages/content/data/compute-procurement.json';
import aiAuthored from '../../packages/content/data/contract-before-launch.json';
import { replayProcurement } from '../../packages/ai-industry/src';
import { parseAiScenario, parseComputeProcurement } from '../../packages/content/src/ai';
import { cooling, first, job, network, owned, procurementOptions, start } from './procurement-fixture';

it('delays both suppliers sharing the shock source while the independent order keeps its ETA', () => {
  const { session, purchase } = start();
  expect(session.previewPurchase({ type: 'purchase-hardware', offerId: 'harbor-basalt-batch', groupId: owned,
    units: 12, day: 1 })).toMatchObject({ affordable: true, alternatives: [
    { offerId: 'plateau-basalt-batch', arrivalDay: 13, affordable: true, delay: { sourceId: 'tide-memory' } },
  ] });
  const primary = purchase('buy-harbor', 'harbor-basalt-batch', owned, 120);
  const secondary = purchase('buy-plateau', 'plateau-basalt-batch', owned, 12);
  const independent = purchase('buy-cove', 'cove-dune-batch', 'owned-cove-dune', 12);
  const delay = { sourceId: 'tide-memory', days: 3 };
  expect(primary).toMatchObject({ originalArrivalDay: 9, arrivalDay: 12, installedDay: 14, delay });
  expect(secondary).toMatchObject({ originalArrivalDay: 10, arrivalDay: 13, installedDay: 15, delay });
  expect(independent).toMatchObject({ originalArrivalDay: 10, arrivalDay: 10, installedDay: 12, delay: null });
  expect(session.read().purchases.every(({ status }) => status === 'ordered')).toBe(true);
  expect(session.read().balance).toMatchObject({ cash: '8184000' });
  expect(replayProcurement(procurementOptions(), session.commandLog()).read()).toEqual(session.read());

  const other = start(procurementOptions(parseAiScenario({ ...aiAuthored, seed: 1700 })));
  expect(other.purchase('buy-harbor', 'harbor-basalt-batch', owned, 120).arrivalDay).toBe(9);
  expect(other.session.read().shock.active).toBe(false);
});

it('supplies the fixture’s 90 accelerator-hours and then 80 after cooling falls', () => {
  const { session, purchase, run } = start();
  purchase('buy-harbor', 'harbor-basalt-batch', owned, 120);
  expect(session.preview(first, []).groups.find(({ group }) => group.id === owned)?.availableUnits).toBe(0);
  run(first);
  const local = { allowInterruptible: false, regionId: 'wadi-harbor' };
  const normal = run(network, [job('network-test', 90, local)]);
  expect(normal.groups.find(({ group }) => group.id === owned)).toMatchObject({
    availableUnits: 90, site: { limits: { installed: 120, electricity: 100, network: 90, cooling: 110 }, limitingFactors: ['network'] },
    usage: { ownedUnits: 90 }, acceleratorEnergyWh: '90000',
  });
  const constrained = run(cooling, [job('too-large', 81, { ...local, priority: 20 }), job('fits-cooling', 80, local)]);
  expect(constrained.assignments).toEqual([
    { status: 'deferred', jobId: 'too-large', reason: 'capacity-unavailable', largestEligibleUnits: 80 },
    { status: 'allocated', jobId: 'fits-cooling', groupId: owned, ownedUnits: 80, reservedUnits: 0, interruptibleUnits: 0 },
  ]);
  expect(constrained.groups.find(({ group }) => group.id === owned)).toMatchObject({
    availableUnits: 80, site: { limitingFactors: ['cooling'] }, acceleratorEnergyWh: '80000',
  });
  expect(session.read().purchases[0].status).toBe('installed');
});

it('rejects incompatible purchases and insufficient stock or rack space without modifying the ledger', () => {
  const { session, purchase, submit } = start();
  const order = { type: 'purchase-hardware', day: 1, groupId: owned } as const;
  expect(submit('incompatible', { ...order, offerId: 'cove-dune-batch', units: 1 })).toMatchObject({ code: 'incompatible-hardware' });
  expect(submit('too-many', { ...order, offerId: 'harbor-basalt-batch', units: 141 })).toMatchObject({ code: 'stock-limit' });
  purchase('fill-rack', 'harbor-basalt-batch', owned, 140);
  const before = session.read();
  expect(submit('no-rack', { ...order, offerId: 'plateau-basalt-batch', units: 21 })).toMatchObject({ code: 'rack-limit' });
  expect(session.read()).toEqual(before);
  expect(session.read().journal.at(-1)?.lines).toEqual([
    { account: 'equipment', side: 'debit', amount: '5040000' },
    { account: 'cash', side: 'credit', amount: '5040000', cashFlow: 'investing' },
  ]);
});

it('rejects invalid authored supplier or hardware references and overlapping windows', () => {
  const supplier = structuredClone(authored);
  supplier.hardwareOffers[0].supplierId = 'unknown';
  expect(() => parseComputeProcurement(supplier)).toThrow('hardwareOffers[0].supplierId');
  const hardware = structuredClone(authored);
  hardware.hardwareOffers[0].hardwareFamilyId = 'dune-48';
  expect(() => parseComputeProcurement(hardware)).toThrow('hardwareOffers[0].hardwareFamilyId');
  const time = structuredClone(authored);
  time.windows[2].hour = time.windows[1].hour;
  expect(() => parseComputeProcurement(time)).toThrow('windows: overlapping hour');
});
