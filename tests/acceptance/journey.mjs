/** Drives the production journey through its DOM and checks committed IndexedDB saves. */
import assert from 'node:assert/strict';

const saved = '.save-status[data-state="saved"]';
const delivery = '[data-delivery-action]';

export async function open(page, url) {
  await page.goto(url);
  await page.locator(saved).waitFor();
}

export async function command(page, selector) {
  const before = await page.locator('.rev-pill bdi').textContent();
  await page.locator(selector).tap();
  await page.waitForFunction((revision) => document.querySelector('.rev-pill bdi')?.textContent !== revision, before);
  await page.locator(saved).waitFor();
}

export async function navigate(page, screen) {
  const screens = ['overview', 'company', 'contracts', 'finance'];
  await page.locator('.nav-item').nth(screens.indexOf(screen)).tap();
  assert.equal(await page.locator('#page-title').evaluate((heading) => document.activeElement === heading), true);
}

export async function readOrReplaceSave(page, next) {
  return page.evaluate(async (replacement) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('empire-tycoon-solo');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction('slots', replacement ? 'readwrite' : 'readonly');
      const key = 'single-player:journey:big-order';
      const store = tx.objectStore('slots');
      const request = replacement ? store.put(replacement, key) : store.get(key);
      return await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }, next);
}

async function deliver(page, amount) {
  await page.locator('#delivery-quantity').fill(String(amount));
  await page.locator(delivery).tap();
  await page.locator('.delivery-details').waitFor();
  await command(page, delivery);
}

export async function firstClose(page) {
  await command(page, '[data-found-company]');
  await navigate(page, 'contracts');
  await command(page, '[data-sign-contract]');
  await navigate(page, 'company');
  await command(page, '[data-order-supply]');
  await command(page, '[data-advance-milestone="supply-arrival"]');
  await command(page, '[data-advance-milestone="delivery-window"]');
  await navigate(page, 'contracts');
  const before = (await readOrReplaceSave(page)).head;
  await page.locator('#delivery-quantity').fill('51');
  await page.locator(delivery).tap();
  await page.locator('.field-error').waitFor();
  assert.equal((await readOrReplaceSave(page)).head, before);
  assert.equal(await page.locator('.invoice-row').count(), 0);

  await deliver(page, 50);
  await command(page, '[data-advance-one]');
  await deliver(page, 20);
  assert.equal(await page.locator('.invoice-row').count(), 2);
  await command(page, '[data-advance-milestone="monthly-close"]');
  assert.equal(JSON.parse((await readOrReplaceSave(page)).head).checkpoint.day, 31);
}

export function snapshot(record) {
  const { checkpoint, commands } = JSON.parse(record.head);
  return { checkpoint, commands };
}

export async function checkMigration(page, url, record) {
  const fields = JSON.parse(record.head);
  const { day, revision, randomState, state } = fields.checkpoint;
  const legacy = JSON.stringify({
    schemaVersion: 1, scenarioId: fields.scenarioId, rulesetVersion: fields.rulesetVersion,
    contentVersion: fields.contentVersion, savedAt: fields.savedAt,
    day, revision, seed: randomState, snapshot: state, commands: fields.commands,
  });
  await readOrReplaceSave(page, { head: legacy, previous: null });
  await open(page, url);
  const migrated = await readOrReplaceSave(page);
  assert.equal(JSON.parse(migrated.head).schemaVersion, 2);
  assert.equal(migrated.previous, legacy);
  assert.deepEqual(snapshot(migrated), snapshot(record));

  await readOrReplaceSave(page, { head: '{', previous: record.head });
  await open(page, url);
  const repaired = await readOrReplaceSave(page);
  assert.deepEqual(snapshot(repaired), snapshot(record));
  assert.equal(repaired.previous, record.head);

  const future = JSON.stringify({ ...fields, schemaVersion: 3 });
  await readOrReplaceSave(page, { head: future, previous: record.head });
  await page.goto(url);
  await page.locator('.save-status[data-state="future-schema"]').waitFor();
  assert.equal(await page.locator('[data-found-company]').isDisabled(), true);
  assert.equal((await readOrReplaceSave(page)).head, future);
  await readOrReplaceSave(page, record);
  await open(page, url);
}
