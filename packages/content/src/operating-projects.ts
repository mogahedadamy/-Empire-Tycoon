/** Loads and validates the starter manufacturing, logistics, and property scenarios. */
import content from '../data/wadi-operating-projects.json';
import {
  compareOperatingProperty, quoteFactoryBatch, quoteShipment,
  type FactorySupplier, type FactoryTerms, type PropertyTerms, type RouteBooking, type ShippingOrder, type ShippingRoute,
} from '../../operations/src';
import { id, integer, invalid, money, section } from './fields';

function list<T>(value: unknown, path: string, decode: (row: Record<string, unknown>, rowPath: string) => T) {
  if (!Array.isArray(value)) return invalid(path, 'expected an array');
  return Object.freeze(value.map((item, index) => {
    const rowPath = `${path}[${index}]`;
    return Object.freeze(decode(section(item, rowPath), rowPath));
  }));
}

function amountFields<const K extends string>(data: Record<string, unknown>, path: string, keys: readonly K[]) {
  return Object.freeze(Object.fromEntries(keys.map((key) => [key, money(data[key], `${path}.${key}`, true)]))) as Readonly<Record<K, string>>;
}

function factory(data: unknown): FactoryTerms {
  const row = section(data, 'factory');
  return Object.freeze({
    recipe: list(row.recipe, 'factory.recipe', (material, path) => ({
      materialId: id(material.materialId, `${path}.materialId`),
      unitsPerProduct: integer(material.unitsPerProduct, `${path}.unitsPerProduct`),
    })),
    targetUnits: integer(row.targetUnits, 'factory.targetUnits'),
    machineUnits: integer(row.machineUnits, 'factory.machineUnits'),
    warehouseUnits: integer(row.warehouseUnits, 'factory.warehouseUnits'),
    serviceCapacityLoss: integer(row.serviceCapacityLoss, 'factory.serviceCapacityLoss', 0),
    failureRiskBps: integer(row.failureRiskBps, 'factory.failureRiskBps', 0, 10_000),
    servicedFailureRiskBps: integer(row.servicedFailureRiskBps, 'factory.servicedFailureRiskBps', 0, 10_000),
    dueDay: integer(row.dueDay, 'factory.dueDay'),
    ...amountFields(row, 'factory', ['serviceCostMinor', 'processUnitCostMinor', 'customerUnitPriceMinor']),
  });
}

function supplier(row: Record<string, unknown>, path: string): FactorySupplier {
  return {
    id: id(row.id, `${path}.id`), leadDays: integer(row.leadDays, `${path}.leadDays`, 0),
    passRateBps: integer(row.passRateBps, `${path}.passRateBps`, 0, 10_000),
    materials: list(row.materials, `${path}.materials`, (item, itemPath) => ({
      materialId: id(item.materialId, `${itemPath}.materialId`),
      units: integer(item.units, `${itemPath}.units`, 0),
      unitCostMinor: money(item.unitCostMinor, `${itemPath}.unitCostMinor`, true),
    })),
  };
}

function shippingOrder(data: unknown): ShippingOrder {
  const row = section(data, 'shipping');
  return Object.freeze({
    units: integer(row.units, 'shipping.units'), dispatchDay: integer(row.dispatchDay, 'shipping.dispatchDay'),
    dueDay: integer(row.dueDay, 'shipping.dueDay'), graceDays: integer(row.graceDays, 'shipping.graceDays', 0),
    unitRevenueMinor: money(row.unitRevenueMinor, 'shipping.unitRevenueMinor'),
    latePenaltyBps: integer(row.latePenaltyBps, 'shipping.latePenaltyBps', 0, 10_000),
  });
}

function route(row: Record<string, unknown>, path: string): ShippingRoute {
  return {
    id: id(row.id, `${path}.id`), dailyUnits: integer(row.dailyUnits, `${path}.dailyUnits`),
    loadingDays: integer(row.loadingDays, `${path}.loadingDays`, 0),
    transitDays: integer(row.transitDays, `${path}.transitDays`, 0),
    unloadingDays: integer(row.unloadingDays, `${path}.unloadingDays`, 0),
    ...amountFields(row, path, ['fixedCostMinor', 'unitCostMinor']),
  };
}

function booking(row: Record<string, unknown>, path: string): RouteBooking {
  return { routeId: id(row.routeId, `${path}.routeId`), day: integer(row.day, `${path}.day`), units: integer(row.units, `${path}.units`) };
}

function property(data: unknown): PropertyTerms {
  const row = section(data, 'property');
  return Object.freeze({
    rentableUnits: integer(row.rentableUnits, 'property.rentableUnits'),
    rentPerUnitMinor: money(row.rentPerUnitMinor, 'property.rentPerUnitMinor'),
    lease: amountFields(section(row.lease, 'property.lease'), 'property.lease', [
      'depositMinor', 'refundableDepositMinor', 'setupMinor', 'monthlyRentMinor', 'monthlyInsuranceMinor', 'monthlyMaintenanceMinor',
    ]),
    own: amountFields(section(row.own, 'property.own'), 'property.own', [
      'priceMinor', 'financedMinor', 'setupMinor', 'monthlyInsuranceMinor', 'monthlyMaintenanceMinor',
      'monthlyDebtServiceMinor', 'exitPriceMinor', 'exitCostsMinor', 'outstandingDebtAtExitMinor',
    ]),
  });
}

/** Decodes versioned project content and checks that its options can be quoted. */
export function parseOperatingProjects(value: unknown) {
  const data = section(value, 'operatingProjects');
  if (data.currency !== 'GAME') invalid('currency', 'expected the fictional GAME currency');
  const scenario = Object.freeze({
    schemaVersion: integer(data.schemaVersion, 'schemaVersion', 1, 1),
    rulesetVersion: integer(data.rulesetVersion, 'rulesetVersion', 1, 1),
    contentVersion: integer(data.contentVersion, 'contentVersion', 1),
    id: id(data.id, 'id'), currency: data.currency,
    factory: factory(data.factory), suppliers: list(data.suppliers, 'suppliers', supplier),
    shipping: shippingOrder(data.shipping), routes: list(data.routes, 'routes', route),
    bookings: list(data.bookings, 'bookings', booking), property: property(data.property),
  });
  if (new Set(scenario.suppliers.map((item) => item.id)).size !== scenario.suppliers.length || scenario.suppliers.length < 2) {
    invalid('suppliers', 'expected at least two distinct supplier IDs');
  }
  const routeIds = new Set(scenario.routes.map((item) => item.id));
  if (routeIds.size !== scenario.routes.length || routeIds.size < 2) invalid('routes', 'expected at least two distinct route IDs');
  for (const item of scenario.bookings) if (!routeIds.has(item.routeId)) invalid('bookings', 'unknown route');
  if (scenario.factory.servicedFailureRiskBps > scenario.factory.failureRiskBps) invalid('factory', 'maintenance cannot increase risk');
  for (const item of scenario.suppliers) quoteFactoryBatch(scenario.factory, item, 1, true);
  for (const item of scenario.routes) quoteShipment(item, scenario.shipping, scenario.bookings);
  compareOperatingProperty(scenario.property, 0);
  return scenario;
}

/** Loads the pinned introductory operating projects for Wadi Al Marsa. */
export const loadOperatingProjects = () => parseOperatingProjects(content);
