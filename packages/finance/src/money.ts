/** Exact minor-unit arithmetic for journal amounts and finance rules. */
const integerAmount = /^(?:0|-?[1-9][0-9]*)$/;
const basisPointScale = 10_000n;

/** Parses a canonical decimal string of minor units. Throws for fractions or numeric input. */
export function parseMinorUnits(value: unknown): bigint {
  if (typeof value !== 'string' || !integerAmount.test(value) || value !== value.trim()) {
    throw new RangeError('Expected a canonical integer string of minor units');
  }

  return BigInt(value);
}

/** Applies an integer basis-point rate, rounding to the nearest minor unit, ties away from zero. */
export function applyBasisPoints(amount: bigint, basisPoints: number): bigint {
  if (!Number.isSafeInteger(basisPoints)) throw new RangeError('Expected integer basis points');

  const product = amount * BigInt(basisPoints);
  const magnitude = product < 0n ? -product : product;
  const rounded = (magnitude + basisPointScale / 2n) / basisPointScale;
  return product < 0n ? -rounded : rounded;
}
