/** Exercises the new-player path through real taps, saved receipts, and a second scenario. */
import assert from 'node:assert/strict';
import { audit } from './accessibility.mjs';
import { open, readOrReplaceSave } from './journey.mjs';

const saved = '.save-status[data-state="saved"]';
const stepSelector = (step) => `[data-mission-step="${step}"]`;

async function move(page, step, next) {
  await page.locator(stepSelector(step)).waitFor();
  const button = page.locator(`[data-mission-action="${step}"]`);
  assert.equal(await page.locator('[data-mission-action]').count(), 1);
  assert.ok((await button.boundingBox()).height >= 44);
  await button.tap();
  await page.locator(next === 'management' ? '#page-title' : stepSelector(next)).waitFor();
  await page.locator(saved).waitFor();
}

async function prepareFirstShipment(page) {
  await move(page, 'found', 'contract');
  await move(page, 'contract', 'order');
  await move(page, 'order', 'arrival');
  await move(page, 'arrival', 'delivery-day');
  await move(page, 'delivery-day', 'ship');
}

export async function verifyOpeningMission(page, url) {
  await open(page, url);
  const goal = page.locator('#mission-goal');
  assert.equal(await goal.textContent(), 'سلّم أول طلب لشركتك');
  assert.equal(await page.locator('.nav-item').count(), 0);
  await audit(page, 'opening mission, Arabic');
  await page.locator('[data-mission-management]').tap();
  await page.locator('input[name="funding"][value="capital"]').check();
  await page.locator('[data-mission-return]').tap();
  assert.match(await page.locator('.mission-facts').textContent(), /٢٢٬٠٠٠/);
  await page.locator('[data-mission-management]').tap();
  await page.locator('input[name="funding"][value="loan"]').check();
  await page.locator('[data-mission-return]').tap();
  assert.match(await page.locator('.mission-facts').textContent(), /٣٢٬٠٠٠/);

  await prepareFirstShipment(page);
  await audit(page, 'shipment approval, Arabic');
  assert.match(await page.locator('.mission-decision').textContent(), /٣٬٧٥٠/);
  await move(page, 'ship', 'next-trip');
  assert.equal(await page.locator('#mission-step-title').textContent(), 'وصلت الدفعة الأولى!');
  assert.equal(await page.locator('.mission-count').textContent(), '٥٠ من ٧٠');
  const firstReceipt = (await readOrReplaceSave(page)).head;
  await open(page, url);
  assert.equal((await readOrReplaceSave(page)).head, firstReceipt);
  await page.locator('button.language').tap();
  assert.equal(await goal.textContent(), 'Deliver your first order');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.setViewportSize({ width: 844, height: 360 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  await page.setViewportSize({ width: 360, height: 800 });
  await move(page, 'next-trip', 'ship');
  await move(page, 'ship', 'done');
  assert.equal(await page.locator('.mission-count').textContent(), '70 of 70');
  assert.match(await page.locator('.mission-decision').textContent(), /5,250/);
  await page.locator('[data-mission-management]').tap();
  assert.equal(await page.locator('#page-title').textContent(), 'Financial review');
  assert.equal(await page.locator('[data-statement="flow"]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-mission-return]').tap();
  await move(page, 'done', 'management');
  assert.equal(JSON.parse((await readOrReplaceSave(page)).head).checkpoint.day, 31);
  await open(page, url);
  assert.equal(await page.locator('[data-mission-step]').count(), 0);

  await open(page, new URL('?scenario=big-order-tight', url).href);
  await prepareFirstShipment(page);
  await move(page, 'ship', 'next-trip');
  assert.equal(await page.locator('.mission-count').textContent(), '٤٠ من ٧٠');
}
