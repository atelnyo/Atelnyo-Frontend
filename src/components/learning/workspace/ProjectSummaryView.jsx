/**
 * src/components/learning/workspace/ProjectSummaryView.jsx
 *
 * §24-§25 — Structured project summary view. Students should
 * review their accumulated work without navigating lesson by lesson.
 *
 * §26 — Structured data allows export (JSON) and presentation (PDF).
 *   - Backend endpoints: /api/projects/my/{course_id}/export/json|pdf
 *   - Client-side fallback: Blob download (JSON), print dialog (PDF)
 *   - Exports include user info, timestamp, and full project data.
 */
import React, { useCallback } from 'react';
import api from '../../../services/api';

/**
 * §26 — Build a client-side export object from project data.
 * Includes user info when available.
 */
function buildExportData(project, sections, user) {
  return {
    exported_at: new Date().toISOString(),
    exported_by: user ? {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name || user.first_name
        ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
        : user.username,
    } : null,
    title: project.title || 'My Project',
    status: project.status,
    completion_percentage: project.completion_percentage,
    completed_sections: project.completed_sections || [],
    sections: sections.map((section) => ({
      title: section.title,
      description: section.description,
      guidance: section.guidance,
      is_required: section.is_required,
      is_completed: (project.completed_sections || []).includes(section.id),
      fields: (section.fields || []).map((field) => ({
        label: field.label,
        key: field.key,
        field_type: field.field_type,
        required_status: field.required_status,
        value: field.value_text || field.value_number || field.value_date || field.value_json || null,
      })),
    })),
  };
}

/**
 * §26 — Trigger a browser download from a URL (backend endpoint).
 */
function downloadFromUrl(url, fallbackFn) {
  // For same-origin API endpoints, open in a new tab to trigger download.
  // The backend sets Content-Disposition: attachment.
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    // Fallback if programmatic click doesn't trigger download
    fallbackFn?.();
  }
}

/**
 * §26 — Trigger a browser download of a Blob (client-side fallback).
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * §26 — Client-side print-to-PDF fallback via browser's native print dialog.
 */
