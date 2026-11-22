/** Audits key screens, reflow, touch sizing, and keyboard interaction in Chromium. */
import assert from 'node:assert/strict';
import axeCore from 'axe-core';
import { navigate } from './journey.mjs';

export async function audit(page, screen) {
  await page.addScriptTag({ content: axeCore.source });
  const results = await page.evaluate(async () => {
    const { violations } = await axe.run({
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    });
    return violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target.join(' ')) }));
  });
  assert.deepEqual(results, [], `${screen} accessibility violations`);
}

export async function reviewLayout(page) {
  for (const locale of ['en', 'ar']) {
    if (await page.locator('html').getAttribute('lang') !== locale) await page.locator('.language').tap();
    assert.equal(await page.locator('html').getAttribute('dir'), locale === 'ar' ? 'rtl' : 'ltr');
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const screen of ['overview', 'contracts', 'finance']) {
        await navigate(page, screen);
        await checkGeometry(page, `${locale} ${width}px ${screen}`);
        if (width === 360) await audit(page, `${locale} ${screen}`);
      }
    }

    await page.setViewportSize({ width: 360, height: 844 });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    try {
      for (const screen of ['overview', 'contracts', 'finance']) {
        await navigate(page, screen);
        await checkGeometry(page, `${locale} 200% ${screen}`);
      }
    } finally {
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    }
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.language').evaluate((button) => getComputedStyle(button).transitionDuration), '0s');
  const entry = page.locator('[data-entry]').first();
  await entry.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.equal(await entry.evaluate((button) => document.activeElement === button), true);
}

async function checkGeometry(page, label) {
  const geometry = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const width = document.documentElement.scrollWidth;
    const overflow = width > viewport ? [...document.querySelectorAll('#app *')].filter((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.left < -1 || bounds.right > viewport + 1;
    }).slice(0, 10).map((element) => `${element.tagName}.${element.className}`) : [];
    const targets = [...document.querySelectorAll('.nav-item, .language, [data-advance-one], [data-advance-milestone]')]
      .map((element) => [element.textContent, element.offsetWidth, element.offsetHeight]);
    return { viewport, width, overflow, targets };
  });
  assert.ok(geometry.width <= geometry.viewport, `${label} overflows by ${geometry.width - geometry.viewport}px (${geometry.overflow.join(', ')})`);
  for (const [text, width, height] of geometry.targets) {
    assert.ok(width >= 44 && height >= 44, `${label} target ${text} is ${width}×${height}px`);
  }
}
