/** Checks the shipped read model and localized formatting independently of the browser. */
import { expect, it } from 'vitest';
import { loadScenario } from '../../packages/content/src';
import { createFormatters } from '../../packages/ui/src';
import { previewModel } from '../../apps/game/src/preview-model';

it('projects the reference close and carries the funding choice into the same model', () => {
  const scenario = loadScenario('big-order');
  const funded = previewModel(scenario, 'loan');
  const selfFunded = previewModel(scenario, 'capital');

  expect(funded).toMatchObject({
    closingCash: 2680000n, netIncome: 60000n, revenue: 525000n,
    afterCollection: 3205000n, deliveryDays: 2,
  });
  expect(selfFunded.closingCash).toBe(funded.closingCash - funded.loan);
  expect(selfFunded.netIncome).toBe(68000n);
  expect(funded.timeline.map(({ day }) => day)).toEqual([1, 8, 28, 38]);
});

it('formats Arabic and English values without losing exact minor units', () => {
  expect(createFormatters('en').money(2680000n)).toBe('26,800');
  expect(createFormatters('en').money(-1n)).toBe('-0.01');
  expect(createFormatters('en').money(900719925474099301n)).toBe('9,007,199,254,740,993.01');
  expect(createFormatters('ar').money(2680000n)).toBe('٢٦٬٨٠٠');
  expect(createFormatters('ar').money(105n)).toBe('١٫٠٥');
});
