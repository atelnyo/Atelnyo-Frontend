import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CommunityJoinExplainer from './CommunityJoinExplainer';
import {
  joinPlan,
  communityUnlocks,
  nextEvent,
  welcomeSteps,
  buildIntroDraft,
  normalizeJoinMode,
} from './communityOnboarding';

const COMM = {
  name: 'Atelye Kreyòl',
  join_mode: 'approval',
  member_count: 42,
  rules: [
    { title: 'Respekte tout moun' },
    { title: 'Pa gen spam' },
  ],
};

describe('communityOnboarding', () => {
  it('describes a public community as an open door', () => {
    const plan = joinPlan('public', 'ht');
    expect(plan.mode).toBe('public');
    expect(plan.title).toBe('Pòt ouvè');
    expect(plan.cta).toBe('Antre kounye a');
    expect(plan.bullets).toHaveLength(3);
  });

  it('switches the approval copy once the request is pending', () => {
    const before = joinPlan('approval', 'en');
    const after = joinPlan('approval', 'en', { pending: true });
    expect(before.cta).toBe('Request to join');
    expect(after.cta).toBe('Request sent');
    expect(after.title).toBe('Your request is with the founder');
    expect(after.bullets.map((b) => b.text).join(' ')).toContain('approved');
  });

  it('explains invite-only communities without promising a self-serve join', () => {
    const plan = joinPlan('invite', 'fr');
    expect(plan.mode).toBe('invite');
    expect(plan.title).toBe('Sur invitation');
    expect(plan.cta).toBe('Sur invitation');
    expect(plan.bullets).toHaveLength(3);
  });

  it('treats unknown join modes as public', () => {
    expect(normalizeJoinMode('whatever')).toBe('public');
    expect(normalizeJoinMode(undefined)).toBe('public');
    expect(joinPlan('whatever', 'en').mode).toBe('public');
  });

  it('lists what membership unlocks', () => {
    const keys = communityUnlocks('ht').map((u) => u.key);
    expect(keys).toEqual(['posts', 'events', 'library', 'announcements']);
    expect(communityUnlocks('ht')[0].label).toBe('Pòs ak diskisyon');
  });

  it('finds the soonest upcoming event and ignores past or malformed ones', () => {
    const now = new Date('2026-11-20T12:00:00Z');
    const events = [
      { id: 1, title: 'Past', start_time: '2026-11-01T10:00:00Z' },
      { id: 2, title: 'Later', start_time: '2026-12-05T10:00:00Z' },
      { id: 3, title: 'Sooner', start_time: '2026-11-25T10:00:00Z' },
      { id: 4, title: 'No date' },
      { id: 5, title: 'Broken', start_time: 'not-a-date' },
    ];
    expect(nextEvent(events, now)?.id).toBe(3);
    expect(nextEvent([], now)).toBeNull();
    expect(nextEvent(null, now)).toBeNull();
  });

  it('builds welcome steps around this community (rules only when they exist)', () => {
    const withRules = welcomeSteps(COMM, 'ht');
    expect(withRules.map((s) => s.key)).toEqual(['intro', 'rules', 'events', 'invite']);
    expect(withRules[1].hint).toContain('2');

    const withoutRules = welcomeSteps({ ...COMM, rules: [] }, 'ht');
    expect(withoutRules.map((s) => s.key)).toEqual(['intro', 'events', 'invite']);
  });

  it('shows the next event date in the events step when one is scheduled', () => {
    const steps = welcomeSteps(COMM, 'en', { title: 'Live session', start_time: '2026-11-25T18:00:00Z' });
    const eventsStep = steps.find((s) => s.key === 'events');
    expect(eventsStep.hint).toContain('Live session');
    expect(eventsStep.hint).toContain('Nov');
  });

  it('drafts an editable introduction using the community and the member name', () => {
    const draft = buildIntroDraft(COMM, { username: 'jhon', first_name: 'Jhon' }, 'ht');
    expect(draft).toContain('Jhon');
    expect(draft).toContain('Atelye Kreyòl');
    expect(draft).toContain('• Sa m fè:');
    expect(draft).toContain('(@jhon)');

    const usernameOnly = buildIntroDraft(COMM, { username: 'jhon' }, 'ht');
    expect(usernameOnly).toContain('Mwen se jhon e');
    expect(usernameOnly).not.toContain('@jhon');
  });
});

describe('CommunityJoinExplainer', () => {
  it('renders the plan, the unlocks, and a working join button', () => {
    const onJoin = vi.fn();
    render(<CommunityJoinExplainer community={COMM} lang="ht" onJoin={onJoin} />);

    expect(screen.getByText('Antre sou apwobasyon')).toBeTruthy();
    expect(screen.getByText('Pòs ak diskisyon')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    fireEvent.click(screen.getByTestId('community-join-explainer-cta'));
    expect(onJoin).toHaveBeenCalledOnce();
  });

  it('turns into a status card while the founder reviews the request', () => {
    render(<CommunityJoinExplainer community={COMM} lang="ht" pending onJoin={vi.fn()} />);
    expect(screen.getByTestId('community-join-explainer-status')).toHaveTextContent('Demann voye');
    expect(screen.queryByTestId('community-join-explainer-cta')).toBeNull();
  });

  it('locks the CTA for invite-only communities without a token', () => {
    render(
      <CommunityJoinExplainer
        community={{ ...COMM, join_mode: 'invite' }}
        lang="en"
        canJoin={false}
        onJoin={vi.fn()}
      />,
    );
    expect(screen.getByTestId('community-join-explainer-cta')).toBeDisabled();
  });
});
