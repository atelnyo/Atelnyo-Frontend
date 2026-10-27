// @vitest-environment jsdom
/**
 * loadPayPalScript — deadline on the SDK download.
 *
 * The loader used to reject only on `script.onerror`. A request that is
 * accepted and never answered (captive portal, dropped mobile connection,
 * blocked host) fires neither onload nor onerror, so the checkout surface
 * waited forever on "Loading secure payment options…" with a disabled button.
 * These tests pin the new contract: the load is abandoned, the cached promise
 * is released (so the next attempt injects a fresh script), and the error
 * carries code 'timeout' so callers can say what actually happened.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const loadModule = () => import('./CheckoutModal');

const scriptInDom = () => document.querySelectorAll('script[src*="paypal"]').length;

describe('loadPayPalScript deadline', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    document.body.innerHTML = '';
    delete window.paypal;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.paypal;
  });

  it('abandons a request that is never answered, and clears the script', async () => {
    const { loadPayPalScript } = await loadModule();

    const pending = loadPayPalScript('cid', true, 'capture', 15000);
    expect(scriptInDom()).toBe(1);

    const rejected = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    vi.advanceTimersByTime(15000);
    await rejected;

    // The dead script tag is not left behind pretending to still be loading.
    expect(scriptInDom()).toBe(0);
  });

  it('does not give up before the deadline', async () => {
    const { loadPayPalScript } = await loadModule();

    let settled = false;
    loadPayPalScript('cid', true, 'capture', 15000).then(() => { settled = true; }, () => { settled = true; });

    vi.advanceTimersByTime(14999);
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(scriptInDom()).toBe(1);
  });

  it('resolves on load and cancels the deadline', async () => {
    const { loadPayPalScript } = await loadModule();

    const pending = loadPayPalScript('cid', true, 'capture', 1000);
    const script = document.querySelector('script[src*="paypal"]');
    window.paypal = { Buttons: () => ({ render: () => Promise.resolve() }) };
    script.onload();

    await expect(pending).resolves.toBe(window.paypal);

    // The deadline is disarmed: letting it elapse changes nothing (a live
    // timer would have torn the script down and released the cache).
    vi.advanceTimersByTime(2000);
    await expect(pending).resolves.toBe(window.paypal);
    expect(scriptInDom()).toBe(1);
  });

  it('a late onload after the deadline cannot resurrect the failed load', async () => {
    const { loadPayPalScript } = await loadModule();

    const pending = loadPayPalScript('cid', true, 'capture', 1000);
    const script = document.querySelector('script[src*="paypal"]');

    const rejected = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    vi.advanceTimersByTime(1000);
    await rejected;

    // The browser finally answers — it must not flip the outcome.
    expect(() => script.onload?.()).not.toThrow();
    await expect(pending).rejects.toMatchObject({ code: 'timeout' });
  });

  it('lets a retry inject a fresh script after a timeout', async () => {
    const { loadPayPalScript } = await loadModule();

    const first = loadPayPalScript('cid', true, 'capture', 1000);
    const failed = expect(first).rejects.toMatchObject({ code: 'timeout' });
    vi.advanceTimersByTime(1000);
    await failed;

    // The cached promise must be released, otherwise every retry would
    // immediately reject again with the stale failure.
    const second = loadPayPalScript('cid', true, 'capture', 1000);
    expect(scriptInDom()).toBe(1);

    const script = document.querySelector('script[src*="paypal"]');
    window.paypal = { Buttons: () => ({ render: () => Promise.resolve() }) };
    script.onload();

    await expect(second).resolves.toBe(window.paypal);
  });
});
