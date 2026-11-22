/** Quotes a light manufacturing batch from its recipe, supplier, machine and warehouse. */
import { minor, rate, units } from './values';

export interface FactoryTerms {
  readonly recipe: readonly { readonly materialId: string; readonly unitsPerProduct: number }[];
  readonly targetUnits: number;
  readonly machineUnits: number;
  readonly warehouseUnits: number;
  readonly serviceCapacityLoss: number;
  readonly serviceCostMinor: string;
  readonly processUnitCostMinor: string;
  readonly failureRiskBps: number;
  readonly servicedFailureRiskBps: number;
  readonly customerUnitPriceMinor: string;
  readonly dueDay: number;
}

export interface FactorySupplier {
  readonly id: string;
  readonly leadDays: number;
  readonly passRateBps: number;
  readonly materials: readonly { readonly materialId: string; readonly units: number; readonly unitCostMinor: string }[];
}

/** Plans one batch and exposes only units passing quality inspection as saleable. */
export function quoteFactoryBatch(terms: FactoryTerms, supplier: FactorySupplier, orderDay: number, serviceMachine: boolean) {
  units(orderDay, 'factory order day', 1);
  const lead = units(supplier.leadDays, 'supplier lead days');
  const readyDay = units(orderDay + lead, 'factory completion day', 1);
  const loss = serviceMachine ? units(terms.serviceCapacityLoss, 'service capacity loss') : 0;
  const machine = Math.max(0, units(terms.machineUnits, 'machine capacity') - loss);
  const warehouse = units(terms.warehouseUnits, 'free warehouse capacity');
  const target = units(terms.targetUnits, 'batch target', 1);
  const passRate = rate(supplier.passRateBps, 'quality pass rate');
  if (!terms.recipe.length) throw new RangeError('Expected at least one material in the recipe');
  const supply = new Map(supplier.materials.map((item) => [item.materialId, item]));
  const recipeIds = new Set<string>();
  const recipe = terms.recipe.map(({ materialId, unitsPerProduct }) => {
    if (recipeIds.has(materialId)) throw new RangeError(`Duplicate recipe material: ${materialId}`);
    recipeIds.add(materialId);
    const material = supply.get(materialId);
    if (!material) throw new RangeError(`Missing supplier material: ${materialId}`);
    return {
      materialId,
      unitsPerProduct: units(unitsPerProduct, 'recipe quantity', 1),
      available: units(material.units, 'material availability'),
      price: minor(material.unitCostMinor, 'material price'),
    };
  });
  if (supply.size !== supplier.materials.length) throw new RangeError('Duplicate supplier material');
  const materials = recipe.reduce((count, item) => Math.min(count, Math.floor(item.available / item.unitsPerProduct)), Number.MAX_SAFE_INTEGER);
  const limits = Object.freeze({ machine, warehouse, materials });
  const capacity = Math.min(machine, warehouse, materials);
  const producedUnits = Math.min(target, capacity);
  const passedUnits = Number(BigInt(producedUnits) * BigInt(passRate) / 10_000n);
  const dueDay = units(terms.dueDay, 'factory due day', 1);
  const orderedMaterials = Object.freeze(recipe.map(({ materialId, unitsPerProduct, price }) => {
    const quantity = producedUnits * unitsPerProduct;
    return Object.freeze({ materialId, quantity, costMinor: (BigInt(quantity) * price).toString() });
  }));
  const expense = orderedMaterials.reduce((total, material) => total + BigInt(material.costMinor), 0n) +
    minor(terms.processUnitCostMinor, 'processing cost') * BigInt(producedUnits) +
    (serviceMachine ? minor(terms.serviceCostMinor, 'machine service cost') : 0n);
  const deliveredUnits = readyDay <= dueDay ? passedUnits : 0;
  const proceeds = minor(terms.customerUnitPriceMinor, 'customer price') * BigInt(deliveredUnits);

  return Object.freeze({
    target, readyDay, dueDay, capacity, limits, plannedMachineUnits: terms.machineUnits,
    machineDowntimeUnits: terms.machineUnits - machine,
    bottlenecks: Object.freeze((Object.keys(limits) as Array<keyof typeof limits>).filter((key) => limits[key] === capacity)),
    producedUnits, passedUnits, rejectedUnits: producedUnits - passedUnits, deliveredUnits, orderedMaterials,
    expenseMinor: expense.toString(), proceedsMinor: proceeds.toString(), projectNetMinor: (proceeds - expense).toString(),
    nextShiftFailureRiskBps: rate(serviceMachine ? terms.servicedFailureRiskBps : terms.failureRiskBps, 'next shift failure risk'),
  });
}

/** Tests the planned following shift against one replayable draw from the host. */
export function factoryBreakdownOccurs(failureRiskBps: number, randomUint32: number) {
  return units(randomUint32, 'factory risk draw', 0, 0xffffffff) * 10_000 <
    rate(failureRiskBps, 'failure risk') * 0x100000000;
}
