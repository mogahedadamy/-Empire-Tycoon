/** Covers the ET-017 trade-offs using the shipped manufacturing, cargo, and property terms. */
import { expect, it } from 'vitest';
import { loadOperatingProjects, parseOperatingProjects } from '../../packages/content/src';
import authored from '../../packages/content/data/wadi-operating-projects.json';
import { compareOperatingProperty, factoryBreakdownOccurs, quoteFactoryBatch, quoteShipment } from '../../packages/operations/src';

const scenario = loadOperatingProjects();
const [local, regional] = scenario.suppliers;
const [express, consolidated] = scenario.routes;

it('changes manufacturing lead time, materials expense, quality and customer acceptance with the supplier', () => {
  const quick = quoteFactoryBatch(scenario.factory, local, 1, false);
  const cheap = quoteFactoryBatch(scenario.factory, regional, 1, false);
  expect(quick).toMatchObject({ readyDay: 2, capacity: 44, bottlenecks: ['warehouse'], producedUnits: 44,
    passedUnits: 42, rejectedUnits: 2, deliveredUnits: 42, expenseMinor: '246400', proceedsMinor: '378000' });
  expect(quick.orderedMaterials.map(({ quantity }) => quantity)).toEqual([88, 44]);
  expect(cheap).toMatchObject({ readyDay: 5, expenseMinor: '167200', passedUnits: 39, deliveredUnits: 0, proceedsMinor: '0' });
});

it('reduces current machine capacity during service and future risk for the same draw', () => {
  const serviced = quoteFactoryBatch(scenario.factory, local, 1, true);
  const tighterWarehouse = quoteFactoryBatch({ ...scenario.factory, warehouseUnits: 20 }, local, 1, true);
  expect(serviced).toMatchObject({ capacity: 38, bottlenecks: ['machine'], machineDowntimeUnits: 20,
    producedUnits: 38, passedUnits: 36, nextShiftFailureRiskBps: 400 });
  expect(tighterWarehouse).toMatchObject({ capacity: 20, bottlenecks: ['warehouse'], producedUnits: 20 });
  const draw = 0x19999999;
  expect(factoryBreakdownOccurs(scenario.factory.failureRiskBps, draw)).toBe(true);
  expect(factoryBreakdownOccurs(serviced.nextShiftFailureRiskBps, draw)).toBe(false);
});

it('uses the dispatch window once and prices the accepted portion and late fee by route', () => {
  const fast = quoteShipment(express, scenario.shipping, scenario.bookings);
  const budget = quoteShipment(consolidated, scenario.shipping, scenario.bookings);
  expect(fast).toMatchObject({ arrivalDay: 3, freeUnits: 30, acceptedUnits: 30, lateUnits: 0, unfilledUnits: 10, expenseMinor: '39000' });
  expect(budget).toMatchObject({ arrivalDay: 6, acceptedUnits: 40, lateUnits: 40, expenseMinor: '22800', lateFeeMinor: '25000' });
  expect(quoteShipment(express, scenario.shipping, [...scenario.bookings, fast.booking!])).toMatchObject({
    freeUnits: 0, loadedUnits: 0, booking: null, expenseMinor: '0',
  });
  expect(quoteShipment(consolidated, { ...scenario.shipping, graceDays: 1 }, scenario.bookings)).toMatchObject({
    loadedUnits: 40, acceptedUnits: 0, proceedsMinor: '0', expenseMinor: '22800',
  });
});

it('compares leases and ownership under the same vacancy, separating financing and deposit recovery', () => {
  const initial = compareOperatingProperty(scenario.property, 2000);
  expect(initial.lease).toMatchObject({ initialCashMinor: '1240000', expectedRentMinor: '1040000',
    netOperatingIncomeMinor: '235000', monthlyCashMinor: '235000', refundableDepositMinor: '720000', netCashAtExitMinor: '720000' });
  expect(initial.own).toMatchObject({ initialCashMinor: '4160000', netOperatingIncomeMinor: '855000',
    monthlyDebtServiceMinor: '450000', monthlyCashMinor: '405000', netCashAtExitMinor: '5700000' });
  const highVacancy = compareOperatingProperty(scenario.property, 5000);
  expect(highVacancy.lease).toMatchObject({ expectedRentMinor: '650000', monthlyCashMinor: '-155000' });
  expect(highVacancy.own).toMatchObject({ expectedRentMinor: '650000', monthlyCashMinor: '15000' });
  expect(() => compareOperatingProperty(scenario.property, 10_001)).toThrow('vacancy');
});

it('rejects references to missing routes and materials when loading authored scenarios', () => {
  const routeError = structuredClone(authored);
  routeError.bookings[0].routeId = 'missing-route';
  expect(() => parseOperatingProjects(routeError)).toThrow('unknown route');
  const supplierError = structuredClone(authored);
  supplierError.suppliers[1].materials = [];
  expect(() => parseOperatingProjects(supplierError)).toThrow('Missing supplier material');
});
