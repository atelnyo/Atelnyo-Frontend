/**
 * src/components/community/CommunityDiscussions.jsx
 *
 * Community Discussions / Forums Component.
 * Allows community members to create topics, post replies, and engage
 * in threaded discussions.
 *
 * Features:
 *   - Create discussion topics
 *   - Threaded replies
 *   - Upvote/downvote system
 *   - Pin important topics
 *   - Sort by latest, popular, unanswered
 *   - Search discussions
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { DiscussionPolls, PollPreview } from './DiscussionPoll';

// ─── Helpers ───────────────────────────────────────────────────────

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function formatCount(n) {
  if (n == null) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// ─── Discussion Card ───────────────────────────────────────────────

function DiscussionCard({ discussion, onClick, lang }) {
  const isPinned = discussion.is_pinned;
  const isResolved = discussion.is_resolved;
  const hasPoll = discussion.polls && discussion.polls.length > 0;

  return (
    <div
      className={`disc-card ${isPinned ? 'disc-pinned' : ''} ${isResolved ? 'disc-resolved' : ''}`}
      onClick={() => onClick?.(discussion)}
    >
      <div className="disc-card-main">
        <div className="disc-card-header">
          {isPinned && (
            <span className="disc-badge disc-badge-pin">
              <i className="fas fa-thumbtack" /> Pinned
            </span>
          )}
          {isResolved && (
            <span className="disc-badge disc-badge-resolved">
              <i className="fas fa-check-circle" /> Resolved
            </span>
          )}
        </div>

        <h4 className="disc-card-title">{discussion.title}</h4>

        <p className="disc-card-preview">
          {discussion.content?.substring(0, 150)}
          {discussion.content?.length > 150 ? '...' : ''}
        </p>

        <div className="disc-card-meta">
          <span className="disc-author">
            <i className="fas fa-user" />
            {discussion.author_name || 'Anonymous'}
          </span>
          <span className="disc-time">
            <i className="fas fa-clock" />
            {formatTimeAgo(discussion.created_at)}
          </span>
          <span className="disc-replies">
            <i className="fas fa-comment" />
            {formatCount(discussion.reply_count || 0)} {lang === 'ht' ? 'repons' : 'replies'}
          </span>
          <span className="disc-votes">
            <i className="fas fa-arrow-up" />
            {formatCount(discussion.upvotes || 0)}
          </span>
        </div>

        {hasPoll && (
          <div className="disc-card-poll">
            <i className="fas fa-chart-bar" />
            <span>{discussion.polls.length} {lang === 'ht' ? 'sondaj' : 'polls'}</span>
            {discussion.polls[0] && <PollPreview poll={discussion.polls[0]} lang={lang} />}
          </div>
        )}

        {discussion.tags && discussion.tags.length > 0 && (
          <div className="disc-card-tags">
            {discussion.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="disc-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reply Card ────────────────────────────────────────────────────

function ReplyCard({ reply, onVote, lang }) {
  return (
    <div className="disc-reply">
      <div className="disc-reply-vote">
        <button
          className={`disc-vote-btn ${reply.user_vote === 1 ? 'disc-voted' : ''}`}
          onClick={(e) => { e.stopPropagation(); onVote?.(reply.id, 1); }}
        >
          <i className="fas fa-arrow-up" />
        </button>
        <span className="disc-vote-count">{reply.upvotes || 0}</span>
        <button
          className={`disc-vote-btn ${reply.user_vote === -1 ? 'disc-voted-down' : ''}`}
          onClick={(e) => { e.stopPropagation(); onVote?.(reply.id, -1); }}
        >
          <i className="fas fa-arrow-down" />
        </button>
      </div>

      <div className="disc-reply-content">
        <div className="disc-reply-header">
          <span className="disc-reply-author">{reply.author_name || 'Anonymous'}</span>
          <span className="disc-reply-time">{formatTimeAgo(reply.created_at)}</span>
        </div>
        <div className="disc-reply-body">{reply.content}</div>
        {reply.is_solution && (
          <div className="disc-solution-badge">
            <i className="fas fa-check-circle" /> {lang === 'ht' ? 'Solisyon' : 'Solution'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Discussion Form ────────────────────────────────────────

function CreateDiscussionForm({ onSubmit, onCancel, lang }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    onSubmit({
      title: title.trim(),
      content: content.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    });
    setTitle('');
    setContent('');
    setTags('');
  };

  return (
    <form className="disc-form" onSubmit={handleSubmit}>
      <h3>
        <i className="fas fa-plus-circle" />
        {lang === 'ht' ? 'Kreye yon diskisyon' : 'Start a Discussion'}
      </h3>

      <div className="disc-form-group">
        <label>{lang === 'ht' ? 'Tit' : 'Title'} *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={lang === 'ht' ? 'Kisa ou vle diskite?' : 'What do you want to discuss?'}
          required
          maxLength={200}
        />
      </div>

      <div className="disc-form-group">
        <label>{lang === 'ht' ? 'Kontni' : 'Content'} *</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={lang === 'ht' ? 'Ekri detay diskisyon ou an...' : 'Write the details of your discussion...'}
          rows={6}
          required
        />
      </div>

      <div className="disc-form-group">
        <label>{lang === 'ht' ? 'Tay' : 'Tags'} (optional)</label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={lang === 'ht' ? 'separe ak virgül: kreyòl, edikasyon' : 'comma-separated: kreyol, education'}
        />
      </div>

      <div className="disc-form-actions">
        <button type="button" className="disc-btn disc-btn-secondary" onClick={onCancel}>
          {lang === 'ht' ? 'Anile' : 'Cancel'}
        </button>
        <button type="submit" className="disc-btn disc-btn-primary">
          <i className="fas fa-paper-plane" /> {lang === 'ht' ? 'Pibliye' : 'Post'}
        </button>
      </div>
    </form>
  );
}

// ─── Discussion Detail ─────────────────────────────────────────────

function DiscussionDetail({ discussion, onBack, onReply, onVote, lang }) {
  const [replyContent, setReplyContent] = useState('');
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReplies();
  }, [discussion?.id]);

  const fetchReplies = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/communities/discussions/${discussion.id}/replies/`);
      setReplies(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error('Failed to fetch replies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;

    try {
      await api.post(`/communities/discussions/${discussion.id}/replies/`, {
        content: replyContent.trim(),
      });
      setReplyContent('');
      fetchReplies();
    } catch (err) {
      console.error('Failed to post reply:', err);
    }
  };

  return (
    <div className="disc-detail">
      <button className="disc-back-btn" onClick={onBack}>
        <i className="fas fa-arrow-left" /> {lang === 'ht' ? 'Retounen' : 'Back'}
      </button>

      <div className="disc-detail-header">
        <h2>{discussion.title}</h2>
        <div className="disc-detail-meta">
          <span>{discussion.author_name}</span>
          <span>{formatTimeAgo(discussion.created_at)}</span>
        </div>
      </div>

      <div className="disc-detail-content">
        {discussion.content}
      </div>

      {discussion.tags && discussion.tags.length > 0 && (
        <div className="disc-detail-tags">
          {discussion.tags.map((tag, idx) => (
            <span key={idx} className="disc-tag">{tag}</span>
          ))}
        </div>
      )}

      {/* Polls Section */}
      <DiscussionPolls
        polls={discussion.polls || []}
        community={discussion.community}
        discussionId={discussion.id}
        onPollCreated={(poll) => {
          // Update the discussion's polls list
          discussion.polls = [...(discussion.polls || []), poll];
        }}
        onPollDeleted={(pollId) => {
          discussion.polls = (discussion.polls || []).filter(p => p.id !== pollId);
        }}
        currentUserId={discussion.author_id}
        lang={lang}
      />

      <div className="disc-replies-section">
        <h3>
          {replies.length} {lang === 'ht' ? 'repons' : 'replies'}
        </h3>

        {loading ? (
          <div className="disc-loading">
            <i className="fas fa-spinner fa-spin" /> Loading replies...
          </div>
        ) : (
          <div className="disc-replies-list">
            {replies.map((reply) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                onVote={onVote}
                lang={lang}
              />
            ))}
          </div>
        )}

        <form className="disc-reply-form" onSubmit={handleSubmitReply}>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={lang === 'ht' ? 'Ekri repons ou an...' : 'Write your reply...'}
            rows={3}
            required
          />
          <button type="submit" className="disc-btn disc-btn-primary">
            <i className="fas fa-reply" /> {lang === 'ht' ? 'Reponn' : 'Reply'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export default function CommunityDiscussions({ community, lang = 'ht', showToast }) {
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedDiscussion, setSelectedDiscussion] = useState(null);
  const [sortBy, setSortBy] = useState('latest');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDiscussions();
  }, [community?.id, sortBy]);

  const fetchDiscussions = async () => {
    try {
      setLoading(true);
      const res = await api.get('/communities/discussions/', {
        params: {
          community: community?.id,
          sort: sortBy,
          search: searchQuery || undefined,
        },
      });
      setDiscussions(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error('Failed to fetch discussions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDiscussion = async (data) => {
    try {
      await api.post('/communities/discussions/', {
        ...data,
        community: community?.id,
      });
      setShowForm(false);
      fetchDiscussions();
      showToast?.(lang === 'ht' ? 'Diskisyon kreye!' : 'Discussion created!', 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè nan kreyasyon' : 'Error creating discussion', 'error');
    }
  };

  const handleVote = async (discussionId, vote) => {
    try {
      await api.post(`/communities/discussions/${discussionId}/vote/`, { vote });
      fetchDiscussions();
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDiscussions();
  };

  if (selectedDiscussion) {
    return (
      <DiscussionDetail
        discussion={selectedDiscussion}
        onBack={() => setSelectedDiscussion(null)}
        onVote={handleVote}
        lang={lang}
      />
    );
  }

  return (
    <div className="disc-container">
      <div className="disc-header">
        <h2>
          <i className="fas fa-comments" />
          {lang === 'ht' ? 'Diskisyon' : 'Discussions'}
        </h2>
        <button className="disc-btn disc-btn-primary" onClick={() => setShowForm(!showForm)}>
          <i className="fas fa-plus" /> {lang === 'ht' ? 'Nouvo Diskisyon' : 'New Discussion'}
        </button>
      </div>

      {showForm && (
        <CreateDiscussionForm
          onSubmit={handleCreateDiscussion}
          onCancel={() => setShowForm(false)}
          lang={lang}
        />
      )}

      <div className="disc-controls">
        <form className="disc-search" onSubmit={handleSearch}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'ht' ? 'Chèche diskisyon...' : 'Search discussions...'}
          />
          <button type="submit">
            <i className="fas fa-search" />
          </button>
        </form>

        <div className="disc-sort">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="latest">{lang === 'ht' ? 'Dènye' : 'Latest'}</option>
            <option value="popular">{lang === 'ht' ? 'Popilè' : 'Popular'}</option>
            <option value="unanswered">{lang === 'ht' ? 'San repons' : 'Unanswered'}</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="disc-loading">
          <i className="fas fa-spinner fa-spin" />
          <span>{lang === 'ht' ? 'Ap chaje...' : 'Loading...'}</span>
        </div>
      ) : discussions.length === 0 ? (
        <div className="disc-empty">
          <i className="fas fa-comments" />
          <p>{lang === 'ht' ? 'Pa gen diskisyon ankò' : 'No discussions yet'}</p>
          <button className="disc-btn disc-btn-primary" onClick={() => setShowForm(true)}>
            {lang === 'ht' ? 'Kreye premye diskisyon an' : 'Start the first discussion'}
          </button>
        </div>
      ) : (
        <div className="disc-list">
          {discussions.map((discussion) => (
            <DiscussionCard
              key={discussion.id}
              discussion={discussion}
              onClick={setSelectedDiscussion}
              lang={lang}
            />
          ))}
        </div>
      )}
    </div>
  );
}
