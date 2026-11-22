/** Plans a delivery against route capacity and prices on-time, late and rejected units. */
import { applyBasisPoints } from '../../../finance/src';
import { minor, rate, units } from './values';

export interface ShippingRoute {
  readonly id: string;
  readonly dailyUnits: number;
  readonly loadingDays: number;
  readonly transitDays: number;
  readonly unloadingDays: number;
  readonly fixedCostMinor: string;
  readonly unitCostMinor: string;
}

export interface ShippingOrder {
  readonly units: number;
  readonly dispatchDay: number;
  readonly dueDay: number;
  readonly graceDays: number;
  readonly unitRevenueMinor: string;
  readonly latePenaltyBps: number;
}

export interface RouteBooking {
  readonly routeId: string;
  /** Capacity is reserved for the dispatch-day window. */
  readonly day: number;
  readonly units: number;
}

/** Quotes a dispatch-day reservation. The caller commits the returned booking with its order. */
export function quoteShipment(route: ShippingRoute, order: ShippingOrder, bookings: readonly RouteBooking[] = []) {
  const dispatchDay = units(order.dispatchDay, 'dispatch day', 1);
  const routeCapacity = units(route.dailyUnits, 'route capacity');
  const dueDay = units(order.dueDay, 'delivery deadline', dispatchDay);
  const graceEnd = units(dueDay + units(order.graceDays, 'delivery grace days'), 'last accepted delivery day', 1);
  const requestedUnits = units(order.units, 'ordered units', 1);
  let remaining = routeCapacity;
  for (const item of bookings) {
    if (item.routeId !== route.id || item.day !== dispatchDay) continue;
    remaining = Math.max(0, remaining - units(item.units, 'booked route units', 1));
  }
  const durationDays = units(units(route.loadingDays, 'loading days') + units(route.transitDays, 'transit days') +
    units(route.unloadingDays, 'unloading days'), 'route duration');
  const arrivalDay = units(dispatchDay + durationDays, 'arrival day', 1);
  const loadedUnits = Math.min(remaining, requestedUnits);
  const acceptedUnits = arrivalDay <= graceEnd ? loadedUnits : 0;
  const lateUnits = arrivalDay > dueDay ? acceptedUnits : 0;
  const expense = loadedUnits === 0 ? 0n : minor(route.fixedCostMinor, 'route fixed cost') +
    BigInt(loadedUnits) * minor(route.unitCostMinor, 'route unit cost');
  const unitRevenue = minor(order.unitRevenueMinor, 'shipment unit revenue');
  const lateFee = applyBasisPoints(BigInt(lateUnits) * unitRevenue, rate(order.latePenaltyBps, 'late penalty'));
  const proceeds = BigInt(acceptedUnits) * unitRevenue - lateFee;
  return Object.freeze({
    requestedUnits, dispatchDay, arrivalDay, dueDay, durationDays,
    freeUnits: remaining, loadedUnits, acceptedUnits, lateUnits,
    unfilledUnits: requestedUnits - acceptedUnits,
    expenseMinor: expense.toString(), lateFeeMinor: lateFee.toString(),
    proceedsMinor: proceeds.toString(), projectNetMinor: (proceeds - expense).toString(),
    booking: loadedUnits === 0 ? null : Object.freeze({ routeId: route.id, day: dispatchDay, units: loadedUnits }),
  });
}
