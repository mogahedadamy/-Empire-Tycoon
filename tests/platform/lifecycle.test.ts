/** Exercises native and web lifecycle ordering, plus late listener cleanup. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { bindGameLifecycle } from '../../apps/game/src/platform/lifecycle';

let page: EventTarget;
let documentTarget: EventTarget & { hidden: boolean };

beforeEach(() => {
  page = new EventTarget();
  documentTarget = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('window', page);
  vi.stubGlobal('document', documentTarget);
});
afterEach(() => vi.unstubAllGlobals());

it('combines Capacitor background and browser visibility without duplicate transitions', async () => {
  const foreground = vi.fn();
  const background = vi.fn();
  const remove = vi.fn(async () => {});
  let native: (isActive: boolean) => void = () => {};
  const dispose = bindGameLifecycle({ foreground, background }, async (callback) => {
    native = callback;
    return { remove };
  });
  await Promise.resolve();

  native(false);
  documentTarget.hidden = true;
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  expect(background).toHaveBeenCalledTimes(1);

  native(true);
  expect(foreground).not.toHaveBeenCalled();
  documentTarget.hidden = false;
  documentTarget.dispatchEvent(new Event('visibilitychange'));
  expect(foreground).toHaveBeenCalledTimes(1);

  dispose();
  dispose();
  native(false);
  expect(background).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
});

it('handles pagehide and pageshow if the native app plugin is unavailable', () => {
  const foreground = vi.fn();
  const background = vi.fn();
  const dispose = bindGameLifecycle({ foreground, background }, null);
  page.dispatchEvent(new Event('pagehide'));
  expect(background).toHaveBeenCalledOnce();
  page.dispatchEvent(new Event('pageshow'));
  expect(foreground).toHaveBeenCalledOnce();
  dispose();
  page.dispatchEvent(new Event('pagehide'));
  expect(background).toHaveBeenCalledOnce();
});

it('removes a subscription that completes after the view was disposed', async () => {
  const remove = vi.fn(async () => {});
  let resolve: (value: { remove: typeof remove }) => void = () => {};
  const native = new Promise<{ remove: typeof remove }>((done) => { resolve = done; });
  const dispose = bindGameLifecycle({ foreground() {}, background() {} }, () => native);
  dispose();
  resolve({ remove });
  await native;
  expect(remove).toHaveBeenCalledOnce();
});
