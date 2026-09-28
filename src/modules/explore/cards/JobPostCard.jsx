/**
 * src/modules/explore/cards/JobPostCard.jsx
 *
 * Job Post card — extracted from Explore.jsx
 */
import React, { useState } from 'react';
import SaveCountChip from './SaveCountChip';
import TrendingVelocity from './TrendingVelocity';

/** SVG fallback — briefcase-themed gradient, same pattern as the other
    explore cards: shown when a job has no cover or the cover fails. */
function JobFallback({ title }) {
  return (
    <div className="explore-card-fallback">
      <svg viewBox="0 0 600 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="jb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <rect width="600" height="340" fill="url(#jb-grad)" />
        <g transform="translate(300,150)" opacity="0.2">
          {/* Briefcase */}
          <rect x="-58" y="-22" width="116" height="74" rx="10" fill="none" stroke="#0284c7" strokeWidth="5" />
          <path d="M-26 -22 L-26 -38 a26 26 0 0 1 52 0 L26 -22" fill="none" stroke="#0284c7" strokeWidth="5" strokeLinecap="round" />
        </g>
        <text x="300" y="270" textAnchor="middle" fill="#0284c7" opacity="0.5"
              fontFamily="system-ui, -apple-system, sans-serif" fontSize="14" fontWeight="600">
          {title || 'Job'}
        </text>
      </svg>
    </div>
  );
}

export default function JobPostCard({ job, t, showToast, onOpenSheet, saveCount = null, lang = 'ht' }) {
  // Cover image state — same pattern as CourseCard/ProductCard: the
  // image starts at opacity 0 and fades in via ``--loaded`` on load;
  // a broken URL hides the whole cover block instead of showing a
  // broken image.
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const cover = job.cover_url || '';
  const hasCover = Boolean(cover) && !imgFailed;

  function formatBudget(j) {
    if (!j || j.budget_min == null) return null;
    const min = Number(j.budget_min);
    const max = Number(j.budget_max);
    const cur = j.currency || 'USD';
    if (j.budget_type === 'hourly') return `$${min}-${max}/${cur === 'USD' ? 'hr' : cur}`;
    return `$${min} — $${max} ${cur}`;
  }
  const budget = formatBudget(job);
  function handleClick() {
    // Full detail sheet is the primary action — clicking a job now opens
    // JobSheet (budget, skills, description, poster, apply). Escrow
    // funding stays bound to CONTRACT MILESTONES (milestone_id), not job
    // posts, so the sheet's apply flow submits a PROPOSAL — never a
    // checkout.
    if (onOpenSheet) {
      onOpenSheet(job);
      return;
    }
    const parts = [job.title];
    if (budget) parts.push(budget);
    if (job.is_remote) parts.push(t.explore_remote || 'Remote');
    if (job.proposal_count != null) parts.push(`${job.proposal_count} ${t.explore_job_proposals || 'proposals'}`);
    showToast?.(parts.join(' · '), 'briefcase');
  }
  return (
    <div
      className="explore-card explore-card-job"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
      data-testid="job-card"
      data-job-id={job.id}
    >
      <div className="explore-card-image-wrap explore-card-image-square">
        {hasCover ? (
          <img
            className={`explore-card-image ${imgLoaded ? 'explore-card-image--loaded' : ''}`}
            src={cover}
            alt=""
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <JobFallback title={job.title} />
        )}
        {/* Trending Velocity — shows how fast this job is gaining traction */}
        {Number(job?._score?.trending) > 10 && (
          <TrendingVelocity
            score={job._score.trending}
            lang={lang || 'ht'}
            size="sm"
          />
        )}
      </div>
      <div className="explore-card-body">
        <div className="explore-card-title">
          <i className="fas fa-briefcase" aria-hidden="true" style={{ marginRight: 6, opacity: 0.6 }} />
          {job.title}
        </div>
        {job.description && (
          <div className="explore-card-subtitle">
            {job.description}
          </div>
        )}
        <div className="explore-card-meta">
          {budget && <span className="explore-card-tag">{budget}</span>}
          {job.is_remote && <span className="explore-card-tag explore-card-tag-skill">🌐 {t.explore_remote || 'Remote'}</span>}
          <SaveCountChip count={saveCount} t={t} />
          <span className="explore-card-plays" style={{ marginLeft: 'auto' }}>
            <i className="fas fa-file-signature" aria-hidden="true" /> {job.proposal_count || 0} {t.explore_job_proposals || 'proposals'}
          </span>
          <span className="explore-card-cta" aria-hidden="true">
            <i className="fas fa-arrow-right" />
          </span>
        </div>
      </div>
    </div>
  );
}
