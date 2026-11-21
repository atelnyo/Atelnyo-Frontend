/**
 * e2e/community-harness.jsx
 *
 * Dev-only harness that mounts the REAL CommunityPosts feed inside a
 * MemoryRouter. The outlet context (community, viewer, lang) is driven
 * by query params so a Playwright spec can exercise the member,
 * non-member, moderator and guest surfaces without a backend.
 *
 * API calls are stubbed by the spec's page.route(); this file never
 * talks to Daphne or the database.
 *
 * Served by Vite at /e2e/community-harness.html?mode=member&theme=dark
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import CommunityPosts from '../src/components/community/CommunityPosts.jsx';
import '../src/styles/index.css';

const params = new URLSearchParams(window.location.search);
const mode = params.get('mode') || 'member';
const lang = params.get('lang') || 'en';

if (params.get('theme') === 'dark') {
  document.body.classList.add('dark-mode');
}
// CommunityDetail adds this on mount; the CSS uses it to keep the global
// assistant clear of the last card's actions and the bottom nav.
document.body.classList.add('community-detail-page');

const VIEWERS = {
  member: { id: 7, username: 'jhon' },
  nonmember: { id: 7, username: 'jhon' },
  moderator: { id: 7, username: 'jhon' },
  owner: { id: 7, username: 'jhon' },
  guest: null,
};
const ROLES = {
  member: 'member',
  nonmember: null,
  moderator: 'moderator',
  owner: 'owner',
  guest: null,
};
const MEMBERS = ['member', 'moderator', 'owner'];

const community = {
  id: 1,
  slug: 'demo',
  name: 'Demo Community',
  is_member: MEMBERS.includes(mode),
  current_user_role: ROLES[mode] ?? null,
  join_mode: params.get('joinMode') || (mode === 'nonmember' ? 'approval' : 'open'),
  read_visibility: params.get('readVisibility') || 'public',
};

function Layout() {
  return (
    <div className="community-detail" style={{ maxWidth: 760, margin: '0 auto', padding: '16px 12px 96px' }} data-testid="community-detail-sheet">
      <Outlet
        context={{
          community,
          lang,
          user: VIEWERS[mode] ?? null,
          showToast: (message) => { window.__lastToast = message; },
          onPostCountChange: (delta) => {
            window.__postCountDelta = (window.__postCountDelta || 0) + delta;
          },
        }}
      />
      <button type="button" className="chat-btn" data-testid="fake-fab" aria-label="Assistant">
        AI
      </button>
    </div>
  );
}

const q = params.get('q');
const entry = `/community/demo/posts${q ? `?q=${encodeURIComponent(q)}` : ''}`;

createRoot(document.getElementById('root')).render(
  <HelmetProvider>
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/community/:slug/posts" element={<Layout />}>
          <Route index element={<CommunityPosts />} />
        </Route>
      </Routes>
    </MemoryRouter>
  </HelmetProvider>,
);
