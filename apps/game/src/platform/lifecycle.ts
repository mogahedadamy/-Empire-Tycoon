/** Bridges browser and Capacitor app-state events without advancing simulation time. */
import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface LifecycleHandlers {
  background(): void;
  foreground(): void;
}

type SubscribeNative = (callback: (isActive: boolean) => void) => Promise<PluginListenerHandle>;

/** Subscribes to lifecycle events and returns an idempotent cleanup function. */
export function bindGameLifecycle(
  handlers: LifecycleHandlers,
  subscribeNative: SubscribeNative | null = Capacitor.isNativePlatform() ? async (callback) => {
    const { App } = await import('@capacitor/app');
    return App.addListener('appStateChange', ({ isActive }) => callback(isActive));
  } : null,
) {
  let tabActive = !document.hidden;
  let appActive = true;
  let active = tabActive;
  let disposed = false;
  let nativeListener: PluginListenerHandle | undefined;

  function update() {
    const next = tabActive && appActive;
    if (active === next || disposed) return;
    active = next;
    if (active) handlers.foreground();
    else handlers.background();
  }

  function visibility() {
    tabActive = !document.hidden;
    update();
  }
  function show() {
    tabActive = !document.hidden;
    const previous = active;
    update();
    if (previous && active && !disposed) handlers.foreground();
  }
  function hide() {
    tabActive = false;
    update();
  }

  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pageshow', show);
  window.addEventListener('pagehide', hide);
  if (subscribeNative) {
    void subscribeNative((isActive) => {
      appActive = isActive;
      update();
    }).then((handle) => {
      if (disposed) return handle.remove();
      nativeListener = handle;
    }).catch(() => {
      // Browser lifecycle events keep checkpoint handling available if native registration fails.
    });
  }

  return () => {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pageshow', show);
    window.removeEventListener('pagehide', hide);
    void nativeListener?.remove().catch(() => {});
  };
}
