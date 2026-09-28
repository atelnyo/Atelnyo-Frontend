/**
 * MediaHub — Sant jesyon medya nan Creator Studio.
 *
 * Montre:
 *   - Quick Upload Guide
 *   - Connected Media (stats)
 *   - Recent Media
 *   - Media Usage
 *   - Broken Media alerts
 *   - Pending Validation
 *   - Most Used Media
 *   - Provider Statistics
 *   - Favorites
 *   - Collections
 *   - Search + Filters
 *   - Help button
 */
import React, { useEffect, useState, useCallback } from 'react';
import { mediaProviderService } from '../../services/api';
import MediaGrid from '../media/MediaGrid';
import MediaToolbar from '../media/MediaToolbar';
import MediaCard from '../media/MediaCard';
import MediaPlaceholder from '../media/MediaPlaceholder';
import MediaCollections from './MediaCollections';
import MediaHelp from '../media/MediaHelp';

function fmtCount(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString();
}

function StatCard({ icon, label, value, color, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className="hub-stat-card"
      onClick={onClick}
      style={{
        '--hub-accent': color || 'var(--studio-pink)',
      }}
    >
      <div className="hub-stat-icon">
        <i className={`fas ${icon}`} />
      </div>
      <div className="hub-stat-body">
        <div className="hub-stat-value">{fmtCount(value)}</div>
        <div className="hub-stat-label">{label}</div>
      </div>
    </Tag>
  );
}

// ─── Provider Stats ───────────────────────────────────────────────────

