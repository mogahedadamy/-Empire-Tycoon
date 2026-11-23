/** Gates the production Big Order journey on real DOM, Worker, and IndexedDB behavior. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { audit, reviewLayout } from './accessibility.mjs';
import { verifyAiFounding } from './ai-founding.mjs';
import { verifyInvestorSuperApp } from './empire.mjs';
import { checkMigration, command, firstClose, navigate, open, readOrReplaceSave, snapshot } from './journey.mjs';
import { verifyOpeningMission } from './mission.mjs';
import { verifyPlaybook } from './playbook.mjs';
import { verifyOperatingProjects } from './projects.mjs';

let server;
let context;
let profile;
let baseUrl;
let url;
let missionUrl;

const executablePath = process.env.EMPIRE_CHROMIUM_PATH ?? '/usr/bin/chromium';

function launch() {
  return chromium.launchPersistentContext(profile, {
    executablePath,
    viewport: { width: 360, height: 844 }, hasTouch: true,
  });
}

before(async () => {
  server = await preview({ root: 'apps/game', preview: { host: '127.0.0.1' } });
  baseUrl = `http://127.0.0.1:${server.httpServer.address().port}/`;
  missionUrl = `${baseUrl}?mode=mission`;
  url = `${baseUrl}?mode=management`;
  profile = await mkdtemp(join(tmpdir(), 'empire-acceptance-'));
  context = await launch();
  context.setDefaultTimeout(8000);
  console.log((await (await context.newCDPSession(context.pages()[0])).send('Browser.getVersion')).product);
});

test('opens the Single-Shell USD Investor Super-App at / with $1/tap, 5-tab nav, sub-screen back flow, and reload persistence', { timeout: 80_000 }, async () => {
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 }, hasTouch: true });
    page.setDefaultTimeout(8000);
    await verifyInvestorSuperApp(page, baseUrl);
  } finally {
    await browser.close();
  }
});

test('opens the default Android-sized mission and leads to a confirmed delivery', { timeout: 80_000 }, async () => {
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 }, hasTouch: true });
    page.setDefaultTimeout(8000);
    await verifyOpeningMission(page, missionUrl);
  } finally {
    await browser.close();
  }
});

test('chooses any operating sector and confirms its opening decision on a phone-sized viewport', { timeout: 80_000 }, async () => {
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 }, hasTouch: true });
    page.setDefaultTimeout(8000);
    await verifyOperatingProjects(page, missionUrl);
  } finally {
    await browser.close();
  }
});

test('launches authored chapters and independent free play on a phone-sized viewport', { timeout: 80_000 }, async () => {
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 }, hasTouch: true });
    page.setDefaultTimeout(8000);
    await verifyPlaybook(page, missionUrl);
  } finally {
    await browser.close();
  }
});

test('compares and founds an AI company without changing the food save', { timeout: 80_000 }, async () => {
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: 360, height: 800 }, hasTouch: true });
    page.setDefaultTimeout(8000);
    await verifyAiFounding(page, missionUrl);
  } finally {
    await browser.close();
  }
});

after(async () => {
  await context?.close();
  if (server) await new Promise((resolve) => server.httpServer.close(resolve));
  if (profile) await rm(profile, { recursive: true, force: true });
});

test('plays, reconciles, migrates and restores the Big Order through a production Chromium build', { timeout: 120_000 }, async (t) => {
  let page = context.pages()[0];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page, url);
  await t.test('touch targets, contract review, capacity rejection and Day 30 close', async () => {
    await audit(page, 'Arabic setup');
    await firstClose(page);
  });
  const closed = await readOrReplaceSave(page);
  await navigate(page, 'overview');
  const deferBox = await page.locator('[data-defer-restock]').boundingBox();
  assert.ok(deferBox && deferBox.y + deferBox.height <= 800, 'Day 31 buy/defer trade-off should fit above the phone fold');
  assert.match(await page.locator('.decision-card').textContent(), /٤٠٠/);
  await command(page, '[data-approve-restock]');
  await page.locator('[data-distress-stage="warning"]').waitFor();
  const earlyBox = await page.locator('[data-collect-early]').boundingBox();
  assert.ok(earlyBox && earlyBox.y + earlyBox.height <= 800, 'Primary crisis containment action should fit above the phone fold');
  assert.equal(await page.locator('.metric-profit h2').textContent(), 'صافي ربح الشهر الأول');
  assert.match(await page.locator('.metric-profit .metric-subrows').textContent(), /الربح منذ التأسيس/);
  const warning = await readOrReplaceSave(page);

  await t.test('reconciles financial statements by period after a new cash transaction', async () => {
    await page.locator('.language').tap();
    await navigate(page, 'finance');
    await assertAmounts(page, ['600']);
    await page.locator('[data-statement="balance"]').tap();
    await assertAmounts(page, ['26,800', '41,150', '10,550', '30,600']);
    await page.locator('[data-statement="flow"]').tap();
    await assertAmounts(page, ['0', '-7,200', '-6,000', '40,000', '26,800']);
    assert.ok((await journalDays(page)).every((day) => day <= 30));
    await page.locator('[data-period="month-2"]').tap();
    await assertAmounts(page, ['26,800', '-25,000', '0', '0', '1,800']);
    assert.ok((await journalDays(page)).every((day) => day === 31));
    await page.locator('[data-period="cumulative"]').tap();
    await assertAmounts(page, ['0', '-32,200', '-6,000', '40,000', '1,800']);
  });

  await t.test('reflows in both directions with text zoom and passes automated accessibility checks', async () => {
    await reviewLayout(page);
  });

  await t.test('reopens the same checkpoint after browser exit and completes the recovery route', async () => {
    await context.close();
    context = await launch();
    context.setDefaultTimeout(8000);
    page = context.pages()[0];
    page.on('pageerror', (error) => errors.push(error.message));
    await open(page, missionUrl);
    assert.deepEqual(snapshot(await readOrReplaceSave(page)), snapshot(warning));
    await page.locator('[data-distress-stage="warning"]').waitFor();
    await command(page, '[data-collect-early]');
    await command(page, '[data-advance-milestone="rent-due"]');
    await command(page, '[data-advance-milestone="scenario-end"]');
    await page.locator('.report-panel .notice.success').waitFor();
  });

  await t.test('preserves a checkpoint when migrating, repairing, and refusing a future save', async () => {
    await checkMigration(page, url, closed);
  });

  await t.test('rejects partial rent payment and reports default without losing the books', async () => {
    await readOrReplaceSave(page, warning);
    await open(page, url);
    await command(page, '[data-advance-one]');
    await command(page, '[data-pay-obligation="warehouse-rent-32"]');
    await page.locator('[data-distress-stage="payment-shortfall"]').waitFor();
    for (let day = 32; day <= 35; day += 1) {
      if (await page.locator('[data-distress-stage="default"]').count()) break;
      const alert = page.locator('[data-ack-alert]').first();
      if (await alert.count()) await command(page, '[data-ack-alert]');
      await command(page, '[data-advance-one]');
    }
    await page.locator('[data-distress-stage="default"]').waitFor();
    await command(page, '[data-end-company]');
    await page.locator('.report-panel .notice.error').waitFor();
    await navigate(page, 'finance');
    await page.locator('#journal-title').waitFor();
    assert.deepEqual(errors, []);
  });
});

async function assertAmounts(page, expected) {
  const amounts = await page.locator('.company-content .view-stack > section:first-child dl dd bdi').allTextContents();
  assert.deepEqual(amounts.map((amount) => amount.replace('−', '-')), expected);
}

async function journalDays(page) {
  const days = await page.locator('.journal-panel tbody td:nth-child(2) bdi').allTextContents();
  assert.ok(days.length > 0);
  return days.map(Number);
}
