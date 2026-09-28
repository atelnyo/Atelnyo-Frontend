/**
 * src/components/learning/workspace/SectionEditor.jsx
 *
 * §13 — When a student opens a section they should understand:
 *   - What is this section?
 *   - Why does it matter?
 *   - What should I write?
 *   - What learning material can help me?
 *   - Is this required?
 *   - Is my work saved?
 *
 * §14 — Guided project building: gradual construction.
 */
import React, { useCallback, useState } from 'react';
import FieldRenderer from './FieldRenderer';

export default function SectionEditor({
  section,
  onSave,
  onComplete,
  isHt,
  isSectionCompleted,
}) {
  const [completionAttempted, setCompletionAttempted] = useState(false);

  const handleComplete = useCallback(() => {
    setCompletionAttempted(true);
    onComplete?.(section.id);
  }, [section.id, onComplete]);

  // Count required fields and how many are filled
  const requiredFields = (section.fields || []).filter((f) => f.required_status === 'required');
  const filledRequired = requiredFields.filter((f) => {
    return f.value_text || f.value_number != null || f.value_date || f.value_json;
  }).length;
  const allRequiredFilled = filledRequired >= requiredFields.length;

  return (
    <div className="pw-section">
      {/* Section header */}
      <div className="pw-section-header">
        <h3 className="pw-section-title">{section.title}</h3>
        {section.description && (
          <p className="pw-section-desc">{section.description}</p>
        )}
        {section.guidance && (
          <div className="pw-section-guidance">
            <i className="fas fa-lightbulb" aria-hidden="true" />
            <span>{section.guidance}</span>
          </div>
        )}
        {/* §32 — Required/optional indicators */}
        {requiredFields.length > 0 && (
          <div className="pw-section-progress">
            <span className="pw-field-count">
              {filledRequired}/{requiredFields.length} {isHt ? 'chanp obligatwa ranpli' : 'required fields filled'}
            </span>
          </div>
        )}
      </div>

      {/* §8 — Related lessons */}
      {section.related_lessons?.length > 0 && (
        <div className="pw-section-lessons">
          <i className="fas fa-book-open" aria-hidden="true" />
          <span>
            {isHt
              ? 'Leson ki gen rapò: '
              : 'Related lessons: '}
            {section.related_lessons.join(', ')}
          </span>
        </div>
      )}

      {/* Fields */}
      <div className="pw-fields">
        {(section.fields || [])
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              onSave={(valueText, valueNumber, valueDate, valueJson) =>
                onSave(field.id, valueText, valueNumber, valueDate, valueJson)
              }
              isHt={isHt}
            />
          ))}
      </div>

      {/* §22 — Section completion */}
      {section.is_required && (
        <div className="pw-section-actions">
          {isSectionCompleted ? (
            <div className="pw-section-complete">
              <i className="fas fa-check-circle" aria-hidden="true" />
              {isHt ? ' Seksyon fini' : ' Section complete'}
            </div>
          ) : (
            <button
              className={`pw-btn ${allRequiredFilled ? 'pw-btn--primary' : 'pw-btn--secondary'}`}
              onClick={handleComplete}
              disabled={!allRequiredFilled}
              title={!allRequiredFilled
                ? (isHt ? 'Tanpri ranpli tout chanp obligatwa' : 'Please fill all required fields')
                : undefined}
            >
              <i className="fas fa-check" aria-hidden="true" />
              {isHt ? 'Mwen fini seksyon sa a' : 'Mark section complete'}
            </button>
          )}
          {completionAttempted && !allRequiredFilled && (
            <p className="pw-validation-msg">
              {isHt
                ? `Tanpri ranpli ${requiredFields.length - filledRequired} chanp obligatwa ki rete.`
                : `Please fill ${requiredFields.length - filledRequired} remaining required fields.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
