/**
 * auth-routes.spec.ts — verifies the SEO-friendly dedicated auth routes:
 *   • /login  opens the Auth modal pinned to the login form
 *   • /signup opens the Auth modal pinned to the signup form (a /signup
 *     link must NEVER show the login form)
 *   • the footer login/signup links navigate between the two URLs so the
 *     address bar always matches the visible form
 *   • SEO <Helmet> meta (title + canonical) is present on both pages
 *
 * Runs against the Vite dev server only — Auth renders without calling
 * the API, so no Daphne/backend is required.
 */
import { test, expect } from '@playwright/test';

test.describe('/login and /signup dedicated auth routes', () => {
  test('/login renders the login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('.auth-card')).toBeVisible();
    // Login form: password field present, NO username field, NO confirm.
    await expect(page.locator('.auth-form input[type="password"]')).toBeVisible();
    await expect(page.locator('.auth-form input[name="username"]')).toHaveCount(0);
    await expect(page.locator('.auth-form input[type="password"]')).toHaveCount(1);
    // Title reflects login, canonical points at the production /login URL.
    await expect(page).toHaveTitle(/Login|Konekte/i);
    const canonical = await page.locator('link[data-rh="true"][rel="canonical"]').getAttribute('href');
    expect(canonical).toBe('https://atelnyo.site/login');
  });

  test('/signup renders the signup form (not login)', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('.auth-card')).toBeVisible();
    // Signup is email-based: email + password + confirm (no username).
    await expect(page.locator('.auth-form input[name="email"]')).toBeVisible();
    await expect(page.locator('.auth-form input[type="password"]')).toHaveCount(2);
    await expect(page).toHaveTitle(/Sign ?up|Kreye|Enregistrer|Regístrate/i);
    const canonical = await page.locator('link[data-rh="true"][rel="canonical"]').getAttribute('href');
    expect(canonical).toBe('https://atelnyo.site/signup');
  });

  test('login footer "Sign up" link navigates to /signup and swaps the form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('.auth-card')).toBeVisible();
    // Click the "No account? Sign up" footer link.
    await page.locator('.auth-footer .auth-link', { hasText: /Sign ?up|Kreye/i }).click();
    // URL now matches the visible (email-based) signup form.
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.locator('.auth-form input[name="email"]')).toBeVisible();
  });

  test('signup footer "Login" link navigates to /login', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('.auth-card')).toBeVisible();
    await page.locator('.auth-footer .auth-link', { hasText: /Login|Konekte/ }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.auth-form input[name="username"]')).toHaveCount(0);
  });

  test('legacy /sheet/auth still renders the auth modal', async ({ page }) => {
    await page.goto('/sheet/auth');
    await expect(page.locator('.auth-card')).toBeVisible();
  });
});
