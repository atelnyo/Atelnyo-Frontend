/**
 * src/components/learning/workspace/ProjectSidebar.jsx
 *
 * §12 — Project sidebar with sections, completion indicators,
 * current section, required work. Adapts to mobile.
 */
import React from 'react';

export default function ProjectSidebar({
  sections,
  completedSections,
  activeSectionId,
  onSelect,
  isHt,
  percentage,
}) {
  return (
    <nav className="pw-sidebar-nav" aria-label={isHt ? 'Seksyon Pwojè' : 'Project Sections'}>
      <div className="pw-sidebar-header">
        <h3 className="pw-sidebar-title">{isHt ? 'Seksyon yo' : 'Sections'}</h3>
        <div className="pw-sidebar-progress">
          <div className="pw-sidebar-progress-bar">
            <div className="pw-sidebar-progress-fill" style={{ width: `${percentage}%` }} />
          </div>
          <span className="pw-sidebar-pct">{percentage}%</span>
        </div>
      </div>

      <ul className="pw-sidebar-list" role="list">
        {sections.map((section, index) => {
          const isCompleted = completedSections.includes(section.id);
          const isActive = section.id === activeSectionId;
          const filledFields = (section.fields || []).filter(
            (f) => f.value_text || f.value_number != null || f.value_date || f.value_json
          ).length;
          const totalFields = (section.fields || []).length;

          return (
            <li key={section.id}>
              <button
                className={`pw-sidebar-item ${isActive ? 'is-active' : ''} ${isCompleted ? 'is-completed' : ''}`}
                onClick={() => onSelect(section.id)}
                aria-current={isActive ? 'step' : undefined}
              >
                <span className="pw-sidebar-item-status">
                  {isCompleted ? (
                    <i className="fas fa-check-circle" aria-hidden="true" />
                  ) : section.is_required ? (
                    <i className="fas fa-circle" aria-hidden="true" />
                  ) : (
                    <i className="far fa-circle" aria-hidden="true" />
                  )}
                </span>
                <span className="pw-sidebar-item-content">
                  <span className="pw-sidebar-item-title">{section.title}</span>
                  <span className="pw-sidebar-item-meta">
                    {filledFields}/{totalFields}
                    {section.is_required && !isCompleted && (
                      <span className="pw-sidebar-item-required">{isHt ? ' *' : ' *'}</span>
                    )}
                  </span>
                </span>
                <span className="pw-sidebar-item-number">{index + 1}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
