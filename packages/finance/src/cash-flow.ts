/** Builds the direct cash flow statement from classified cash movements. */
import type { Ledger } from './ledger';
import { requirePeriod, type ReportingPeriod } from './statements';

function cashTotals() {
  return { receipts: 0n, payments: 0n };
}

function summarize({ receipts, payments }: ReturnType<typeof cashTotals>) {
  return {
    receipts: receipts.toString(),
    payments: payments.toString(),
    net: (receipts - payments).toString(),
  };
}

/** Reports classified receipts and payments, plus opening and closing cash in minor units. */
export function directCashFlow(ledger: Ledger, period: ReportingPeriod) {
  requirePeriod(period);
  const categories = { operating: cashTotals(), investing: cashTotals(), financing: cashTotals() };
  const corrections = new Set<string>();
  let openingCash = 0n;
  let netChange = 0n;

  for (const entry of ledger.entries) {
    if (entry.day > period.throughDay) continue;

    // An odd number of reversals corrects the original gross flow. The next reversal restores it.
    const correction = entry.reversesId !== null && !corrections.has(entry.reversesId);
    if (correction) corrections.add(entry.id);

    for (const line of entry.lines) {
      if (line.account !== 'cash') continue;

      const amount = BigInt(line.amount);
      const movement = line.side === 'debit' ? amount : -amount;
      if (entry.day < period.fromDay) {
        openingCash += movement;
        continue;
      }

      netChange += movement;
      const totals = categories[line.cashFlow];
      const grossAmount = correction ? -amount : amount;
      if ((line.side === 'debit') !== correction) totals.receipts += grossAmount;
      else totals.payments += grossAmount;
    }
  }

  return {
    companyId: ledger.companyId,
    currency: ledger.currency,
    period: { ...period },
    operating: summarize(categories.operating),
    investing: summarize(categories.investing),
    financing: summarize(categories.financing),
    openingCash: openingCash.toString(),
    netChange: netChange.toString(),
    closingCash: (openingCash + netChange).toString(),
  };
}
