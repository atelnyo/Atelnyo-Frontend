/**
 * e2e/community-posts-ui.spec.ts
 *
 * Chromium QA for the Community 2.0 posts feed. Mounts the REAL
 * CommunityPosts component through e2e/community-harness.html and stubs
 * /api/** with page.route(), so no backend or database is touched.
 *
 * Covers the requirements that jsdom cannot check:
 *   • composer is compact, auto-grows, and its publish row stays visible
 *     at 320–1440px with no horizontal overflow
 *   • the assistant FAB is hidden on mobile while the composer is focused
 *   • author / non-author / moderator menus expose the right actions
 *   • reactions toggle, swap and roll the counts correctly
 *   • search keeps the field, shows results and returns to the feed
 *   • long URLs + long usernames wrap inside the card
 *   • timestamps, avatars, dark mode render
 *   • publish / delete update the feed and count without a reload
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = '/tmp/community-qa';

const AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#0ea5e9"/><text x="40" y="52" font-size="38" text-anchor="middle" fill="#fff">M</text></svg>',
  );

const LONG_URL =
  'https://example.com/' + 'very-long-segment/'.repeat(24) + '?token=' + 'x'.repeat(120);

type Post = Record<string, any>;

type ApiState = {
  posts: Post[];
  searchQueries: string[];
  createdBodies: Post[];
  deletedIds: number[];
};

function makePosts(): Post[] {
  const now = Date.now();
  return [
    {
      id: 101,
      author: 7,
      author_username: 'jhon',
      author_avatar: '',
      content: `Bonjou tout moun! Gade lyen sa: ${LONG_URL}`,
      created_at: new Date(now - 2 * 60_000).toISOString(),
      reaction_count: 3,
      reactions: { '❤️': 2, '👍': 1 },
      my_reaction: '❤️',
      is_pinned: false,
      comment_count: 2,
      image_url: '',
      video_url: '',
      poll_question: '',
    },
    {
      id: 102,
      author: 9,
      author_username: 'a_very_long_username_that_must_not_push_the_menu_off_the_card',
      author_avatar: AVATAR,
      content: 'Annonce epengle: biwo a ap louvri demen maten.',
      created_at: new Date(now - 3_600_000).toISOString(),
      reaction_count: 0,
      reactions: {},
      my_reaction: null,
      is_pinned: true,
      comment_count: 0,
      image_url: '',
      video_url: '',
      poll_question: '',
    },
    {
      id: 103,
      author: 9,
      author_username: 'marie',
      author_avatar: '',
      content: 'Ansyen pòs ak yon videyo: https://youtu.be/dQw4w9WgXcQ',
      created_at: '2024-03-05T14:30:00Z',
      reaction_count: 1,
      reactions: { '🎉': 1 },
      my_reaction: null,
      is_pinned: false,
      comment_count: 0,
      image_url: '',
      video_url: '',
      poll_question: '',
    },
  ];
}

function json(route: any, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installApi(page: Page): Promise<ApiState> {
  const state: ApiState = { posts: makePosts(), searchQueries: [], createdBodies: [], deletedIds: [] };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname === '/api/community-posts/' && method === 'GET') {
      const q = (url.searchParams.get('search') || '').trim().toLowerCase();
      state.searchQueries.push(q);
      const needle = q.replace(/^@/, '');
      const results = q
        ? state.posts.filter(
            (post) =>
              String(post.content).toLowerCase().includes(needle) ||
              String(post.author_username).toLowerCase().includes(needle),
          )
        : state.posts;
      return json(route, { count: results.length, next: null, previous: null, results });
    }

    if (pathname === '/api/community-posts/' && method === 'POST') {
      const body = (request.postDataJSON() || {}) as Post;
      state.createdBodies.push(body);
      const created: Post = {
        id: 999,
        author: 7,
        author_username: 'jhon',
        author_avatar: '',
        content: body.content || '',
        image_url: body.image_url || '',
        video_url: body.video_url || '',
        created_at: new Date().toISOString(),
        reaction_count: 0,
        reactions: {},
        my_reaction: null,
        is_pinned: false,
        comment_count: 0,
      };
      state.posts.unshift(created);
      return json(route, created, 201);
    }

    const reactMatch = pathname.match(/^\/api\/community-posts\/(\d+)\/react\/$/);
    if (reactMatch && method === 'POST') {
      const post = state.posts.find((row) => row.id === Number(reactMatch[1]));
      if (!post) return json(route, { detail: 'Not found.' }, 404);
      const emoji = (request.postDataJSON() || {}).emoji as string;
      const had = post.my_reaction === emoji;
      const reactions: Record<string, number> = { ...(post.reactions || {}) };
      if (post.my_reaction) {
        reactions[post.my_reaction] = Math.max(0, (reactions[post.my_reaction] || 1) - 1);
        if (!reactions[post.my_reaction]) delete reactions[post.my_reaction];
      }
      if (!had) reactions[emoji] = (reactions[emoji] || 0) + 1;
      post.reactions = reactions;
      post.my_reaction = had ? null : emoji;
      post.reaction_count = Object.values(reactions).reduce((sum, n) => sum + n, 0);
      return json(route, post);
    }

    const itemMatch = pathname.match(/^\/api\/community-posts\/(\d+)\/$/);
    if (itemMatch) {
      const id = Number(itemMatch[1]);
      const index = state.posts.findIndex((row) => row.id === id);
      if (method === 'DELETE') {
        state.deletedIds.push(id);
        if (index >= 0) state.posts.splice(index, 1);
        return route.fulfill({ status: 204, body: '' });
      }
      if (method === 'PATCH') {
        if (index < 0) return json(route, { detail: 'Not found.' }, 404);
        Object.assign(state.posts[index], request.postDataJSON() || {});
        return json(route, state.posts[index]);
      }
      if (method === 'GET') {
        if (index < 0) return json(route, { detail: 'Not found.' }, 404);
        return json(route, state.posts[index]);
      }
    }

    if (pathname.startsWith('/api/content/')) return json(route, { ok: true });
    return json(route, {});
  });

  return state;
}

async function openHarness(page: Page, query = '') {
  await page.goto(`http://127.0.0.1:3000/e2e/community-harness.html${query}`);
  await expect(page.getByTestId('posts-count')).toBeVisible();
}

function shotPath(name: string) {
  fs.mkdirSync(SHOTS, { recursive: true });
  return path.join(SHOTS, name);
}

test.describe('Community posts — Chromium UI', () => {
  test('member composer: compact, auto-grows, sticky publish row, FAB hidden', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installApi(page);
    await openHarness(page, '?mode=member');

    const composer = page.locator('.c-post-composer');
    const input = page.getByTestId('post-composer-input');
    const submit = page.getByTestId('post-composer-submit');

    await expect(composer).toBeVisible();
    await expect(submit).toBeDisabled(); // empty draft

    const initial = (await input.boundingBox())!.height;
    // 44px content-box min-height + 10px vertical padding + border.
    expect(initial, 'empty composer starts as a single compact line').toBeLessThanOrEqual(72);

    await input.fill(Array.from({ length: 14 }, (_, i) => `Line ${i + 1}`).join('\n'));
    await expect
      .poll(async () => (await input.boundingBox())!.height)
      .toBeGreaterThan(initial + 40);

    const grown = (await input.boundingBox())!.height;
    // DRAFT_MAX_HEIGHT caps the content box at 220px; padding adds 20px.
    expect(grown, 'auto-grow respects the 220px content cap').toBeLessThanOrEqual(242);
    await expect(input).toHaveCSS('overflow-y', 'auto');
    await expect(submit).toBeEnabled();

    // Focus keeps the editor visible and lets the CSS hide the mobile FAB.
    await input.focus();
    await expect(page.locator('body')).toHaveClass(/community-composing/);
    await expect(page.getByTestId('fake-fab')).toBeHidden();

    const row = page.locator('.c-post-composer-row');
    const rowStyle = await row.evaluate((el) => getComputedStyle(el).position);
    expect(rowStyle, 'publish row is sticky while composing on mobile').toBe('sticky');

    await submit.scrollIntoViewIfNeeded();
    const buttonBox = (await submit.boundingBox())!;
    expect(buttonBox.y + buttonBox.height, 'Publish stays inside the viewport').toBeLessThanOrEqual(813);

    const overflow = await composer.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, 'composer never scrolls horizontally').toBeLessThanOrEqual(1);

    // Draft survives a focus/blur cycle (toolbar click) without being cleared.
    await page.getByTestId('post-composer-link-btn').click();
    await expect(input).toHaveValue(/Line 14/);

    await page.screenshot({ path: shotPath('composer-375-focused.png'), fullPage: true });
  });

  test('no horizontal overflow at 320 / 375 / 768 / 1024 / 1440', async ({ page }) => {
    for (const [width, height] of [
      [320, 568],
      [375, 812],
      [768, 1024],
      [1024, 768],
      [1440, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      await installApi(page);
      await openHarness(page, '?mode=member');
      await expect(page.getByTestId('community-post-101')).toBeVisible();

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(metrics.scrollWidth, `document overflow at ${width}px`).toBeLessThanOrEqual(metrics.clientWidth + 1);

      const card = page.getByTestId('community-post-101');
      const cardBox = (await card.boundingBox())!;
      expect(cardBox.x, `card starts inside the viewport at ${width}px`).toBeGreaterThanOrEqual(-1);
      expect(cardBox.x + cardBox.width, `card fits at ${width}px`).toBeLessThanOrEqual(width + 1);

      const cardOverflow = await card.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(cardOverflow, `post card scrolls horizontally at ${width}px`).toBeLessThanOrEqual(1);

      // A 120-char URL path must wrap, not widen the card.
      const link = card.locator('.c-post-content a').first();
      await expect(link).toBeVisible();
      const linkBox = (await link.boundingBox())!;
      expect(linkBox.width, `long URL stays inside the card at ${width}px`).toBeLessThanOrEqual(cardBox.width);

      await page.screenshot({ path: shotPath(`feed-${width}.png`), fullPage: true });
    }
  });

  test('mobile FAB returns at desktop and non-member has no composer', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await installApi(page);
    await openHarness(page, '?mode=member');
    await page.getByTestId('post-composer-input').focus();
    await expect(page.getByTestId('fake-fab')).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('http://127.0.0.1:3000/e2e/community-harness.html?mode=nonmember');
    await expect(page.getByTestId('posts-count')).toBeVisible();
    await expect(page.locator('.c-posts-join-note')).toBeVisible();
    await expect(page.locator('.c-post-composer')).toHaveCount(0);
    await expect(page.getByTestId('posts-search-input')).toBeVisible();
    await page.screenshot({ path: shotPath('nonmember-375.png'), fullPage: true });
  });

  test('action menu: author gets Edit/Delete, non-author gets Report, moderator gets Pin/Delete', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await installApi(page);
    await openHarness(page, '?mode=member');

    // Author (post 101 is authored by the viewer).
    await page.getByTestId('content-feedback-menu-101').click();
    await expect(page.getByTestId('post-edit-101')).toBeVisible();
    await expect(page.getByTestId('post-delete-101')).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Report' })).toHaveCount(0);
    await page.getByTestId('content-feedback-menu-101').click();

    // Non-author (post 102): Report + feedback, never edit/delete.
    await page.getByTestId('content-feedback-menu-102').click();
    await expect(page.getByRole('menuitem', { name: 'Report' })).toBeVisible();
    await expect(page.getByTestId('post-delete-102')).toHaveCount(0);
    await expect(page.getByTestId('post-edit-102')).toHaveCount(0);
    await page.getByTestId('content-feedback-menu-102').click();

    // Moderator acting on someone else's post: pin + delete, not edit.
    await page.goto('http://127.0.0.1:3000/e2e/community-harness.html?mode=moderator');
    await expect(page.getByTestId('posts-count')).toBeVisible();
    await page.getByTestId('content-feedback-menu-102').click();
    await expect(page.getByTestId('post-pin-102')).toBeVisible();
    await expect(page.getByTestId('post-delete-102')).toBeVisible();
    await expect(page.getByTestId('post-edit-102')).toHaveCount(0);
  });

  test('reactions toggle, swap, and update counts without reload', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installApi(page);
    await openHarness(page, '?mode=member');

    const love = page.getByTestId('post-react-101-❤️');
    const thumb = page.getByTestId('post-react-101-👍');

    await expect(love).toHaveAttribute('aria-pressed', 'true');
    await expect(love).toContainText('2');
    await expect(thumb).toContainText('1');

    // Swap ❤️ → 👍: ❤️ drops to 1, 👍 rises to 2, total stays 3.
    await thumb.click();
    await expect(thumb).toHaveAttribute('aria-pressed', 'true');
    await expect(love).toHaveAttribute('aria-pressed', 'false');
    await expect(love).toContainText('1');
    await expect(thumb).toContainText('2');

    // Tapping the same emoji removes it; 👍 falls back to 1.
    await thumb.click();
    await expect(thumb).toHaveAttribute('aria-pressed', 'false');
    await expect(thumb).toContainText('1');

    // New post without reactions starts at zero and increments on tap.
    const party = page.getByTestId('post-react-102-🎉');
    await expect(party).not.toContainText(/[1-9]/);
    await party.click();
    await expect(party).toContainText('1');
    await expect(party).toHaveAttribute('aria-pressed', 'true');
  });

  test('guest reaction asks to sign in instead of sending a request', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await installApi(page);
    await openHarness(page, '?mode=guest');
    await page.getByTestId('post-react-101-👍').click();
    await expect.poll(() => page.evaluate(() => (window as any).__lastToast)).toContain('Sign in to react');
    const post = state.posts.find((row) => row.id === 101)!;
    expect(post.reaction_count).toBe(3);
  });

  test('search filters by text/@user, keeps the field visible and returns to feed', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const state = await installApi(page);
    await openHarness(page, '?mode=member');

    const search = page.getByTestId('posts-search-input');
    await search.fill('epengle');
    await expect(page.getByTestId('posts-search-status')).toBeVisible();
    await expect(page.getByTestId('posts-search-status')).toContainText('epengle');
    await expect(page.getByTestId('community-post-102')).toBeVisible();
    await expect(page.getByTestId('community-post-101')).toHaveCount(0);
    await expect(search).toBeVisible();
    expect(state.searchQueries).toContain('epengle');
    await page.screenshot({ path: shotPath('search-375.png'), fullPage: true });

    // @username search reaches the backend without the @.
    await search.fill('@marie');
    await expect.poll(() => state.searchQueries).toContain('@marie');
    await expect(page.getByTestId('community-post-103')).toBeVisible();
    await expect(page.getByTestId('community-post-101')).toHaveCount(0);

    // Back to feed restores the full list.
    await page.getByTestId('posts-search-reset').click();
    await expect(page.getByTestId('community-post-101')).toBeVisible();
    await expect(search).toHaveValue('');
    await expect(page.getByTestId('posts-search-status')).toHaveCount(0);
  });

  test('empty search shows empty state, keeps typed query and clear button works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await installApi(page);
    await openHarness(page, '?mode=member');

    const search = page.getByTestId('posts-search-input');
    await search.fill('zzzz-no-match');
    await expect(page.getByText(/No posts match "zzzz-no-match"/)).toBeVisible();
    await expect(page.getByTestId('posts-search-clear')).toBeVisible();
    await expect(search).toHaveValue('zzzz-no-match');

    await page.getByTestId('posts-search-clear').click();
    await expect(page.getByTestId('community-post-101')).toBeVisible();
    await expect(page.getByTestId('posts-search-status')).toHaveCount(0);
  });

  test('timestamp/avatar: relative recent, absolute old, avatar fallback and long username', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await installApi(page);
    await openHarness(page, '?mode=member');

    const recent = page.getByTestId('community-post-101').locator('.c-post-time');
    await expect(recent).toHaveText(/minute|minutes|ago|il y a|hace/i);
    const recentTitle = await recent.getAttribute('title');
    expect(recentTitle && recentTitle.length).toBeGreaterThan(0);

    const old = page.getByTestId('community-post-103').locator('.c-post-time');
    await expect(old).toHaveText(/2024/);
    expect(await old.getAttribute('datetime')).toBe('2024-03-05T14:30:00Z');

    // Avatar image for the other author, initial fallback for the viewer.
    const avatarImg = page.getByTestId('community-post-102').locator('.c-post-avatar img');
    await expect(avatarImg).toHaveAttribute('src', /^data:image\/svg\+xml/);
    const fallback = page.getByTestId('community-post-103').locator('.c-post-avatar');
    await expect(fallback).toHaveText('M');

    // Long username must ellipsize inside the meta column, not overflow.
    const meta = page.getByTestId('community-post-102').locator('.c-post-meta');
    const metaBox = (await meta.boundingBox())!;
    const menuBox = (await page.getByTestId('content-feedback-menu-102').boundingBox())!;
    expect(metaBox.x + metaBox.width).toBeLessThanOrEqual(menuBox.x + 1);
  });

  test('composer visibility hint follows real community visibility', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await installApi(page);
    await openHarness(page, '?mode=member&readVisibility=members&joinMode=approval');
    await expect(page.locator('#post-composer-hint')).toContainText('Only active members can read this post.');

    await page.goto('http://127.0.0.1:3000/e2e/community-harness.html?mode=member&joinMode=approval');
    await expect(page.getByTestId('posts-count')).toBeVisible();
    await expect(page.locator('#post-composer-hint')).toContainText('Joining this community requires approval.');
  });

  test('publish prepends the post and increments the count without reload', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const state = await installApi(page);
    await openHarness(page, '?mode=member');
    await expect(page.getByTestId('posts-count')).toHaveText('3 posts');

    await page.getByTestId('post-composer-input').fill('Nouvo pòs e2e pou kominote a.');
    await page.getByTestId('post-composer-submit').click();

    await expect(page.getByTestId('community-post-999')).toBeVisible();
    await expect(page.getByTestId('community-post-999')).toContainText('Nouvo pòs e2e');
    await expect(page.getByTestId('posts-count')).toHaveText('4 posts');
    await expect(page.getByTestId('post-composer-input')).toHaveValue('');
    expect(state.createdBodies).toHaveLength(1);
    expect(await page.evaluate(() => (window as any).__postCountDelta)).toBe(1);
    await page.screenshot({ path: shotPath('published-375.png'), fullPage: true });
  });

  test('delete confirms, removes the card and decrements the count', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    const state = await installApi(page);
    page.on('dialog', (dialog) => dialog.accept());
    await openHarness(page, '?mode=member');
    await expect(page.getByTestId('posts-count')).toHaveText('3 posts');

    await page.getByTestId('content-feedback-menu-101').click();
    await page.getByTestId('post-delete-101').click();

    await expect(page.getByTestId('community-post-101')).toHaveCount(0);
    await expect(page.getByTestId('posts-count')).toHaveText('2 posts');
    expect(state.deletedIds).toEqual([101]);
    expect(await page.evaluate(() => (window as any).__postCountDelta)).toBe(-1);
  });

  test('dark mode renders the feed without overflow', async ({ page }) => {
    for (const [width, height] of [
      [375, 812],
      [1440, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      await installApi(page);
      await openHarness(page, '?mode=member&theme=dark');
      await expect(page.locator('body')).toHaveClass(/dark-mode/);
      await expect(page.getByTestId('community-post-101')).toBeVisible();

      // The pasted-link card must use the dark surface, not its light fallback.
      const preview = page.getByTestId('link-preview-card').first();
      await expect(preview).toBeVisible();
      const previewBg = await preview.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(previewBg, `link preview stays light in dark mode at ${width}px`).not.toBe('rgb(255, 255, 255)');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `dark mode overflow at ${width}px`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: shotPath(`dark-${width}.png`), fullPage: true });
    }
  });
});
