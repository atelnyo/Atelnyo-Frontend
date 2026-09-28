/**
 * CompletionRulesEditor — §40 Creator Progress Configuration
 *
 * Allows creators to configure completion rules for a course/module.
 *
 * §40 — "Creators should eventually configure completion rules through
 * controlled options. Do not expose raw backend rules."
 *
 * §41 — "The Creator Studio must validate configuration before publishing."
 */
import React, { useCallback } from 'react';

const RULE_TYPES = [
  { value: 'all_required_blocks', label: { en: 'All Required Activities', ht: 'Tout Aktivite Obligatwa' }, description: { en: 'Student must complete all required blocks', ht: 'Elèv dwe konplete tout blòk obligatwa' } },
  { value: 'assessment_passed', label: { en: 'Assessment Passed', ht: 'Evalyasyon Pase' }, description: { en: 'Specific assessment must be passed', ht: 'Evalyasyon espesifik dwe pase' } },
  { value: 'min_score', label: { en: 'Minimum Score', ht: 'Minimòm Nòt' }, description: { en: 'Average score must meet threshold', ht: 'Nòt mwayèn dwe rive nan limit la' } },
  { value: 'submission_saved', label: { en: 'Submission Saved', ht: 'Soumisyon Sove' }, description: { en: 'Required submission must be saved', ht: 'Soumisyon obligatwa dwe sove' } },
];

/**
 * CompletionRulesEditor
 *
 * @param {Object} props
 * @param {Array} props.rules - current completion rules
 * @param {Function} props.onChange - (rules) => void
 * @param {string} [props.lang='ht']
 * @param {Array} [props.blocks] - available blocks (for assessment selection)
 */
export default function CompletionRulesEditor({
  rules = [],
  onChange,
  lang = 'ht',
  blocks = [],
}) {
  const isHt = lang === 'ht';

  const handleAddRule = useCallback(() => {
    onChange([...rules, { type: 'all_required_blocks' }]);
  }, [rules, onChange]);

  const handleRemoveRule = useCallback((index) => {
    onChange(rules.filter((_, i) => i !== index));
  }, [rules, onChange]);

  const handleUpdateRule = useCallback((index, updates) => {
    const newRules = rules.map((r, i) => (i === index ? { ...r, ...updates } : r));
    onChange(newRules);
  }, [rules, onChange]);

  // Get assessment blocks for selection
  const assessmentBlocks = blocks.filter((b) =>
    ['quiz', 'multiple_choice', 'multiple_answer', 'true_false', 'assignment'].includes(b.type)
  );

  return (
    <div className="ls-completion-rules-editor">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: '0.9rem' }}>
          {isHt ? '📋 Règ Konpleksyon' : '📋 Completion Rules'}
        </h4>
        <button type="button" className="ls-btn" onClick={handleAddRule} style={{ fontSize: '0.8rem', padding: '4px 10px' }}>
          + {isHt ? 'Ajoute' : 'Add'}
        </button>
      </div>

      {rules.length === 0 && (
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '8px 0' }}>
          {isHt
            ? 'Pa gen règ espesifik. Tout blòk obligatwa pral konte.'
            : 'No specific rules. All required blocks will count.'}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rules.map((rule, i) => {
          const ruleConfig = RULE_TYPES.find((r) => r.value === rule.type);
          return (
            <div key={i} style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-color, #e5e7eb)',
              background: 'var(--surface-card, #fff)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <select
                  value={rule.type}
                  onChange={(e) => handleUpdateRule(i, { type: e.target.value })}
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 6,
                    border: '1px solid var(--border-color, #e5e7eb)',
                    fontSize: '0.85rem', fontFamily: 'inherit',
                  }}
                >
                  {RULE_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>{rt.label[lang] || rt.label.en}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleRemoveRule(i)}
                  style={{
                    padding: '4px 8px', border: 'none', background: 'none',
                    color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem',
                  }}
                  aria-label={isHt ? 'Efase règ' : 'Remove rule'}
                >
                  ✕
                </button>
              </div>

              {/* Rule-specific config */}
              {rule.type === 'assessment_passed' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={rule.assessmentId || ''}
                    onChange={(e) => handleUpdateRule(i, { assessmentId: e.target.value })}
                    style={{
                      flex: 1, padding: '6px 8px', borderRadius: 6,
                      border: '1px solid var(--border-color, #e5e7eb)',
                      fontSize: '0.82rem', fontFamily: 'inherit',
                    }}
                  >
                    <option value="">{isHt ? 'Chwazi evalyasyon...' : 'Select assessment...'}</option>
                    {assessmentBlocks.map((b) => (
                      <option key={b.id} value={b.id}>{b.title || b.type}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round((rule.threshold || 0.6) * 100)}
                    onChange={(e) => handleUpdateRule(i, { threshold: Number(e.target.value) / 100 })}
                    style={{
                      width: 60, padding: '6px 8px', borderRadius: 6,
                      border: '1px solid var(--border-color, #e5e7eb)',
                      fontSize: '0.82rem', textAlign: 'center',
                    }}
                    aria-label={isHt ? 'Limit pase (%)' : 'Pass threshold (%)'}
                  />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>%</span>
                </div>
              )}

              {rule.type === 'min_score' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    {isHt ? 'Nòt mwayèn minimòm:' : 'Min average score:'}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round((rule.threshold || 0.6) * 100)}
                    onChange={(e) => handleUpdateRule(i, { threshold: Number(e.target.value) / 100 })}
                    style={{
                      width: 60, padding: '6px 8px', borderRadius: 6,
                      border: '1px solid var(--border-color, #e5e7eb)',
                      fontSize: '0.82rem', textAlign: 'center',
                    }}
                  />
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>%</span>
                </div>
              )}

              {rule.type === 'submission_saved' && (
                <select
                  value={rule.blockId || ''}
                  onChange={(e) => handleUpdateRule(i, { blockId: e.target.value })}
                  style={{
                    width: '100%', padding: '6px 8px', borderRadius: 6,
                    border: '1px solid var(--border-color, #e5e7eb)',
                    fontSize: '0.82rem', fontFamily: 'inherit',
                  }}
                >
                  <option value="">{isHt ? 'Chwazi blòk...' : 'Select block...'}</option>
                  {blocks.filter((b) => ['exercise', 'assignment', 'project'].includes(b.type)).map((b) => (
                    <option key={b.id} value={b.id}>{b.title || b.type}</option>
                  ))}
                </select>
              )}

              {/* Description */}
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {ruleConfig?.description?.[lang] || ruleConfig?.description?.en || ''}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
