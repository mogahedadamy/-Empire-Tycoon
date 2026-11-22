/** Authored assumptions for the isolated ET-018 balance sample. */
export const seeds = [202627, 202628, 302018, 402018] as const;
export const horizon = 30;
export const stresses = ['normal', 'supplier-loss', 'customer-loss', 'demand-slump', 'financed-expansion'] as const;
export type Stress = typeof stresses[number];
export const policies = [
  { id: 'cautious-cash', stock: 44, capacity: 40, price: '7900', reserve: 150_000n, dailyExpense: 5_000n, loan: 0n },
  { id: 'funded-growth', stock: 95, capacity: 72, price: '8050', reserve: 100_000n, dailyExpense: 9_000n, loan: 450_000n },
  { id: 'lean-inventory', stock: 22, capacity: 20, price: '7350', reserve: 25_000n, dailyExpense: 3_300n, loan: 0n },
] as const;
export type Policy = typeof policies[number];
