/** Exercises sector selection, real worker previews, and independent project receipt restoration. */
import assert from 'node:assert/strict';
import { audit } from './accessibility.mjs';
import { open, readOrReplaceSave } from './journey.mjs';

const ready = '[data-project-state="ready"]';
const saved = '[data-project-state="saved"]';

async function pick(page, name, value) {
  await page.locator(`input[name="${name}"][value="${value}"]`).check();
  await page.locator(ready).waitFor({ state: 'attached' });
}

async function confirm(page) {
  await page.locator('[data-confirm-project]').tap();
  await page.locator(saved).waitFor();
  assert.equal(await page.locator('[data-confirm-project]').count(), 0);
}

function row(page, title, prefix = '.project-receipt') {
  return page.locator(`${prefix} dl > div`).filter({ has: page.getByText(title, { exact: true }) }).locator('dd');
}

export async function verifyOperatingProjects(page, url) {
  await open(page, url);
  const food = await readOrReplaceSave(page);
  await page.locator('[data-choose-industry]').tap();
  await page.getByRole('heading', { name: 'اختر مجال شركتك' }).waitFor();
  assert.equal(await page.locator('[data-industry]').count(), 5);
  await audit(page, 'Arabic industry selection');
  await page.locator('[data-industry="manufacturing"]').tap();
  await page.locator(ready).waitFor({ state: 'attached' });
  assert.match(await row(page, 'التكلفة').textContent(), /٢٬٤٦٤/);
  await pick(page, 'supplier', 'regional');
  assert.match(await row(page, 'جاهز في').textContent(), /٥/);
  assert.match(await row(page, 'التكلفة').textContent(), /١٬٦٧٢/);
  await pick(page, 'supplier', 'local');
  await page.locator('input[name="service"]').check();
  await page.locator(ready).waitFor({ state: 'attached' });
  assert.equal(await row(page, 'ما يحدّ السعة الآن').textContent(), 'الآلة');
  assert.equal(await row(page, 'السعة المتاحة').textContent(), '٣٨');
  await confirm(page);
  await page.reload();
  await page.locator(saved).waitFor();
  assert.equal(await page.locator('input[name="service"]').isChecked(), true);

  await page.locator('[data-choose-industry]').tap();
  await page.locator('[data-industry="logistics"]').tap();
  await page.locator(ready).waitFor({ state: 'attached' });
  assert.match(await row(page, 'موعد الوصول').textContent(), /٣/);
  await pick(page, 'route', 'consolidated');
  assert.match(await row(page, 'موعد الوصول').textContent(), /٦/);
  assert.match(await row(page, 'غرامة التأخير').textContent(), /٢٥٠/);
  await confirm(page);

  await page.locator('[data-choose-industry]').tap();
  await page.locator('[data-industry="property"]').tap();
  await page.locator(ready).waitFor({ state: 'attached' });
  assert.match(await row(page, 'النقد المتبقي شهريًا', '[data-property-option="lease"]').textContent(), /٢٬٣٥٠/);
  await pick(page, 'vacancy', '5000');
  assert.match(await row(page, 'النقد المتبقي شهريًا', '[data-property-option="lease"]').textContent(), /١٬٥٥٠/);
  assert.match(await row(page, 'النقد المتبقي شهريًا', '[data-property-option="own"]').textContent(), /١٥٠/);
  await pick(page, 'tenure', 'own');
  await page.locator('[data-property-option="lease"] summary').tap();
  assert.match(await row(page, 'تأمين قابل للاسترداد', '[data-property-option="lease"]').textContent(), /٧٬٢٠٠/);
  await audit(page, 'Arabic operating-property comparison');
  await page.locator('.language').tap();
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await confirm(page);
  await page.reload();
  await page.locator(saved).waitFor();
  assert.equal(await page.locator('input[name="tenure"][value="own"]').isChecked(), true);
  assert.equal(await page.locator('input[name="vacancy"][value="5000"]').isChecked(), true);

  await page.locator('[data-choose-industry]').tap();
  await page.locator('[data-industry="food"]').tap();
  await page.locator('[data-mission-step="found"]').waitFor();
  assert.deepEqual(await readOrReplaceSave(page), food);
}
