/** End-to-end acceptance test for the Single-Shell USD Investor Super-App on a phone viewport. */
import assert from 'node:assert/strict';
import { audit } from './accessibility.mjs';

export async function verifyInvestorSuperApp(page, baseUrl) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-tap-earn]').waitFor();

  // 1. Starts at $0.00 on center Earnings tab with all 5 persistent bottom tabs.
  assert.equal(await page.locator('[data-nav-tab]').count(), 5);
  assert.equal(await page.locator('[data-live-balance="exact"]').textContent(), '$ 0.00');
  assert.equal(await page.locator('[data-upgrade-tap]').isDisabled(), true);

  // 2. Each tap earns $1.00; Focus Sprint multiplies to $3.00/tap.
  await page.locator('[data-tap-earn]').tap();
  assert.equal(await page.locator('[data-live-balance="exact"]').textContent(), '$ 1.00');
  await page.locator('[data-tap-boost]').tap();
  await page.locator('[data-tap-earn]').tap();
  assert.equal(await page.locator('[data-live-balance="exact"]').textContent(), '$ 4.00');
  await audit(page, 'Arabic Investor Earnings screen');

  // 3. Business tab -> Start a Business pushed sub-screen hides bottom nav and shows top Back + live Balance.
  await page.locator('[data-nav-tab="business"]').tap();
  await page.locator('[data-open-start-business]').tap();
  assert.equal(await page.locator('.bottom-nav').count(), 0);
  assert.equal(await page.locator('[data-empire-back]').count(), 1);
  assert.equal(await page.locator('[data-found-sector]').count(), 5);
  assert.equal(await page.locator('[data-found-sector="food"]').isDisabled(), true);
  assert.match(await page.locator('.header-balance-val').textContent(), /\$ 4\.00/);
  await audit(page, 'Arabic Start a Business catalog');

  // Pressing Back pops smoothly back to Business root tab (NOT an isolated dead-end page).
  await page.locator('[data-empire-back]').tap();
  assert.equal(await page.locator('.bottom-nav').count(), 1);
  assert.equal(await page.locator('[data-open-start-business]').count(), 1);

  // 4. Investing tab -> 3 segmented sub-tabs including explicit Real Estate Rent/hr & ROI%.
  await page.locator('[data-nav-tab="investing"]').tap();
  await page.locator('[data-invest-sub="real-estate"]').tap();
  const propText = await page.locator('.property-card').first().textContent();
  assert.match(propText, /الإيجار \/ ساعة/);
  assert.match(propText, /العائد الساعي/);
  await page.locator('[data-invest-sub="digital"]').tap();
  assert.ok((await page.locator('.market-row-card').count()) >= 5);

  // 5. Items tab & Profile tab + Forbes leaderboard push/pop + language switch + 200% zoom reflow.
  await page.locator('[data-nav-tab="items"]').tap();
  assert.ok((await page.locator('.luxury-item-card').count()) >= 2);
  await page.locator('[data-nav-tab="profile"]').tap();
  await page.locator('[data-open-forbes]').tap();
  assert.equal(await page.locator('.forbes-row.is-player').count(), 1);
  await page.locator('[data-empire-back]').tap();
  await audit(page, 'Arabic Investor Profile');

  // Switch to English and check zero horizontal overflow at 360px and 200% zoom.
  await page.locator('[data-nav-tab="earnings"]').tap();
  await page.locator('.empire-lang-btn').tap();
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });

  // 6. Persistence across reload retains exact earned USD balance.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-tap-earn]').waitFor();
  assert.equal(await page.locator('[data-live-balance="exact"]').textContent(), '$ 4.00');
}
