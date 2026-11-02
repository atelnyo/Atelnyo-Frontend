/**
 * ContentLifecycleControls — publish / unpublish / archive / visibility
 * for ONE content item (Phase 11/12 UI wiring).
 *
 * Generic by design: it takes a content type + id, never a hardcoded
 * course name, so the same control works for posts, courses, products,
 * music, talents, communities, events, jobs and portfolio projects.
 *
 * The backend remains authoritative: structured validation errors from
 * `POST /api/content-state/...` are rendered field-by-field, and the
 * returned row (publication_state / effective_distribution /
 * is_discoverable) replaces the local state immediately.
 */
import { useState } from 'react';
import { contentStateService } from '../../services/api';

const COPY = {
  ht: {
    publish: 'Pibliye',
    unpublish: 'Retire piblikasyon',
    archive: 'Achive',
    restore: 'Retabli',
    visibility: 'Viabilite',
    schedule: 'Pwograme',
    published: 'Pibliye',
    draft: 'Bouyon',
    scheduled: 'Pwograme',
    archived: 'Achive',
    deleted: 'Efase',
    processing: 'Ap trete',
    distribution: 'Distribisyon',
    discoverable: 'Nan dekouvèt',
    hiddenFromDiscovery: 'Pa nan dekouvèt',
    saving: 'Ap anrejistre…',
    loadError: 'Pa t kapab chanje estati a.',
    required: 'Dat orè obligatwa.',
  },
  en: {
    publish: 'Publish',
    unpublish: 'Unpublish',
    archive: 'Archive',
    restore: 'Restore',
    visibility: 'Visibility',
    schedule: 'Schedule',
    published: 'Published',
    draft: 'Draft',
    scheduled: 'Scheduled',
    archived: 'Archived',
    deleted: 'Deleted',
    processing: 'Processing',
    distribution: 'Distribution',
    discoverable: 'In discovery',
    hiddenFromDiscovery: 'Hidden from discovery',
    saving: 'Saving…',
    loadError: 'Could not change the status.',
    required: 'A date is required.',
  },
};

export default function ContentLifecycleControls({
  contentType,
  objectId,
  initialState = null,
  lang = 'ht',
  onChanged,
}) {
  const copy = COPY[lang] || COPY.ht;
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [error, setError] = useState(null);

  if (!contentType || !objectId) return null;

  const run = async (key, fn) => {
    setBusy(key);
    setError(null);
    try {
      const response = await fn();
      setState(response.data);
      onChanged?.(response.data);
    } catch (err) {
      const payload = err?.response?.data;
      setError({
        message: payload?.detail || copy.loadError,
        fields: payload?.errors || null,
      });
    } finally {
      setBusy('');
    }
  };

  const publication = state?.publication_state || 'draft';
  const isPublished = publication === 'published';
  const isArchived = publication === 'archived';
  const isBusy = Boolean(busy);

  return (
    <div className="lifecycle-controls" data-testid="content-lifecycle-controls">
      <div className="lifecycle-status" aria-live="polite" style={{ fontSize: '.78rem', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span
          className="lifecycle-badge"
          style={{
            padding: '2px 8px', borderRadius: 999, fontWeight: 600,
            background: isPublished ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.16)',
            color: isPublished ? 'var(--state-success, #10b981)' : 'inherit',
          }}
        >
          {copy[publication] || publication}
        </span>
        {state && (
          <span style={{ opacity: 0.75 }}>
            {copy.distribution}: {state.effective_distribution || 'excluded'} ·{' '}
            {state.is_discoverable ? copy.discoverable : copy.hiddenFromDiscovery}
          </span>
        )}
        {isBusy && <span role="status">{copy.saving}</span>}
      </div>

      <div className="lifecycle-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
        {!isPublished && !isArchived && (
          <button
            type="button"
            className="lifecycle-btn"
            disabled={isBusy}
            onClick={() => run('publish', () => contentStateService.publish(contentType, objectId))}
          >
            <i className="fas fa-upload" aria-hidden="true" /> {copy.publish}
          </button>
        )}
        {isPublished && (
          <button
            type="button"
            className="lifecycle-btn"
            disabled={isBusy}
            onClick={() => run('unpublish', () => contentStateService.unpublish(contentType, objectId))}
          >
            <i className="fas fa-eye-slash" aria-hidden="true" /> {copy.unpublish}
          </button>
        )}
        {isPublished && (
          <button
            type="button"
            className="lifecycle-btn"
            disabled={isBusy}
            onClick={() => run('archive', () => contentStateService.archive(contentType, objectId))}
          >
            <i className="fas fa-box-archive" aria-hidden="true" /> {copy.archive}
          </button>
        )}
        {(isArchived || publication === 'deleted') && (
          <button
            type="button"
            className="lifecycle-btn"
            disabled={isBusy}
            onClick={() => run('restore', () => contentStateService.restore(contentType, objectId))}
          >
            <i className="fas fa-rotate-left" aria-hidden="true" /> {copy.restore}
          </button>
        )}
      </div>

      <div className="lifecycle-visibility" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
        <label htmlFor={`visibility-${contentType}-${objectId}`} style={{ fontSize: '.75rem', opacity: 0.8 }}>
          {copy.visibility}
        </label>
        <select
          id={`visibility-${contentType}-${objectId}`}
          value={state?.visibility || 'public'}
          disabled={isBusy}
          onChange={(event) => {
            const visibility = event.target.value;
            run('visibility', () => contentStateService.visibility(contentType, objectId, visibility));
          }}
          style={{ fontSize: '.78rem', padding: '4px 6px', borderRadius: 6 }}
        >
          <option value="public">public</option>
          <option value="unlisted">unlisted</option>
          <option value="private">private</option>
        </select>

        <input
          type="datetime-local"
          value={scheduleAt}
          disabled={isBusy}
          onChange={(event) => setScheduleAt(event.target.value)}
          aria-label={copy.schedule}
          style={{ fontSize: '.75rem', padding: '3px 6px', borderRadius: 6 }}
        />
        <button
          type="button"
          className="lifecycle-btn"
          disabled={isBusy || !scheduleAt}
          onClick={() => {
            if (!scheduleAt) {
              setError({ message: copy.required, fields: null });
              return;
            }
            run('schedule', () => contentStateService.schedule(
              contentType, objectId, new Date(scheduleAt).toISOString(),
            ));
          }}
        >
          <i className="fas fa-clock" aria-hidden="true" /> {copy.schedule}
        </button>
      </div>

      {error && (
        <div role="alert" className="lifecycle-error" style={{ marginTop: 6, fontSize: '.78rem', color: 'var(--state-error, #ef4444)' }}>
          <div>{error.message}</div>
          {error.fields && (
            <ul style={{ margin: '4px 0 0 16px' }}>
              {Object.entries(error.fields).map(([field, messages]) => (
                <li key={field}>
                  <strong>{field}</strong>: {(Array.isArray(messages) ? messages : [messages]).join(' ')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
