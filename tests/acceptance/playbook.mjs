/** Exercises the campaign launcher, difficulty selection and independent free-play save in the production UI. */
import assert from 'node:assert/strict';
import { audit } from './accessibility.mjs';
import { open } from './journey.mjs';

async function missionMove(page, step, next) {
  await page.locator('[data-mission-action=' + step + ']').tap();
  await page.locator('[data-mission-step=' + next + ']').waitFor();
  await page.locator('.save-status[data-state=saved]').waitFor();
}

export async function verifyPlaybook(page, url) {
  await open(page, url);
  await page.locator('[data-choose-industry]').tap();
  await page.locator('[data-open-playbook]').tap();
  await page.getByRole('heading', { name: 'الحملة واللعب الحر' }).waitFor();
  assert.equal(await page.locator('[data-playbook-run]').count(), 4);
  await audit(page, 'campaign and free-play selection');
  await page.locator('input[name=difficulty][value=expert]').check();
  await page.locator('[data-playbook-run=campaign-harbor-supply-expert]').tap();
  await page.locator('.save-status[data-state=saved]').waitFor();
  assert.equal(await page.locator('#page-title').textContent(), 'تموين الميناء');
  assert.equal(await page.locator('input[name=guidance][value=off]').isChecked(), true);

  await page.locator('[data-open-playbook]').tap();
  await page.locator('[data-playbook-run=campaign-harbor-supply-supported]').tap();
  await page.locator('[data-mission-step=found]').waitFor();
  await missionMove(page, 'found', 'contract');
  assert.match(await page.locator('.mission-decision').textContent(), /مطابخ الميناء/);
  await missionMove(page, 'contract', 'order');
  await missionMove(page, 'order', 'arrival');
  await missionMove(page, 'arrival', 'delivery-day');
  await missionMove(page, 'delivery-day', 'ship');
  await missionMove(page, 'ship', 'next-trip');
  assert.equal(await page.locator('.mission-count').textContent(), '٣٦ من ٩٦');
  const campaign = page.url();
  await page.reload();
  await page.locator('[data-mission-step=next-trip]').waitFor();
  assert.equal(await page.locator('.mission-count').textContent(), '٣٦ من ٩٦');

  await page.goto(url + '?playbook=1');
  await page.locator('[data-playbook-run=sandbox-harbor-supply-supported]').tap();
  await page.locator('[data-mission-step=found]').waitFor();
  await page.goto(campaign);
  await page.locator('[data-mission-step=next-trip]').waitFor();
}
