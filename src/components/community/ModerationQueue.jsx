/**
 * src/components/community/ModerationQueue.jsx
 *
 * Advanced Moderation Queue for Community Managers.
 *
 * Features:
 *   - AI-powered content analysis (toxicity, spam detection)
 *   - Priority-based queue (critical > high > medium > low)
 *   - Bulk actions (approve/reject/flag multiple items)
 *   - Content preview with context
 *   - Quick filters and search
 *   - Keyboard shortcuts for power users
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../../services/api';

// ─── Constants ────────────────────────────────────────────────────

const PRIORITY_LEVELS = {
  critical: { label: 'Critical', color: '#dc2626', icon: 'fa-exclamation-circle', weight: 4 },
  high: { label: 'High', color: '#ea580c', icon: 'fa-arrow-up', weight: 3 },
  medium: { label: 'Medium', color: '#d97706', icon: 'fa-minus', weight: 2 },
  low: { label: 'Low', color: '#65a30d', icon: 'fa-arrow-down', weight: 1 },
};

const TOXICITY_LABELS = {
  toxic: { label: 'Toxic', color: '#dc2626', threshold: 0.7 },
  severe_toxic: { label: 'Severe Toxic', color: '#991b1b', threshold: 0.8 },
  obscene: { label: 'Obscene', color: '#ea580c', threshold: 0.6 },
  threat: { label: 'Threat', color: '#dc2626', threshold: 0.5 },
  insult: { label: 'Insult', color: '#d97706', threshold: 0.6 },
  identity_hate: { label: 'Identity Hate', color: '#9333ea', threshold: 0.5 },
};

// ─── Helpers ──────────────────────────────────────────────────────

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
}

function getPriorityFromSignals(signals) {
  if (!signals) return 'medium';
  const { toxicity_score, report_count, is_repeat_offender, content_type } = signals;
  if (toxicity_score > 0.9 || is_repeat_offender) return 'critical';
  if (toxicity_score > 0.7 || report_count > 5) return 'high';
  if (toxicity_score > 0.4 || report_count > 2) return 'medium';
  return 'low';
}

// ─── Toxicity Badge ───────────────────────────────────────────────

function ToxicityBadge({ scores }) {
  if (!scores) return null;
  const flags = Object.entries(scores)
    .filter(([key, val]) => TOXICITY_LABELS[key] && val >= TOXICITY_LABELS[key].threshold)
    .map(([key]) => TOXICITY_LABELS[key]);

  if (flags.length === 0) return <span className="mq-toxicity-clean">Clean</span>;

  return (
    <div className="mq-toxicity-badges">
      {flags.map((flag) => (
        <span key={flag.label} className="mq-toxicity-flag" style={{ background: flag.color + '18', color: flag.color }}>
          <i className="fas fa-exclamation-triangle" /> {flag.label}
        </span>
      ))}
    </div>
  );
}

// ─── Content Preview ──────────────────────────────────────────────

function ContentPreview({ item, expanded, onToggle }) {
  const contentTypes = {
    post: { icon: 'fa-comment', label: 'Post' },
    discussion: { icon: 'fa-comments', label: 'Discussion' },
    message: { icon: 'fa-envelope', label: 'Message' },
    image: { icon: 'fa-image', label: 'Image' },
    profile: { icon: 'fa-user', label: 'Profile' },
    comment: { icon: 'fa-reply', label: 'Comment' },
  };
  const ct = contentTypes[item.content_type] || contentTypes.post;

  return (
    <div className={`mq-preview ${expanded ? 'mq-preview-expanded' : ''}`}>
      <div className="mq-preview-header" onClick={onToggle}>
        <div className="mq-preview-type">
          <i className={`fas ${ct.icon}`} />
          <span>{ct.label}</span>
        </div>
        <div className="mq-preview-meta">
          <span className="mq-preview-author">
            <i className="fas fa-user-circle" /> {item.author_name || 'Unknown'}
          </span>
          <span className="mq-preview-time">
            <i className="fas fa-clock" /> {formatTimeAgo(item.created_at)}
          </span>
        </div>
        <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} mq-preview-toggle`} />
      </div>

      {expanded && (
        <div className="mq-preview-body">
          <div className="mq-preview-content">
            {item.content?.substring(0, 500)}
            {item.content?.length > 500 && '...'}
          </div>
          {item.media_url && (
            <div className="mq-preview-media">
              <img src={item.media_url} alt="Content" />
            </div>
          )}
          {item.context && (
            <div className="mq-preview-context">
              <strong>Context:</strong> {item.context}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Queue Item ───────────────────────────────────────────────────

function QueueItem({ item, selected, onSelect, onAction, lang }) {
  const [expanded, setExpanded] = useState(false);
  const priority = PRIORITY_LEVELS[item.priority || 'medium'];

  return (
    <div className={`mq-item ${selected ? 'mq-item-selected' : ''} mq-priority-${item.priority || 'medium'}`}>
      <div className="mq-item-main">
        <div className="mq-item-select">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect?.(item.id)}
          />
        </div>

        <div className="mq-item-priority" style={{ color: priority.color }}>
          <i className={`fas ${priority.icon}`} title={priority.label} />
        </div>

        <div className="mq-item-body">
          <ContentPreview item={item} expanded={expanded} onToggle={() => setExpanded(!expanded)} />

          <div className="mq-item-signals">
            <ToxicityBadge scores={item.toxicity_scores} />
            {item.report_count > 0 && (
              <span className="mq-signal-badge mq-signal-reports">
                <i className="fas fa-flag" /> {item.report_count} reports
              </span>
            )}
            {item.is_repeat_offender && (
              <span className="mq-signal-badge mq-signal-repeat">
                <i className="fas fa-redo" /> Repeat
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mq-item-actions">
        <button className="mq-btn mq-btn-approve" onClick={() => onAction?.('approve', item)} title="Approve">
          <i className="fas fa-check" />
        </button>
        <button className="mq-btn mq-btn-reject" onClick={() => onAction?.('reject', item)} title="Reject">
          <i className="fas fa-times" />
        </button>
        <button className="mq-btn mq-btn-flag" onClick={() => onAction?.('escalate', item)} title="Escalate">
          <i className="fas fa-exclamation" />
        </button>
        <button className="mq-btn mq-btn-more" onClick={() => setExpanded(!expanded)} title="More info">
          <i className="fas fa-ellipsis-h" />
        </button>
      </div>
    </div>
  );
}

// ─── Bulk Actions Bar ─────────────────────────────────────────────

function BulkActionsBar({ selectedCount, onBulkAction, onClearSelection, lang }) {
  if (selectedCount === 0) return null;

  return (
    <div className="mq-bulk-bar">
      <div className="mq-bulk-info">
        <span className="mq-bulk-count">{selectedCount}</span>
        {lang === 'ht' ? ' seleksyone' : ' selected'}
      </div>
      <div className="mq-bulk-actions">
        <button className="mq-btn mq-btn-approve" onClick={() => onBulkAction('approve')}>
          <i className="fas fa-check" /> {lang === 'ht' ? 'Apwouve Tout' : 'Approve All'}
        </button>
        <button className="mq-btn mq-btn-reject" onClick={() => onBulkAction('reject')}>
          <i className="fas fa-times" /> {lang === 'ht' ? 'Rejte Tout' : 'Reject All'}
        </button>
        <button className="mq-btn mq-btn-flag" onClick={() => onBulkAction('escalate')}>
          <i className="fas fa-arrow-up" /> {lang === 'ht' ? 'Eskale Tout' : 'Escalate All'}
        </button>
        <button className="mq-btn mq-btn-clear" onClick={onClearSelection}>
          <i className="fas fa-times" /> {lang === 'ht' ? 'Anile' : 'Clear'}
        </button>
      </div>
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────

function FilterBar({ filters, onFilterChange, stats, lang }) {
  return (
    <div className="mq-filters">
      <div className="mq-filter-group">
        <label>{lang === 'ht' ? 'Priyorite' : 'Priority'}</label>
        <select
          value={filters.priority || ''}
          onChange={(e) => onFilterChange('priority', e.target.value)}
        >
          <option value="">{lang === 'ht' ? 'Tout' : 'All'}</option>
          <option value="critical">🔴 Critical</option>
          <option value="high">🟠 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
      </div>

      <div className="mq-filter-group">
        <label>{lang === 'ht' ? 'Kalite' : 'Type'}</label>
        <select
          value={filters.content_type || ''}
          onChange={(e) => onFilterChange('content_type', e.target.value)}
        >
          <option value="">{lang === 'ht' ? 'Tout' : 'All'}</option>
          <option value="post">Post</option>
          <option value="discussion">Discussion</option>
          <option value="message">Message</option>
          <option value="image">Image</option>
          <option value="profile">Profile</option>
        </select>
      </div>

      <div className="mq-filter-group">
        <label>{lang === 'ht' ? 'Rezon' : 'Reason'}</label>
        <select
          value={filters.reason || ''}
          onChange={(e) => onFilterChange('reason', e.target.value)}
        >
          <option value="">{lang === 'ht' ? 'Tout' : 'All'}</option>
          <option value="spam">Spam</option>
          <option value="harassment">Harassment</option>
          <option value="violence">Violence</option>
          <option value="fake_profile">Fake Profile</option>
          <option value="scam">Scam</option>
          <option value="illegal">Illegal</option>
        </select>
      </div>

      <div className="mq-filter-group mq-filter-search">
        <i className="fas fa-search" />
        <input
          type="text"
          placeholder={lang === 'ht' ? 'Chèche...' : 'Search...'}
          value={filters.search || ''}
          onChange={(e) => onFilterChange('search', e.target.value)}
        />
      </div>

      {stats && (
        <div className="mq-filter-stats">
          <span>{stats.total || 0} items</span>
          {stats.critical > 0 && <span className="mq-stat-critical">{stats.critical} critical</span>}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function ModerationQueue({ community, lang = 'ht', showToast }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState({});
  const [sortBy, setSortBy] = useState('priority'); // priority | time | reports
  const observerRef = useRef(null);
  const lastItemRef = useRef(null);

  // Fetch queue items
  const fetchItems = useCallback(async (pageNum = 1, reset = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: pageNum, sort: sortBy, limit: 20 });
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });

      const res = await api.get(`/communities/${community?.id}/moderation/queue/?${params}`);
      const newItems = Array.isArray(res.data?.results) ? res.data.results : (Array.isArray(res.data) ? res.data : []);

      if (reset) {
        setItems(newItems);
      } else {
        setItems(prev => [...prev, ...newItems]);
      }
      setHasMore(newItems.length === 20);
      setPage(pageNum);

      // Fetch stats
      const statsRes = await api.get(`/communities/${community?.id}/moderation/stats/`);
      setStats(statsRes.data || {});
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    } finally {
      setLoading(false);
    }
  }, [community?.id, filters, sortBy]);

  useEffect(() => {
    fetchItems(1, true);
  }, [fetchItems]);

  // Infinite scroll
  useEffect(() => {
    if (loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          fetchItems(page + 1);
        }
      },
      { threshold: 0.1 }
    );
    observerRef.current = observer;
    if (lastItemRef.current) observer.observe(lastItemRef.current);
    return () => observer.disconnect();
  }, [loading, hasMore, page, fetchItems]);

  // Selection
  const handleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(i => i.id)));
    }
  }, [items, selectedIds.size]);

  // Actions
  const handleAction = useCallback(async (action, item) => {
    try {
      await api.post(`/communities/${community?.id}/moderation/${action}/`, {
        ids: [item.id],
        reason: item.reason,
      });
      setItems(prev => prev.filter(i => i.id !== item.id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      showToast?.(
        lang === 'ht' ? 'Aksyon reyisi!' : 'Action completed!',
        'success'
      );
    } catch (err) {
      showToast?.(
        lang === 'ht' ? 'Erè' : 'Error',
        'error'
      );
    }
  }, [community?.id, lang, showToast]);

  const handleBulkAction = useCallback(async (action) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      await api.post(`/communities/${community?.id}/moderation/${action}/`, { ids });
      setItems(prev => prev.filter(i => !selectedIds.has(i.id)));
      setSelectedIds(new Set());
      showToast?.(
        lang === 'ht' ? `${ids.length} aksyon reyisi!` : `${ids.length} items processed!`,
        'success'
      );
    } catch (err) {
      showToast?.(
        lang === 'ht' ? 'Erè' : 'Error',
        'error'
      );
    }
  }, [community?.id, selectedIds, lang, showToast]);

  // Sort items by priority
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortBy === 'priority') {
        return (PRIORITY_LEVELS[b.priority]?.weight || 0) - (PRIORITY_LEVELS[a.priority]?.weight || 0);
      }
      if (sortBy === 'reports') {
        return (b.report_count || 0) - (a.report_count || 0);
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [items, sortBy]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSelectAll();
      }
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectAll]);

  return (
    <div className="mq-container">
      <div className="mq-header">
        <h3>
          <i className="fas fa-list-check" />
          {lang === 'ht' ? 'Ke Moderasyon' : 'Moderation Queue'}
        </h3>
        <div className="mq-header-actions">
          <button className="mq-btn mq-btn-sort" onClick={() => setSortBy(s => s === 'priority' ? 'time' : s === 'time' ? 'reports' : 'priority')}>
            <i className="fas fa-sort" /> {sortBy === 'priority' ? 'Priority' : sortBy === 'time' ? 'Newest' : 'Most Reports'}
          </button>
          <button className="mq-btn mq-btn-select-all" onClick={handleSelectAll}>
            <i className="fas fa-check-double" /> {lang === 'ht' ? 'Tout' : 'Select All'}
          </button>
        </div>
      </div>

      <FilterBar filters={filters} onFilterChange={(k, v) => setFilters(f => ({ ...f, [k]: v }))} stats={stats} lang={lang} />

      <BulkActionsBar
        selectedCount={selectedIds.size}
        onBulkAction={handleBulkAction}
        onClearSelection={() => setSelectedIds(new Set())}
        lang={lang}
      />

      <div className="mq-list">
        {sortedItems.length === 0 && !loading ? (
          <div className="mq-empty">
            <i className="fas fa-check-circle" />
            <p>{lang === 'ht' ? 'Pa gen kontni nan ke a' : 'Queue is clear!'}</p>
          </div>
        ) : (
          sortedItems.map((item, idx) => (
            <div
              key={item.id}
              ref={idx === sortedItems.length - 1 ? lastItemRef : null}
            >
              <QueueItem
                item={item}
                selected={selectedIds.has(item.id)}
                onSelect={handleSelect}
                onAction={handleAction}
                lang={lang}
              />
            </div>
          ))
        )}

        {loading && (
          <div className="mq-loading">
            <i className="fas fa-spinner fa-spin" />
            <span>{lang === 'ht' ? 'Ap chaje...' : 'Loading...'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