function ProviderStats({ providers = [] }) {
  if (!providers || providers.length === 0) return null;
  return (
    <div className="hub-provider-stats">
      <h4 className="hub-section-subtitle">
        <i className="fas fa-cloud" /> Provider Statistics
      </h4>
      <div className="hub-provider-list">
        {providers.slice(0, 5).map((p, i) => (
          <div key={i} className="hub-provider-item">
            <span className="hub-provider-name">{p.name || p.provider_name || p.key}</span>
            <span className="hub-provider-count">{p.count || p.total || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Media List ────────────────────────────────────────────────

function RecentMediaList({ items = [], lang }) {
  const isHt = lang === 'ht';
  if (!items || items.length === 0) return null;
  return (
    <div className="hub-recent">
      <h4 className="hub-section-subtitle">
        <i className="fas fa-clock" /> {isHt ? 'Dènye Medya' : 'Recent Media'}
      </h4>
      <div className="hub-recent-list">
        {items.slice(0, 5).map((item, i) => (
          <MediaCard key={item.id || i} media={item} size="small" showActions={false} lang={lang} />
        ))}
      </div>
    </div>
  );
}

// ─── Quick Upload Guide ───────────────────────────────────────────────

function QuickUploadGuide({ lang, onChooseProvider, onReadDocs }) {
  const isHt = lang === 'ht';
  return (
    <div className="hub-quick-guide">
      <h4 className="hub-section-subtitle">
        <i className="fas fa-rocket" /> {isHt ? 'Gid rapid pou ajoute medya' : 'Quick Upload Guide'}
      </h4>
      <div className="hub-guide-steps">
        <div className="hub-guide-step">
          <span className="hub-guide-num">1</span>
          <span>{isHt ? 'Chwazi yon provider depo medya' : 'Choose a media storage provider'}</span>
        </div>
        <div className="hub-guide-step">
          <span className="hub-guide-num">2</span>
          <span>{isHt ? 'Mete medya a sou provider la' : 'Upload media to the provider'}</span>
        </div>
        <div className="hub-guide-step">
          <span className="hub-guide-num">3</span>
          <span>{isHt ? 'Kopi URL piblik la' : 'Copy the public URL'}</span>
        </div>
        <div className="hub-guide-step">
          <span className="hub-guide-num">4</span>
          <span>{isHt ? 'Kole URL la nan Atelnyo' : 'Paste the URL in Atelnyo'}</span>
        </div>
      </div>
      <div className="hub-guide-actions">
        {onChooseProvider && (
          <button type="button" className="btn-primary" onClick={onChooseProvider}>
            <i className="fas fa-plug" /> {isHt ? 'Chwazi Provider' : 'Choose Provider'}
          </button>
        )}
        {onReadDocs && (
          <button type="button" className="btn-secondary" onClick={onReadDocs}>
            <i className="fas fa-book" /> {isHt ? 'Dokimantasyon' : 'Documentation'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main MediaHub ────────────────────────────────────────────────────

export default function MediaHub({ lang = 'ht', showToast, user, onNavigateToProvider, onNavigateToLibrary }) {
  const isHt = lang === 'ht';
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [providers, setProviders] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterHealth, setFilterHealth] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [viewMode, setViewMode] = useState('grid');
  const [showCollections, setShowCollections] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mediaRes, provRes] = await Promise.allSettled([
        mediaProviderService.userMedia(),
        mediaProviderService.list(),
      ]);
      if (mediaRes.status === 'fulfilled') {
        const data = mediaRes.value.data?.results || mediaRes.value.data || [];
        setItems(Array.isArray(data) ? data : []);
      }
      if (provRes.status === 'fulfilled') {
        const data = provRes.value.data?.results || provRes.value.data || [];
        setProviders(Array.isArray(data) ? data : []);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Stats ───────────────────────────────────────────────────────
  const totalCount = items.length;
  const brokenCount = items.filter((i) => i.health_status === 'broken' || i.health_status === 'blocked').length;
  const healthyCount = items.filter((i) => i.health_status === 'healthy').length;
  const pendingCount = items.filter((i) => i.health_status === 'checking' || i.health_status === 'unknown').length;
  const mostUsed = [...items].sort((a, b) => (b.usages?.length || 0) - (a.usages?.length || 0)).slice(0, 5);
  const recentItems = [...items].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  if (showCollections) {
    return <MediaCollections lang={lang} showToast={showToast} onBack={() => setShowCollections(false)} />;
  }

  return (
    <div className="media-hub">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="hub-header">
        <h2 className="studio-section-title" style={{ margin: 0 }}>
          <i className="fas fa-photo-video" />
          {isHt ? 'Media Hub' : 'Media Hub'}
        </h2>
        <div className="hub-header-actions">
          <button type="button" className="btn-secondary" onClick={() => setShowCollections(true)}>
            <i className="fas fa-folder" /> {isHt ? 'Koleksyon' : 'Collections'}
          </button>
          <MediaHelp context="library" lang={lang} />
        </div>
      </div>

      {/* ─── Stats Grid ─────────────────────────────────────────── */}
      <div className="hub-stats-grid">
        <StatCard icon="fa-database" label={isHt ? 'Total medya' : 'Total Media'} value={totalCount} color="var(--state-info, #38bdf8)" />
        <StatCard icon="fa-check-circle" label={isHt ? 'An sante' : 'Healthy'} value={healthyCount} color="var(--state-success, #10b981)" />
        <StatCard icon="fa-exclamation-circle" label={isHt ? 'Kase / Bloke' : 'Broken / Blocked'} value={brokenCount} color="var(--state-error, #ef4444)" onClick={brokenCount > 0 ? () => setFilterHealth('broken') : undefined} />
        <StatCard icon="fa-hourglass-half" label={isHt ? 'Annatant validasyon' : 'Pending'} value={pendingCount} color="var(--state-warning, #f59e0b)" />
        <StatCard icon="fa-folder" label={isHt ? 'Providers' : 'Providers'} value={providers.length} color="var(--pr-color-violet-500, #8b5cf6)" />
      </div>

      {/* ─── Quick Upload Guide (when no media) ─────────────────── */}
      {!loading && totalCount === 0 && (
        <QuickUploadGuide
          lang={lang}
          onChooseProvider={onNavigateToProvider}
          onReadDocs={() => window.open('/docs/media', '_blank')}
        />
      )}

      {/* ─── Alerts ─────────────────────────────────────────────── */}
      {brokenCount > 0 && (
        <div className="hub-alert hub-alert-danger">
          <i className="fas fa-exclamation-triangle" />
          <span>
            {isHt
              ? `${brokenCount} medya kase. Ranplase URL yo pou evite kontni kase.`
              : `${brokenCount} broken media items. Replace URLs to avoid broken content.`}
          </span>
          <button type="button" className="hub-alert-btn" onClick={() => setFilterHealth('broken')}>
            {isHt ? 'Gade' : 'View'}
          </button>
        </div>
      )}
      {pendingCount > 0 && (
        <div className="hub-alert hub-alert-warning">
          <i className="fas fa-hourglass-half" />
          <span>
            {isHt
              ? `${pendingCount} medya annatant validasyon.`
              : `${pendingCount} media items pending validation.`}
          </span>
        </div>
      )}

      {/* ─── Two-column layout ─────────────────────────────────── */}
      <div className="hub-layout">
        {/* Main */}
        <div className="hub-main">
          <MediaToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filterType={filterType}
            onFilterTypeChange={setFilterType}
            filterHealth={filterHealth}
            onFilterHealthChange={setFilterHealth}
            sortBy={sortBy}
            onSortChange={setSortBy}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onAdd={onNavigateToLibrary}
            onRefresh={fetchData}
            total={totalCount}
            filtered={items.length}
            lang={lang}
          />

          {loading ? (
            <div className="hub-loading">
              <i className="fas fa-spinner fa-spin" />
              <span>{isHt ? 'Ap chaje medya...' : 'Loading media...'}</span>
            </div>
          ) : items.length === 0 ? (
            <MediaPlaceholder
              lang={lang}
              onChooseProvider={onNavigateToProvider}
            />
          ) : viewMode === 'grid' ? (
            <MediaGrid
              items={items}
              filter={searchQuery}
              sortBy={sortBy}
              size="medium"
              lang={lang}
            />
          ) : (
            <div className="hub-list-view">
              {items
                .filter((i) => {
                  if (filterType !== 'all' && (i.media_type || i.kind) !== filterType) return false;
                  if (filterHealth !== 'all' && i.health_status !== filterHealth) return false;
                  if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    return (i.url || '').toLowerCase().includes(q) ||
                           (i.provider_name || '').toLowerCase().includes(q);
                  }
                  return true;
                })
                .map((item) => (
                  <MediaCard key={item.id} media={item} size="small" lang={lang} />
                ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="hub-sidebar">
          <RecentMediaList items={recentItems} lang={lang} />
          <ProviderStats providers={providers} />
          {mostUsed.length > 0 && (
            <div className="hub-most-used">
              <h4 className="hub-section-subtitle">
                <i className="fas fa-star" /> {isHt ? 'Pi itilize' : 'Most Used'}
              </h4>
              <div className="hub-most-used-list">
                {mostUsed.map((item) => (
                  <MediaCard key={item.id} media={item} size="small" showActions={false} lang={lang} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
