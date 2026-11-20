import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * H-1 (final audit, iteration 2): make a route chunk available BEFORE
 * hydrateRoot runs, so the first client render is the resolved route
 * component — not the Suspense fallback.
 *
 * Why a plain `await import(...)` is NOT enough: React.lazy's
 * initializer (React 19.3 `lazyInitializer`, verified in
 * node_modules/react/cjs/react.development.js) calls the factory, then
 * calls `.then()` on the returned thenable and IMMEDIATELY checks the
 * payload status. A native promise — even one that already resolved —
 * only runs its `.then` callbacks as microtasks, so the status is still
 * "pending" during that synchronous check and React suspends. The
 * Suspense fallback then mismatches the prerendered page → React error
 * 418 → the whole page is discarded and client-rendered (CLS 0.38–1.62).
 * That is exactly what iteration 1's preview showed: the prerender-data
 * seeding was correct, but the lazy route chunk had not loaded when
 * hydrateRoot ran, so every prerendered page 418'd anyway.
 *
 * The fix is a thenable whose `.then()` invokes its callback
 * SYNCHRONOUSLY when the module is already in memory (see
 * `syncThenable` below). `main.tsx` awaits the current route's chunk
 * before calling `hydrateRoot`; the lazy factory then resolves
 * synchronously and hydration matches the snapshot.
 *
 * On later client-side navigations the chunk is not preloaded, so the
 * factory returns the real import promise and the Suspense fallback
 * behaves exactly as before (there is no prerendered HTML to mismatch
 * on a client-side navigation).
 */
function syncThenable<T>(value: T): { then: (onFulfilled: (value: T) => void) => void } {
  return {
    then(onFulfilled: (value: T) => void) {
      onFulfilled(value);
    },
  };
}

export interface PreloadableRoute {
  Component: LazyExoticComponent<ComponentType<unknown>>;
  load: () => Promise<{ default: ComponentType<unknown> }>;
}

export function createPreloadableRoute(
  importer: () => Promise<{ default: ComponentType<unknown> }>,
): PreloadableRoute {
  let loaded: { default: ComponentType<unknown> } | null = null;
  let promise: Promise<{ default: ComponentType<unknown> }> | null = null;

  const load = (): Promise<{ default: ComponentType<unknown> }> => {
    if (!promise) {
      promise = importer().then((mod) => {
        loaded = mod;
        return mod;
      });
    }
    return promise;
  };

  const Component = lazy(() => {
    if (loaded) {
      // Module already in memory: resolve synchronously so the first
      // render (hydration) does not suspend on the Suspense fallback.
      return syncThenable(loaded) as unknown as Promise<{
        default: ComponentType<unknown>;
      }>;
    }
    return load();
  });

  return { Component, load };
}
