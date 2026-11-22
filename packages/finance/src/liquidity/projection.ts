/** Orders cash movements and projects signed balances without posting any entries. */
import type { LiquidityGap, LiquidityInput, LiquidityProjection, ProjectedMovement } from './types';

export const liquidityHorizonDays = 30;

function compare(left: ProjectedMovement, right: ProjectedMovement) {
  return left.projectedDay - right.projectedDay ||
    Number(left.direction === 'out') - Number(right.direction === 'out') ||
    left.dueDay - right.dueDay ||
    (left.id < right.id ? -1 : Number(left.id > right.id));
}

function projectedGap(input: LiquidityInput, cash: bigint, movement?: ProjectedMovement): LiquidityGap {
  return Object.freeze({
    day: movement?.projectedDay ?? input.day,
    amountMinor: (-cash).toString(),
    partyId: movement?.partyId ?? input.companyId,
    sourceId: movement?.id ?? input.companyId,
    reason: movement?.source === 'credit' ? 'opening-cash' : movement?.source ?? 'opening-cash',
    dueDay: movement?.dueDay ?? input.day,
  });
}

export function project(input: LiquidityInput, flows: readonly ProjectedMovement[]): LiquidityProjection {
  const throughDay = input.day + liquidityHorizonDays - 1;
  const movements = flows.filter(({ projectedDay }) => projectedDay <= throughDay).sort(compare);
  let cash = BigInt(input.cashMinor);
  let minimum = cash;
  let firstShortfall = cash < 0n ? projectedGap(input, cash) : null;
  let index = 0;
  const days = [];

  for (let day = input.day; day <= throughDay; day += 1) {
    while (index < movements.length && movements[index].projectedDay === day) {
      const movement = movements[index++];
      const amount = BigInt(movement.amountMinor);
      cash += movement.direction === 'in' ? amount : -amount;
      if (cash < minimum) minimum = cash;
      if (cash < 0n && !firstShortfall) firstShortfall = projectedGap(input, cash, movement);
    }
    days.push(Object.freeze({ day, cashMinor: cash.toString() }));
  }

  return Object.freeze({
    days: Object.freeze(days), movements: Object.freeze(movements),
    firstShortfall, minimumCashMinor: minimum.toString(),
  });
}