function printToPDF(project, sections, user, isHt) {
  const requiredCount = sections.filter((s) => s.is_required).length;
  const completedCount = (project.completed_sections || []).length;
  const pct = project.completion_percentage || 0;
  const now = new Date();
  const userName = user
    ? (user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username)
    : '';

  let html = `<!DOCTYPE html>
<html lang="${isHt ? 'ht' : 'en'}">
<head>
<meta charset="utf-8">
<title>${project.title || (isHt ? 'Rezime Pwojè' : 'Project Summary')}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; padding: 32px; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 1.4rem; margin-bottom: 4px; }
  .meta { color: #6b7280; font-size: 0.85rem; margin-bottom: 6px; }
  .user-info { color: #6b7280; font-size: 0.82rem; margin-bottom: 20px; }
  .progress { height: 6px; background: #e5e7eb; border-radius: 3px; margin-bottom: 8px; overflow: hidden; }
  .progress-fill { height: 100%; background: #10b981; border-radius: 3px; width: ${pct}%; }
  .section { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; page-break-inside: avoid; }
  .section.done { border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.04); }
  .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .section-header h2 { font-size: 1rem; flex: 1; }
  .badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
  .badge-done { background: #d1fae5; color: #065f46; }
  .badge-pending { background: #f3f4f6; color: #6b7280; }
  .field { margin-bottom: 10px; }
  .field-label { font-size: 0.78rem; font-weight: 600; color: #6b7280; margin-bottom: 2px; }
  .field-value { font-size: 0.9rem; line-height: 1.5; }
  .field-empty { font-size: 0.82rem; color: #999; font-style: italic; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 0.72rem; color: #999; text-align: center; }
  @media print { body { padding: 16px; } .section { break-inside: avoid; } }
</style>
</head>
<body>
<h1>${project.title || (isHt ? 'Pwojè Mwen' : 'My Project')}</h1>
<div class="meta">
  ${isHt ? 'Estati' : 'Status'}: ${project.status} &mdash;
  ${pct}% ${isHt ? 'konplete' : 'complete'} &mdash;
  ${completedCount}/${requiredCount} ${isHt ? 'sekasyon fini' : 'sections done'}
</div>
${userName ? `<div class="user-info">${isHt ? 'Ekspòte pa' : 'Exported by'}: ${userName}</div>` : ''}
<div class="progress"><div class="progress-fill"></div></div>
`;

  for (const section of sections) {
    const isDone = (project.completed_sections || []).includes(section.id);
    html += `<div class="section${isDone ? ' done' : ''}">`;
    html += `<div class="section-header">`;
    html += `<h2>${section.title}</h2>`;
    html += `<span class="badge ${isDone ? 'badge-done' : 'badge-pending'}">${isDone ? (isHt ? '✅ Fini' : '✅ Done') : (isHt ? '⬜ Pa fini' : '⬜ Pending')}</span>`;
    html += `</div>`;
    if (section.description) {
      html += `<p style="font-size:0.85rem;color:#6b7280;margin-bottom:10px">${section.description}</p>`;
    }
    for (const field of (section.fields || [])) {
      const val = field.value_text || field.value_number || field.value_date || (field.value_json ? JSON.stringify(field.value_json) : null);
      html += `<div class="field">`;
      html += `<div class="field-label">${field.label}${field.required_status === 'required' ? ' *' : ''}</div>`;
      html += val
        ? `<div class="field-value">${String(val).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
        : `<div class="field-empty">${isHt ? '(pa gen done)' : '(no data)'}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  const dateStr = now.toLocaleDateString(isHt ? 'ht' : 'en', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  html += `<div class="footer">${isHt ? 'Ekspòte depi Atelnyo' : 'Exported from Atelnyo'} &mdash; ${dateStr}</div>`;
  html += `</body></html>`;

  const printWindow = window.open('', '_blank', 'width=820,height=900');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }
}

export default function ProjectSummaryView({ project, isHt, onBack, user }) {
  const sections = project.sections || [];
  const courseId = project.course;

  // §26 — Export as JSON via backend (with client-side fallback)
  const handleExportJson = useCallback(async () => {
    try {
      const response = await api.get(`projects/my/${courseId}/export/json/`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/json' });
      downloadBlob(blob, `project-export-${new Date().toISOString().slice(0, 10)}.json`);
    } catch {
      // Client-side fallback
      const data = buildExportData(project, sections, user);
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      downloadBlob(blob, `project-export-${new Date().toISOString().slice(0, 10)}.json`);
    }
  }, [project, sections, user, courseId]);

  // §26 — Export as PDF via backend (with print dialog fallback)
  const handleExportPdf = useCallback(async () => {
    try {
      const response = await api.get(`projects/my/${courseId}/export/pdf/`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      downloadBlob(blob, `project-export-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch {
      // Client-side fallback: print dialog
      printToPDF(project, sections, user, isHt);
    }
  }, [project, sections, user, isHt, courseId]);

  return (
    <div className="pw-summary">
      <div className="pw-summary-header">
        <button className="pw-btn pw-btn--ghost" onClick={onBack}>
          <i className="fas fa-arrow-left" aria-hidden="true" />
          {isHt ? 'Retounen' : 'Back'}
        </button>
        <h3>{isHt ? 'Rezime Pwojè' : 'Project Summary'}</h3>
        <span className="pw-summary-pct">{project.completion_percentage}%</span>
      </div>

      {/* §26 — Export actions */}
      <div className="pw-summary-export">
        <button className="pw-btn pw-btn--secondary" onClick={handleExportJson}>
          <i className="fas fa-download" aria-hidden="true" />
          {isHt ? 'Ekspòte JSON' : 'Export JSON'}
        </button>
        <button className="pw-btn pw-btn--secondary" onClick={handleExportPdf}>
          <i className="fas fa-file-pdf" aria-hidden="true" />
          {isHt ? 'Ekspòte PDF' : 'Export PDF'}
        </button>
      </div>

      <div className="pw-summary-progress">
        <div className="pw-summary-bar">
          <div className="pw-summary-fill" style={{ width: `${project.completion_percentage}%` }} />
        </div>
        <p className="pw-summary-meta">
          {project.completed_sections?.length || 0} / {sections.filter((s) => s.is_required).length}{' '}
          {isHt ? 'sekasyon obligatwa fini' : 'required sections complete'}
        </p>
      </div>

      <div className="pw-summary-sections">
        {sections.map((section) => {
          const isCompleted = (project.completed_sections || []).includes(section.id);
          const filledFields = (section.fields || []).filter(
            (f) => f.value_text || f.value_number != null || f.value_date || f.value_json
          ).length;

          return (
            <div key={section.id} className={`pw-summary-section ${isCompleted ? 'is-completed' : ''}`}>
              <div className="pw-summary-section-header">
                <span className={`pw-summary-section-status ${isCompleted ? 'is-done' : ''}`}>
                  {isCompleted ? '✅' : '⬜'}
                </span>
                <h4>{section.title}</h4>
                <span className="pw-summary-section-count">
                  {filledFields}/{section.fields?.length || 0}
                </span>
              </div>

              <div className="pw-summary-fields">
                {(section.fields || []).map((field) => {
                  const hasData = field.value_text || field.value_number != null || field.value_date || field.value_json;
                  return (
                    <div key={field.id} className={`pw-summary-field ${hasData ? 'has-data' : 'empty'}`}>
                      <span className="pw-summary-field-label">{field.label}</span>
                      {hasData ? (
                        <p className="pw-summary-field-value">
                          {field.value_text || field.value_number || field.value_date || '—'}
                        </p>
                      ) : (
                        <p className="pw-summary-field-empty">
                          {isHt ? '(pa gen done)' : '(no data)'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
