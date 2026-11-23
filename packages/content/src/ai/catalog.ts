/** Decodes the fictional buyers, hardware, suppliers and rights used by AI founding. */
import { id, integer, invalid, section, text } from '../fields';

export function localized(value: unknown, path: string) {
  const row = section(value, path);
  return Object.freeze({ ar: text(row.ar, path + '.ar'), en: text(row.en, path + '.en') });
}

export function choice<const Value extends string>(value: unknown, path: string, options: readonly Value[]): Value {
  const selected = options.find((option) => option === value);
  return selected ?? invalid(path, 'unknown value');
}

export function list<T>(value: unknown, path: string, parse: (value: unknown, path: string) => T) {
  if (!Array.isArray(value) || value.length === 0) return invalid(path, 'expected a non-empty list');
  return Object.freeze(value.map((item, index) => parse(item, `${path}[${index}]`)));
}

export function catalog<T extends { readonly id: string }>(
  value: unknown, path: string, parse: (row: Record<string, unknown>, path: string) => T,
) {
  const entries = list(value, path, (item, at) => Object.freeze(parse(section(item, at), at)));
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) invalid(path, 'duplicate ID');
  return entries;
}

export function reference<T extends { readonly id: string }>(entries: readonly T[], value: unknown, path: string): T {
  const key = id(value, path);
  return entries.find((entry) => entry.id === key) ?? invalid(path, 'unknown reference: ' + key);
}

const rights = ['commercial-use', 'train', 'evaluate', 'host', 'redistribute'] as const;

export function readAiCatalog(data: Record<string, unknown>) {
  const regions = catalog(data.regions, 'regions', (row, at) => ({
    id: id(row.id, at + '.id'), name: localized(row.name, at + '.name'),
  }));
  const hardwareFamilies = catalog(data.hardwareFamilies, 'hardwareFamilies', (row, at) => ({
    id: id(row.id, at + '.id'),
    memoryGiB: integer(row.memoryGiB, at + '.memoryGiB'),
    interconnectGbps: integer(row.interconnectGbps, at + '.interconnectGbps'),
  }));
  const suppliers = catalog(data.suppliers, 'suppliers', (row, at) => ({
    id: id(row.id, at + '.id'), name: localized(row.name, at + '.name'),
    regionId: reference(regions, row.regionId, at + '.regionId').id,
    memorySourceId: id(row.memorySourceId, at + '.memorySourceId'),
    hardwareFamilyIds: list(row.hardwareFamilyIds, at + '.hardwareFamilyIds', (family, path) =>
      reference(hardwareFamilies, family, path).id),
  }));
  const buyers = catalog(data.buyers, 'buyers', (row, at) => ({
    id: id(row.id, at + '.id'), name: localized(row.name, at + '.name'),
    billing: choice(row.billing, at + '.billing', ['seats', 'usage', 'subscription', 'reserved-capacity']),
    paymentTermsDays: integer(row.paymentTermsDays, at + '.paymentTermsDays', 0, 180),
  }));
  const licenses = catalog(data.licenses, 'licenses', (row, at) => ({
    id: id(row.id, at + '.id'),
    asset: choice(row.asset, at + '.asset', ['data', 'weights']),
    access: choice(row.access, at + '.access', ['owned', 'open', 'licensed']),
    rights: list(row.rights, at + '.rights', (right, path) => choice(right, path, rights)),
  }));
  return { regions, hardwareFamilies, suppliers, buyers, licenses };
}
