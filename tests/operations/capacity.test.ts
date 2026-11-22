/** Exercises work schedules, documented absence and equipment, stock and shipping bottlenecks. */
import { expect, it } from 'vitest';
import { readInventory, readOperatingCapacity } from '../../packages/operations/src';
import { apply as applyInventory, openInventory, order, receipt, scenario, scope } from './inventory-fixture';
import { apply, openWorkforce, roleId } from './workforce-fixture';

const day = scenario.contract.deliveryStartsDay;
const shift = {
  id: 'regular', day, type: 'schedule-shift', shiftId: 'regular', roleId, workDay: day, workers: 2,
} as const;
const limits = { day, materials: 100, equipment: 150, shipping: 150 };

it('uses labor as the 50-unit limit for 100 stocked boxes and increases it after a new shift', () => {
  const stock = applyInventory(applyInventory(openInventory(), order), receipt);
  const materials = readInventory(stock.state, scope).available;
  expect(materials).toBe(100n);

  const regular = apply(openWorkforce(), shift);
  expect(readOperatingCapacity(regular.state, { ...limits, materials })).toMatchObject({
    plannedLabor: 50n, available: 50n, limitingFactors: ['labor'],
  });
  const extended = apply(regular, { ...shift, id: 'extra', shiftId: 'extra' });
  expect(readOperatingCapacity(extended.state, { ...limits, materials })).toMatchObject({
    plannedLabor: 100n, available: 100n, limitingFactors: ['labor', 'materials'],
  });
  expect(extended.ledger).toBe(regular.ledger);
  expect(readOperatingCapacity(extended.state, { ...limits, day: day + 1 }).available).toBe(0n);
});

it('lowers actual capacity when an absence is recorded and keeps its source for review', () => {
  const scheduled = apply(openWorkforce(), shift);
  const absence = {
    id: 'sick-leave', day, type: 'record-absence', shiftId: shift.shiftId,
    workers: 1, reason: 'sick leave',
  } as const;
  const absent = apply(scheduled, absence);

  expect(absent.state.absences).toEqual([{
    shiftId: shift.shiftId, workers: 1, reason: absence.reason, day, commandId: absence.id,
  }]);
  expect(readOperatingCapacity(absent.state, limits)).toMatchObject({
    plannedLabor: 50n, absenceLoss: 25n, available: 25n, limitingFactors: ['labor'],
  });
  expect(apply(absent, absence).state).toBe(absent.state);
  expect(() => apply(absent, { ...absence, id: 'overcount', workers: 2 })).toThrow('invalid-attendance');
  expect(() => apply(absent, { ...absence, id: 'backdate', day: day + 1 })).toThrow('invalid-attendance');
});

it('reports the active constraints when equipment and shipping are lower than labor', () => {
  const scheduled = apply(openWorkforce(), shift);
  expect(readOperatingCapacity(scheduled.state, { ...limits, equipment: 20, shipping: 20 })).toMatchObject({
    available: 20n, limitingFactors: ['equipment', 'shipping'],
  });
  expect(readOperatingCapacity(scheduled.state, { ...limits, materials: 0n })).toMatchObject({
    available: 0n, limitingFactors: ['materials'],
  });
  expect(() => readOperatingCapacity(scheduled.state, { ...limits, equipment: 0.5 }))
    .toThrow('invalid-input');
  expect(() => apply(scheduled, { ...shift, id: 'oversize', shiftId: 'oversize', workers: 3 }))
    .toThrow('invalid-attendance');
});
