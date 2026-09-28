/**
 * src/components/studio/sections/IntelligenceSection.jsx
 *
 * Creator Studio — Intelligence Center (DIP).
 *
 * Sub-tabs:
 *   1. Insights    — engagement score, segments, interests, skills, evolution
 *   2. Audience    — audience segments overview
 *   3. Best Times  — optimal posting/engagement times
 *   4. Privacy     — personalization and data consent controls
 */
import React, { useState, useCallback } from 'react';
import { affiliateApi } from '../../../services/affiliateApi';
import useFetch from '../../../hooks/useFetch';
import { courseService } from '../../../services/api';
import { StudioSkeleton, EmptyState, fmtCount, fmtDate, classNames } from '../shared';
import styles from './sections.module.css';

const SUB_TABS = [
  { id: 'intelligence', icon: 'fa-wand-magic-sparkles', label: 'Content AI',   labelHt: 'Kontni AI' },
  { id: 'insights',     icon: 'fa-brain',        label: 'Insights',      labelHt: 'Apèsi' },
  { id: 'audience',     icon: 'fa-users',         label: 'Audience',      labelHt: 'Odyans' },
  { id: 'best-times',   icon: 'fa-clock',          label: 'Best Times',    labelHt: 'Pi bon Momant' },
  { id: 'privacy',      icon: 'fa-shield-alt',     label: 'Privacy',       labelHt: 'Prive' },
];

// ═══════════════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════════════

// Status badge colors for CI processing states
const CI_STATUS = {
  not_processed: { bg: '#f3f4f6', text: '#6b7280', icon: 'fa-circle-question', label: 'Not Processed', labelHt: 'Pa Treté' },
  queued:        { bg: '#fef3c7', text: '#d97706', icon: 'fa-clock',           label: 'Queued',       labelHt: ' nan Fil' },
  processing:    { bg: '#dbeafe', text: '#2563eb', icon: 'fa-spinner',         label: 'Processing',   labelHt: 'Tretman' },
  ready:         { bg: '#d1fae5', text: '#059669', icon: 'fa-check-circle',    label: 'Ready',        labelHt: 'Pare' },
  partial:       { bg: '#fef3c7', text: '#d97706', icon: 'fa-triangle-exclamation', label: 'Partial',  labelHt: 'Pasyèl' },
  failed:        { bg: '#fee2e2', text: '#dc2626', icon: 'fa-xmark-circle',    label: 'Failed',       labelHt: 'Echèk' },
  stale:         { bg: '#f3f4f6', text: '#6b7280', icon: 'fa-rotate',          label: 'Stale',        labelHt: 'Anile' },
};

