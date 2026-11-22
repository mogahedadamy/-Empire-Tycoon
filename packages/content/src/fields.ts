/** Shared field decoders with paths suitable for scenario authoring errors. */
export function invalid(path: string, reason: string): never {
  throw new RangeError(`${path}: ${reason}`);
}

export function section(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalid(path, 'expected an object');
  }
  return value as Record<string, unknown>;
}

export function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) return invalid(path, 'expected text');
  return value;
}

export function id(value: unknown, path: string): string {
  const name = text(value, path);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name !== name.trim()) {
    return invalid(path, 'expected a lowercase ID');
  }
  return name;
}

export function integer(
  value: unknown,
  path: string,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    return invalid(path, `expected an integer from ${min} to ${max}`);
  }
  return value;
}

export function money(value: unknown, path: string, allowZero = false): string {
  if (
    typeof value !== 'string' ||
    !/^(?:0|[1-9][0-9]*)$/.test(value) ||
    value !== value.trim() ||
    (!allowZero && value === '0')
  ) {
    return invalid(path, 'expected a decimal string of minor units');
  }
  return value;
}
