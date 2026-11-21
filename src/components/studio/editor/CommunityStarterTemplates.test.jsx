/**
 * src/components/studio/editor/CommunityStarterTemplates.test.jsx
 *
 * Covers the two new pre-publish surfaces of the community editor:
 * the starter templates (data + apply callback) and the live preview
 * (visitor CTA, member view after joining).
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommunityStarterTemplates from './CommunityStarterTemplates';
import CommunityPreviewCard from './CommunityPreviewCard';
import { COMMUNITY_TEMPLATES, buildTemplateDraft } from './communityTemplates';

describe('community templates', () => {
  it('builds a localized draft that owns content fields but never the name', () => {
    const learning = COMMUNITY_TEMPLATES.find((tpl) => tpl.id === 'learning');
    const draft = buildTemplateDraft(learning, 'ht');

    expect(draft.category).toBe('education');
    expect(draft.join_mode).toBe('approval');
    expect(draft.hashtags).toContain('#aprann');
    expect(draft.rules).toHaveLength(3);
    expect(draft.rules[0].title).toBe('Ede lòt moun aprann');
    expect(draft).not.toHaveProperty('name');
  });

  it('falls back to English copy for an unsupported language', () => {
    const discussion = COMMUNITY_TEMPLATES.find((tpl) => tpl.id === 'discussion');
    const draft = buildTemplateDraft(discussion, 'fr');

    expect(draft.rules[0].title).toBe('Be respectful');
    expect(draft.description).toMatch(/friendly place/);
  });

  it('renders every template and hands the chosen one to onApply', () => {
    const onApply = vi.fn();
    render(<CommunityStarterTemplates lang="ht" onApply={onApply} />);

    expect(screen.getByText('Kòmanse ak yon modèl')).toBeInTheDocument();
    expect(screen.getByText('Kowòt aprantisaj')).toBeInTheDocument();
    expect(screen.getByText('Fan club kreyatè')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button', { name: /sèvi ak modèl sa a/i });
    expect(buttons).toHaveLength(COMMUNITY_TEMPLATES.length);

    fireEvent.click(buttons[1]);
    expect(onApply).toHaveBeenCalledWith(COMMUNITY_TEMPLATES[1]);
  });

  it('marks the applied template without hiding the others', () => {
    render(
      <CommunityStarterTemplates
        lang="en"
        appliedId="project"
        onApply={vi.fn()}
      />,
    );

    expect(screen.getByText('Template applied')).toBeInTheDocument();
    const applied = screen.getAllByRole('button', { name: /applied/i });
    expect(applied).toHaveLength(1);
    expect(applied[0]).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('CommunityPreviewCard', () => {
  const value = {
    name: 'Dev Ayiti',
    description: 'Nou aprann ansanm.',
    join_mode: 'approval',
    avatar_url: '',
    banner_url: '',
  };

  it('shows the visitor CTA that matches the join mode', () => {
    render(
      <CommunityPreviewCard
        lang="en"
        value={value}
        rules={[{ title: 'Be kind', description: 'No attacks.' }]}
        memberCount={12}
      />,
    );

    expect(screen.getByText('Dev Ayiti')).toBeInTheDocument();
    expect(screen.getByText('12 members · Approval')).toBeInTheDocument();
    expect(screen.getByText('Request to join')).toBeInTheDocument();
    expect(screen.getByText('Be kind')).toBeInTheDocument();
    expect(screen.queryByText('Write a post')).not.toBeInTheDocument();
  });

  it('switches to the member view with composer and first steps', () => {
    render(
      <CommunityPreviewCard
        lang="ht"
        value={value}
        rules={[{ title: 'Respekte tout moun', description: '' }]}
        memberCount={3}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /manm/i }));

    expect(screen.getByText('Kreye yon pòs')).toBeInTheDocument();
    expect(screen.getByText('Pataje yon bagay ak kominote a…')).toBeInTheDocument();
    expect(screen.getByText('Apre yon moun antre')).toBeInTheDocument();
    expect(screen.getByText('Li règleman kominote a')).toBeInTheDocument();
    expect(screen.queryByText('Mande pou antre')).not.toBeInTheDocument();
  });

  it('falls back to placeholders while the form is still empty', () => {
    render(<CommunityPreviewCard lang="en" value={{ join_mode: 'public' }} />);

    expect(screen.getByText('Your community name')).toBeInTheDocument();
    expect(screen.getByText('0 members · Public')).toBeInTheDocument();
    expect(screen.getByText('Join')).toBeInTheDocument();
  });
});
