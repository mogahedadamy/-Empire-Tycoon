/** Compares cash needed, vacancy-adjusted income, and an exit for leasing or owning a warehouse. */
import { applyBasisPoints } from '../../../finance/src';
import { minor, rate, units } from './values';

export interface PropertyTerms {
  readonly rentableUnits: number;
  readonly rentPerUnitMinor: string;
  readonly lease: {
    readonly depositMinor: string;
    readonly refundableDepositMinor: string;
    readonly setupMinor: string;
    readonly monthlyRentMinor: string;
    readonly monthlyInsuranceMinor: string;
    readonly monthlyMaintenanceMinor: string;
  };
  readonly own: {
    readonly priceMinor: string;
    readonly financedMinor: string;
    readonly setupMinor: string;
    readonly monthlyInsuranceMinor: string;
    readonly monthlyMaintenanceMinor: string;
    readonly monthlyDebtServiceMinor: string;
    readonly exitPriceMinor: string;
    readonly exitCostsMinor: string;
    readonly outstandingDebtAtExitMinor: string;
  };
}

function option(revenue: bigint, costs: {
  initial: bigint; operating: bigint; debt: bigint; exit: bigint; deposit: bigint; insurance: bigint;
}) {
  const netOperating = revenue - costs.operating;
  return Object.freeze({
    initialCashMinor: costs.initial.toString(), expectedRentMinor: revenue.toString(),
    refundableDepositMinor: costs.deposit.toString(), monthlyInsuranceMinor: costs.insurance.toString(),
    operatingCostsMinor: costs.operating.toString(), monthlyDebtServiceMinor: costs.debt.toString(),
    netOperatingIncomeMinor: netOperating.toString(), monthlyCashMinor: (netOperating - costs.debt).toString(),
    netCashAtExitMinor: costs.exit.toString(),
  });
}

/** Calculates both tenure options with the same vacancy and whole-unit price assumptions. */
export function compareOperatingProperty(terms: PropertyTerms, vacancyBps: number) {
  rate(vacancyBps, 'vacancy');
  const lease = terms.lease;
  const own = terms.own;
  const gross = BigInt(units(terms.rentableUnits, 'rentable units', 1)) * minor(terms.rentPerUnitMinor, 'unit rent');
  const revenue = applyBasisPoints(gross, 10_000 - vacancyBps);
  const deposit = minor(lease.depositMinor, 'lease deposit');
  const refundable = minor(lease.refundableDepositMinor, 'refundable deposit');
  const price = minor(own.priceMinor, 'purchase price');
  const financed = minor(own.financedMinor, 'purchase financing');
  const exitDebt = minor(own.outstandingDebtAtExitMinor, 'outstanding debt');
  const leaseInsurance = minor(lease.monthlyInsuranceMinor, 'lease insurance');
  const ownInsurance = minor(own.monthlyInsuranceMinor, 'owner insurance');
  if (refundable > deposit || financed > price || exitDebt > financed) throw new RangeError('Invalid property deposit or financing');

  return Object.freeze({
    vacancyBps,
    lease: option(revenue, {
      initial: deposit + minor(lease.setupMinor, 'lease setup'), insurance: leaseInsurance, deposit: refundable,
      operating: minor(lease.monthlyRentMinor, 'contracted rent') + leaseInsurance + minor(lease.monthlyMaintenanceMinor, 'lease maintenance'),
      debt: 0n, exit: refundable,
    }),
    own: option(revenue, {
      initial: price - financed + minor(own.setupMinor, 'ownership setup'), insurance: ownInsurance, deposit: 0n,
      operating: ownInsurance + minor(own.monthlyMaintenanceMinor, 'owner maintenance'),
      debt: minor(own.monthlyDebtServiceMinor, 'debt service'),
      exit: minor(own.exitPriceMinor, 'exit price') - minor(own.exitCostsMinor, 'exit cost') - exitDebt,
    }),
  });
}
