/** Plays the first AI-company decision from the industry menu on a phone-sized browser. */
import assert from 'node:assert/strict';
import { audit } from './accessibility.mjs';
import { open, readOrReplaceSave, snapshot } from './journey.mjs';

const ready = '[data-ai-state=ready]';
const saved = '[data-ai-state=saved]';

export async function verifyAiFounding(page, url) {
  await open(page, url);
  const foodBefore = await readOrReplaceSave(page);
  await page.locator('[data-choose-industry]').tap();
  await page.locator('[data-industry=ai]').tap();
  await page.locator(ready).waitFor({ state: 'attached' });
  await page.getByRole('heading', { name: 'العقد قبل التشغيل' }).waitFor();
  assert.equal(await page.locator('input[name=ai-path]').count(), 4);
  const expectedAr = [/١٣٬٥٠٠.*٨٨٠.*١٣/s, /٢٨٬٠٠٠.*١٬٣٥٠.*٢٧/s, /٧٩٬٠٠٠.*٣٬١٥٠.*٥٤/s, /٢٤٬٠٠٠.*١٬١٠٠.*٢٠/s];
  for (const [index, amounts] of expectedAr.entries()) {
    assert.match(await page.locator('.ai-path').nth(index).textContent(), amounts);
  }
  await audit(page, 'Arabic AI founding comparison');
  await page.getByText('واجهة API متخصصة', { exact: true }).tap();
  const preview = page.locator('.ai-decision .ai-summary');
  await preview.waitFor();
  assert.match(await preview.textContent(), /١٣٢٬٠٠٠/);
  await page.locator('.language').tap();
  await page.getByRole('heading', { name: 'Contract Before Launch' }).waitFor();
  assert.equal(await page.locator('input[name=ai-path][value=specialized-api]').isChecked(), true);
  await audit(page, 'English AI founding decision');
  for (const locale of ['en', 'ar']) {
    if (await page.locator('html').getAttribute('lang') !== locale) await page.locator('.language').tap();
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 360);
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  }
  await page.locator('[data-confirm-ai]').tap();
  await page.locator(saved).waitFor();
  assert.equal(await page.locator('#ai-summary-title').evaluate((node) => node === document.activeElement), true);
  await page.reload();
  await page.locator(saved).waitFor();
  assert.match(await page.locator('.ai-summary').textContent(), /واجهة API متخصصة.*١٣٢٬٠٠٠/s);
  assert.deepEqual(await readOrReplaceSave(page), foodBefore);
  await open(page, url);
  assert.deepEqual(snapshot(await readOrReplaceSave(page)), snapshot(foodBefore));
}
