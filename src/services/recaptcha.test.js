/**
 * Unit tests for src/services/recaptcha.js (T008).
 *
 * Pins the SOFT-fallback contract: with no site key configured, or with
 * a broken Google script, every helper returns '' / null so sign-in is
 * never blocked by a missing/broken CAPTCHA (the backend's env-gated
 * verification is a no-op in that case anyway).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Fresh module per test: the module keeps an internal script-promise
// cache, so re-importing isolates state between cases.
async function freshRecaptcha() {
  vi.resetModules();
  return import('./recaptcha');
}

describe('recaptcha helper', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty token when no site key is configured', async () => {
    const recaptcha = await freshRecaptcha();
    expect(await recaptcha.executeRecaptcha('', 'login')).toBe('');
    expect(await recaptcha.executeRecaptcha('   ', 'login')).toBe('');
  });

  it('caches runtime site keys and resolves them back', async () => {
    const recaptcha = await freshRecaptcha();
    recaptcha.cacheRecaptchaKeys({ siteKey: 'v3-key', v2SiteKey: 'v2-key' });
    expect(recaptcha.getRecaptchaV3Key()).toBe('v3-key');
    expect(recaptcha.getRecaptchaV2Key()).toBe('v2-key');
    expect(recaptcha.isRecaptchaConfigured('v3-key')).toBe(true);
    expect(recaptcha.isRecaptchaConfigured('')).toBe(false);
  });

  it('executes a v3 token through the grecaptcha handle', async () => {
    const recaptcha = await freshRecaptcha();
    const execute = vi.fn().mockResolvedValue('token-123');
    window.grecaptcha = { execute };
    const token = await recaptcha.executeRecaptcha('site-key', 'login');
    expect(token).toBe('token-123');
    expect(execute).toHaveBeenCalledWith('site-key', { action: 'login' });
  });

  it('fails soft when grecaptcha lacks an execute method', async () => {
    const recaptcha = await freshRecaptcha();
    window.grecaptcha = {};
    expect(await recaptcha.executeRecaptcha('site-key', 'login')).toBe('');
  });

  it('fails soft when execute throws', async () => {
    const recaptcha = await freshRecaptcha();
    window.grecaptcha = {
      execute: vi.fn().mockRejectedValue(new Error('recaptcha down')),
    };
    expect(await recaptcha.executeRecaptcha('site-key', 'login')).toBe('');
  });

  it('returns null from the v2 renderer when no key/container is given', async () => {
    const recaptcha = await freshRecaptcha();
    expect(await recaptcha.renderV2Checkbox(null, 'v2-key')).toBeNull();
    expect(await recaptcha.renderV2Checkbox(document.createElement('div'), '')).toBeNull();
  });
});