function ContentIntelligenceTab({ lang, t, showToast }) {
  const { data, loading, refetch } = useFetch(
    () => courseService.getMyCoursesCI(),
    { defaultValue: null, deps: [], transform: (d) => d?.data || d },
  );
  const [processing, setProcessing] = useState({});

  const handleProcess = useCallback(async (courseId) => {
    setProcessing((p) => ({ ...p, [courseId]: true }));
    try {
      await courseService.processCI(courseId);
      showToast?.(
        lang === 'ht' ? 'Tretman kòmanse!' : 'Processing started!',
        'check-circle',
      );
      // Poll for updates
      setTimeout(() => refetch(), 2000);
      setTimeout(() => refetch(), 5000);
    } catch (err) {
      showToast?.(
        lang === 'ht' ? 'Erè nan tretman' : 'Failed to start processing',
        'exclamation-triangle',
      );
    } finally {
      setProcessing((p) => ({ ...p, [courseId]: false }));
    }
  }, [refetch, showToast, lang]);

  if (loading) return <StudioSkeleton rows={5} />;
  if (!data?.courses?.length) {
    return (
      <EmptyState
        icon="fa-graduation-cap"
        title={lang === 'ht' ? 'Pa gen kou' : 'No courses yet'}
        hint={lang === 'ht' ? 'Kreye yon kou pou wè Content Intelligence' : 'Create a course to see Content Intelligence'}
      />
    );
  }

  const courses = data.courses;
  const ready = courses.filter((c) => c.intelligence_status === 'ready').length;
  const notProcessed = courses.filter((c) => c.intelligence_status === 'not_processed').length;

  return (
    <div className={styles.section}>
      {/* Summary stats */}
      <div className={styles.affiliateGrid} style={{ marginBottom: '20px' }}>
        <div className={styles.affiliateStatCard}>
          <div className={styles.affiliateStatValue}>{courses.length}</div>
          <div className={styles.affiliateStatLabel}>{lang === 'ht' ? 'Kou Total' : 'Total Courses'}</div>
        </div>
        <div className={styles.affiliateStatCard}>
          <div className={styles.affiliateStatValue} style={{ color: '#059669' }}>{ready}</div>
          <div className={styles.affiliateStatLabel}>{lang === 'ht' ? 'Pare' : 'Intelligence Ready'}</div>
        </div>
        <div className={styles.affiliateStatCard}>
          <div className={styles.affiliateStatValue} style={{ color: notProcessed > 0 ? '#d97706' : '#059669' }}>{notProcessed}</div>
          <div className={styles.affiliateStatLabel}>{lang === 'ht' ? 'Pa Treté' : 'Not Processed'}</div>
        </div>
      </div>

      {/* Course list */}
      <h3 className={styles.sectionSubtitle}>
        <i className="fas fa-graduation-cap" aria-hidden="true" />
        {' '}{lang === 'ht' ? 'Kou Ou' : 'Your Courses'}
      </h3>

      <div className={styles.list}>
        {courses.map((course) => {
          const st = CI_STATUS[course.intelligence_status] || CI_STATUS.not_processed;
          return (
            <div key={course.id} className={styles.listItem}>
              <div className={styles.listAvatar}>
                {course.image_url ? (
                  <img src={course.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                ) : (
                  <i className="fas fa-graduation-cap" style={{ color: '#6366f1' }} />
                )}
              </div>
              <div className={styles.listBody}>
                <div className={styles.listTitle}>{course.title}</div>
                <div className={styles.listMeta}>
                  {/* Status badge */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 12,
                    background: st.bg, color: st.text, fontSize: '0.75rem', fontWeight: 500,
                  }}>
                    <i className={`fas ${st.icon}`} />
                    {lang === 'ht' ? st.labelHt : st.label}
                  </span>
                  {/* Feature indicators */}
                  {course.seo_ready && (
                    <span style={{ color: '#059669', fontSize: '0.75rem' }} title="SEO Ready">
                      <i className="fas fa-search" /> SEO
                    </span>
                  )}
                  {course.search_indexed && (
                    <span style={{ color: '#2563eb', fontSize: '0.75rem' }} title="Search Indexed">
                      <i className="fas fa-database" /> Index
                    </span>
                  )}
                  {course.relationships_count > 0 && (
                    <span style={{ color: '#8b5cf6', fontSize: '0.75rem' }} title="Recommendations">
                      <i className="fas fa-link" /> {course.relationships_count}
                    </span>
                  )}
                  {course.last_processed_at && (
                    <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                      {fmtDate(course.last_processed_at)}
                    </span>
                  )}
                </div>
                {course.summary && (
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>
                    {course.summary.length > 100 ? course.summary.slice(0, 100) + '...' : course.summary}
                  </div>
                )}
                {course.skills && course.skills.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    {course.skills.slice(0, 5).map((skill, i) => (
                      <span key={i} style={{
                        display: 'inline-block', padding: '1px 6px', margin: '2px 2px 0 0',
                        borderRadius: 10, background: 'rgba(99,102,241,0.1)',
                        color: '#6366f1', fontSize: '0.7rem',
                      }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Action button */}
              {course.status === 'published' && (
                <button
                  type="button"
                  onClick={() => handleProcess(course.id)}
                  disabled={processing[course.id]}
                  style={{
                    padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
                    background: processing[course.id] ? '#f9fafb' : '#fff',
                    color: '#6366f1', cursor: processing[course.id] ? 'wait' : 'pointer',
                    fontSize: '0.8rem', fontWeight: 500, whiteSpace: 'nowrap',
                  }}
                  title={lang === 'ht' ? 'Retretman' : 'Re-process'}
                >
                  {processing[course.id] ? (
                    <i className="fas fa-spinner fa-spin" />
                  ) : (
                    <><i className="fas fa-sync-alt" /> {lang === 'ht' ? 'Tretman' : 'Process'}</>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InsightsTab({ lang, t, showToast }) {
  const { data: metrics, loading } = useFetch(
    () => affiliateApi.getIntelligenceMetrics(),
    { defaultValue: null, deps: [] },
  );

  if (loading) return <StudioSkeleton rows={4} />;
  if (!metrics) return <EmptyState icon="fa-brain" title={lang === 'ht' ? 'Pa gen done' : 'No data yet'}
    hint={lang === 'ht' ? 'Kontinye itilize platfòm pou wè insights' : 'Keep using the platform to see insights'} />;

  return (
    <div className={styles.section}>
      {/* Score cards */}
      <div className={styles.affiliateGrid}>
        <div className={styles.affiliateStatCard}>
          <div className={styles.affiliateStatValue}>{metrics.engagement_score?.toFixed(1) || '0'}</div>
          <div className={styles.affiliateStatLabel}>{lang === 'ht' ? 'Angajman' : 'Engagement Score'}</div>
        </div>
        <div className={styles.affiliateStatCard}>
          <div className={styles.affiliateStatValue}>{metrics.evolution_score?.toFixed(1) || '0'}</div>
          <div className={styles.affiliateStatLabel}>{lang === 'ht' ? 'Evolisyon' : 'Evolution Score'}</div>
        </div>
        <div className={styles.affiliateStatCard}>
          <div className={styles.affiliateStatValue}>{(metrics.trust_score * 100)?.toFixed(0) || '50'}</div>
          <div className={styles.affiliateStatLabel}>{lang === 'ht' ? 'Konfyans' : 'Trust Score'}</div>
        </div>
        <div className={styles.affiliateStatCard}>
          <div className={styles.affiliateStatValue}>{metrics.segments?.total_segments || 0}</div>
          <div className={styles.affiliateStatLabel}>{lang === 'ht' ? 'Segment Odyans' : 'Audience Segments'}</div>
        </div>
      </div>

      {/* Interests */}
      {metrics.interests?.length > 0 && (
        <>
          <h3 className={styles.sectionSubtitle} style={{ marginTop: '24px' }}>
            <i className="fas fa-star" aria-hidden="true" />
            {lang === 'ht' ? 'Enterè ou' : 'Your Interests'}
          </h3>
          <div className={styles.list}>
            <div className={styles.listItem}>
              <div className={styles.listBody}>
                {metrics.interests.map((interest, i) => (
                  <span key={i} className={styles.badge} style={{
                    display: 'inline-block', padding: '4px 10px', margin: '2px 4px 2px 0',
                    borderRadius: '20px', background: 'var(--accent-bg, rgba(99,102,241,0.1))',
                    color: 'var(--accent, #6366f1)', fontSize: '0.8rem',
                  }}>
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Skills */}
      {metrics.skills?.length > 0 && (
        <>
          <h3 className={styles.sectionSubtitle} style={{ marginTop: '16px' }}>
            <i className="fas fa-tools" aria-hidden="true" />
            {lang === 'ht' ? 'Konpetans ou' : 'Your Skills'}
          </h3>
          <div className={styles.list}>
            <div className={styles.listItem}>
              <div className={styles.listBody}>
                {metrics.skills.map((skill, i) => (
                  <span key={i} className={styles.badge} style={{
                    display: 'inline-block', padding: '4px 10px', margin: '2px 4px 2px 0',
                    borderRadius: '20px', background: 'rgba(16,185,129,0.1)',
                    color: '#10b981', fontSize: '0.8rem',
                  }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Recent activity */}
      {metrics.recent_activity?.length > 0 && (
        <>
          <h3 className={styles.sectionSubtitle} style={{ marginTop: '24px' }}>
            <i className="fas fa-history" aria-hidden="true" />
            {lang === 'ht' ? 'Aktivite Resan' : 'Recent Activity'}
          </h3>
          <div className={styles.list}>
            {metrics.recent_activity.map((evt) => (
              <div key={evt.id} className={styles.listItem}>
                <div className={styles.listAvatar}><i className="fas fa-circle" style={{ fontSize: '0.5rem', color: '#6366f1' }} /></div>
                <div className={styles.listBody}>
                  <div className={styles.listTitle}>{evt.event_type?.replace(/_/g, ' ')}</div>
                  <div className={styles.listMeta}>
                    {evt.content_type && <>{evt.content_type} · </>}
                    {fmtDate(evt.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AudienceTab({ lang, t, showToast }) {
  const { data: segments, loading, refetch } = useFetch(
    () => affiliateApi.getAudienceSegments(),
    { defaultValue: [], deps: [], transform: (d) => (Array.isArray(d) ? d : (d?.results || [])) },
  );

  const handleRecalculate = useCallback(async (id) => {
    try {
      await affiliateApi.recalculateAudienceSegment(id);
      showToast?.(lang === 'ht' ? 'Segman rekalkile' : 'Segment recalculated', 'check');
      refetch();
    } catch {
      showToast?.(lang === 'ht' ? 'Erek' : 'Failed', 'error');
    }
  }, [showToast, refetch]);

  if (loading) return <StudioSkeleton rows={4} />;

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionSubtitle}>
        <i className="fas fa-users" aria-hidden="true" />
        {lang === 'ht' ? 'Segment Odyans' : 'Audience Segments'}
      </h3>

      {segments.length === 0 ? (
        <EmptyState icon="fa-users"
          title={lang === 'ht' ? 'Pokò gen segment' : 'No segments yet'} />
      ) : (
        <div className={styles.list}>
          {segments.map((seg) => (
            <div key={seg.id} className={styles.listItem}>
              <div className={styles.listAvatar}>
                <i className={`fas ${seg.category === 'diaspora' ? 'fa-globe-americas' : seg.category === 'behavioral' ? 'fa-chart-line' : 'fa-tag'}`} />
              </div>
              <div className={styles.listBody}>
                <div className={styles.listTitle}>{seg.name}</div>
                <div className={styles.listMeta}>
                  {seg.category} · {fmtCount(seg.member_count)} {lang === 'ht' ? 'manb' : 'members'}
                  {seg.is_system && ` · ${lang === 'ht' ? 'Sistèm' : 'System'}`}
                  {seg.last_calculated && ` · ${fmtDate(seg.last_calculated)}`}
                </div>
              </div>
              {!seg.is_system && (
                <button type="button" className={styles.affiliateBtnApprove}
                  onClick={() => handleRecalculate(seg.id)}
                  title={lang === 'ht' ? 'Rekalkile' : 'Recalculate'}>
                  <i className="fas fa-sync" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BestTimesTab({ lang, t, showToast }) {
  const { data: times, loading } = useFetch(
    () => affiliateApi.getIntelligenceBestTimes(),
    { defaultValue: null, deps: [] },
  );

  if (loading) return <StudioSkeleton rows={3} />;

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionSubtitle}>
        <i className="fas fa-clock" aria-hidden="true" />
        {lang === 'ht' ? 'Pi bon Momant pou Pibliye' : 'Best Times to Post'}
      </h3>

      {!times?.best_hours?.length ? (
        <EmptyState icon="fa-clock"
          title={lang === 'ht' ? 'Pokò gen ase done' : 'Not enough data yet'}
          hint={lang === 'ht' ? 'Kontinye itilize platfòm pou wè analiz' : 'Keep using the platform to see analysis'} />
      ) : (
        <>
          <div className={styles.affiliateGrid}>
            {times.best_hours.slice(0, 3).map((h) => (
              <div key={h.hour} className={styles.affiliateStatCard}>
                <div className={styles.affiliateStatValue}>
                  {h.hour % 12 || 12}{h.hour < 12 ? 'AM' : 'PM'}
                </div>
                <div className={styles.affiliateStatLabel}>{fmtCount(h.count)} {lang === 'ht' ? 'aktivite' : 'activities'}</div>
              </div>
            ))}
          </div>

          {times.best_days?.length > 0 && (
            <>
              <h4 className={styles.sectionSubtitle} style={{ fontSize: '1rem', marginTop: '16px' }}>
                <i className="fas fa-calendar" />
                {lang === 'ht' ? 'Pi bon Jou' : 'Best Days'}
              </h4>
              <div className={styles.affiliateGrid}>
                {times.best_days.slice(0, 3).map((d) => (
                  <div key={d.day} className={styles.affiliateStatCard}>
                    <div className={styles.affiliateStatValue}>{d.day}</div>
                    <div className={styles.affiliateStatLabel}>{fmtCount(d.count)} {lang === 'ht' ? 'aktivite' : 'activities'}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {times.recommendation && (
            <div className={styles.affiliateNotice} style={{ marginTop: '16px' }}>
              <i className="fas fa-lightbulb" />
              <span>{times.recommendation}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PrivacyTab({ lang, t, showToast }) {
  const { data: privacy, loading, refetch } = useFetch(
    () => affiliateApi.getPrivacySettings(),
    { defaultValue: null, deps: [] },
  );
  const [saving, setSaving] = useState(false);

  const handleToggle = useCallback(async (setting) => {
    if (!privacy) return;
    setSaving(true);
    try {
      const newVal = !privacy.settings[setting];
      await affiliateApi.updatePrivacy({ [setting]: newVal });
      showToast?.(lang === 'ht' ? 'Mizajou' : 'Updated', 'check');
      refetch();
    } catch {
      showToast?.(lang === 'ht' ? 'Ere' : 'Failed', 'error');
    } finally {
      setSaving(false);
    }
  }, [privacy, showToast, refetch, lang]);

  const handleReset = useCallback(async () => {
    try {
      await affiliateApi.resetPrivacy();
      showToast?.(lang === 'ht' ? 'Reyajiste' : 'Reset to defaults', 'check');
      refetch();
    } catch {
      showToast?.(lang === 'ht' ? 'Ere' : 'Failed', 'error');
    }
  }, [showToast, refetch, lang]);

  if (loading) return <StudioSkeleton rows={3} />;

  const settings = [
    { key: 'allow_personalization', label: lang === 'ht' ? 'Pèsonalizasyon' : 'Personalization',
      desc: lang === 'ht' ? 'Rekòmandasyon pèsonalize' : 'Personalized recommendations' },
    { key: 'allow_behavior_tracking', label: lang === 'ht' ? 'Swivi Konpòtman' : 'Behavior Tracking',
      desc: lang === 'ht' ? 'Swivi aksyon ou pou amelyore rekòmandasyon' : 'Track actions to improve recommendations' },
    { key: 'allow_location_usage', label: lang === 'ht' ? 'Itilizasyon Lokalizasyon' : 'Location Usage',
      desc: lang === 'ht' ? 'Itilize lokalizasyon ou pou dekouvri kontni' : 'Use location for content discovery' },
    { key: 'allow_profile_analysis', label: lang === 'ht' ? 'Analiz Pwofil' : 'Profile Analysis',
      desc: lang === 'ht' ? 'Analize pwofil ou pou insights' : 'Analyze profile for insights' },
  ];

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionSubtitle}>
        <i className="fas fa-shield-alt" />
        {lang === 'ht' ? 'Prive ak Kontwòl' : 'Privacy & Controls'}
      </h3>

      {privacy?.insights?.personalization_active !== undefined && (
        <div className={`${styles.affiliateBanner} ${privacy.insights.personalization_active ? styles.affiliateBannerActive : styles.affiliateBannerInactive}`}>
          <i className={`fas ${privacy.insights.personalization_active ? 'fa-check-circle' : 'fa-pause-circle'}`} />
          <span>
            {privacy.insights.personalization_active
              ? (lang === 'ht' ? 'Pèsonalizasyon aktif' : 'Personalization active')
              : (lang === 'ht' ? 'Pèsonalizasyon dezaktive' : 'Personalization inactive')}
          </span>
        </div>
      )}

      <div className={styles.affiliateForm}>
        {settings.map((s) => (
          <div key={s.key} className={styles.affiliateToggleRow}>
            <div>
              <strong>{s.label}</strong>
              <p className={styles.affiliateToggleDesc}>{s.desc}</p>
            </div>
            <label className={styles.affiliateSwitch}>
              <input type="checkbox" checked={privacy?.settings?.[s.key] || false}
                onChange={() => handleToggle(s.key)} disabled={saving} />
              <span className={styles.affiliateSwitchSlider} />
            </label>
          </div>
        ))}

        <button type="button" className="btn-secondary" onClick={handleReset} disabled={saving}
          style={{ marginTop: '12px' }}>
          <i className="fas fa-undo" />
          {lang === 'ht' ? 'Retabli Defo' : 'Reset to Defaults'}
        </button>
      </div>

      {privacy?.insights?.features_affected && (
        <>
          <h4 className={styles.sectionSubtitle} style={{ fontSize: '1rem', marginTop: '24px' }}>
            <i className="fas fa-info-circle" />
            {lang === 'ht' ? 'Karakteristik afekte' : 'Affected Features'}
          </h4>
          <div className={styles.list}>
            {Object.entries(privacy.insights.features_affected).map(([feature, active]) => (
              <div key={feature} className={styles.listItem}>
                <div className={styles.listAvatar}>
                  <i className={`fas ${active ? 'fa-check-circle' : 'fa-times-circle'}`}
                    style={{ color: active ? '#10b981' : '#ef4444' }} />
                </div>
                <div className={styles.listBody}>
                  <div className={styles.listTitle}>{feature.replace(/_/g, ' ')}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// Main IntelligenceSection
// ═══════════════════════════════════════════════════════════════════════

export default function IntelligenceSection({ lang, t, showToast }) {
  const [activeTab, setActiveTab] = useState('insights');

  const renderTab = () => {
    switch (activeTab) {
      case 'intelligence': return <ContentIntelligenceTab lang={lang} t={t} showToast={showToast} />;
      case 'insights':   return <InsightsTab lang={lang} t={t} showToast={showToast} />;
      case 'audience':   return <AudienceTab lang={lang} t={t} showToast={showToast} />;
      case 'best-times': return <BestTimesTab lang={lang} t={t} showToast={showToast} />;
      case 'privacy':    return <PrivacyTab lang={lang} t={t} showToast={showToast} />;
      default:           return <ContentIntelligenceTab lang={lang} t={t} showToast={showToast} />;
    }
  };

  return (
    <div className={styles.section}>
      {/* Sub-tab navigation */}
      <div className={styles.affiliateTabs}>
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${styles.affiliateTab} ${activeTab === tab.id ? styles.affiliateTabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={`fas ${tab.icon}`} aria-hidden="true" />
            <span>{lang === 'ht' ? tab.labelHt : tab.label}</span>
          </button>
        ))}
      </div>

      {renderTab()}
    </div>
  );
}
