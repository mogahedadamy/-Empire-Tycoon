/** Exact, validated quantities and money used by the introductory operating projects. */
import { parseMinorUnits } from '../../../finance/src';

export function units(value: number, name: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new RangeError(`Invalid ${name}`);
  return value;
}

export function rate(value: number, name: string) {
  return units(value, name, 0, 10_000);
}

export function minor(value: string, name: string) {
  const amount = parseMinorUnits(value);
  if (amount < 0n) throw new RangeError(`Invalid ${name}`);
  return amount;
}
