/**
 * ScenarioBlock — §21 Interactive business scenario with branching.
 *
 * Supports two modes:
 *   - Linear: single situation → choose → feedback (legacy)
 *   - Branching: situation → choose → consequence → next scenario
 *
 * §21 — "The Scenario Block should eventually support branching.
 * Do not hard-code scenarios as a linear quiz."
 *
 * Block data (branching mode):
 *   - scenarioId: current scenario ID
 *   - scenarios: { [id]: { situation, options: [{ text, nextScenarioId, consequence }] } }
 *   - startScenario: ID of first scenario
 */
import React, { useCallback, useMemo, useState } from 'react';

export default function ScenarioBlock({ block, lang = 'ht', onComplete }) {
  const isHt = lang === 'ht';
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [scenarioPath, setScenarioPath] = useState([]); // history of scenario IDs visited

  // Check if this is a branching scenario
  const scenarios = block?.scenarios || {};
  const startId = block?.startScenario || block?.startId || 'start';
  const isBranching = Object.keys(scenarios).length > 0;

  // Current scenario (branching mode) or linear mode
  const currentScenarioId = isBranching
    ? (scenarioPath.length > 0 ? scenarioPath[scenarioPath.length - 1] : startId)
    : null;
  const currentScenario = isBranching ? scenarios[currentScenarioId] : null;

  // Linear mode data
  const situation = isBranching ? (currentScenario?.situation || '') : (block?.situation || block?.content || '');
  const options = isBranching ? (currentScenario?.options || []) : (block?.options || []);
  const correct = isBranching ? -1 : (block?.correct ?? -1);
  const explanation = isBranching ? '' : (block?.explanation || '');

  const handleSubmit = useCallback(() => {
    if (selected === null) return;
    setSubmitted(true);

    if (isBranching && currentScenario) {
      // §21 — Branching: navigate to next scenario or complete
      const chosen = options[selected];
      const consequence = chosen?.consequence || '';
      const nextId = chosen?.nextScenarioId;

      if (nextId && scenarios[nextId]) {
        // Show consequence briefly, then navigate
        setTimeout(() => {
          setScenarioPath((prev) => [...prev, nextId]);
          setSelected(null);
          setSubmitted(false);
        }, 2000);
      } else {
        // End of branch — complete
        onComplete?.({
          path: [...scenarioPath, currentScenarioId],
          choice: selected,
          consequence,
          completed: true,
        });
      }
    } else {
      // Linear mode
      onComplete?.({ selected, isCorrect: selected === correct });
    }
  }, [selected, isBranching, currentScenario, options, scenarios, scenarioPath, currentScenarioId, correct, onComplete]);

  const isCorrect = !isBranching && selected === correct;
  const consequence = isBranching && submitted && options[selected]?.consequence;

  return (
    <div className="scenario-block" style={{
      background: '#fff8e1',
      border: '2px solid #ff9800',
      borderRadius: '12px',
      padding: '24px',
      margin: '16px 0',
    }}>
      <h3 style={{ margin: '0 0 12px', color: '#e65100' }}>
        🎭 {block?.title || (isHt ? 'Senaryo' : 'Scenario')}
      </h3>
      {situation && (
        <div style={{
          background: '#fff',
          border: '1px solid #ffe0b2',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px',
          lineHeight: '1.6',
        }}>
          {situation}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {options.map((opt, i) => {
          const text = typeof opt === 'string' ? opt : opt.text || opt.label;
          const isSelected = selected === i;
          const showCorrect = submitted && i === correct;
          const showWrong = submitted && isSelected && i !== correct;
          return (
            <label key={i} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px', borderRadius: '8px', cursor: 'pointer',
              border: `2px solid ${showCorrect ? '#4caf50' : showWrong ? '#f44336' : isSelected ? '#ff9800' : '#e0e0e0'}`,
              background: showCorrect ? '#e8f5e9' : showWrong ? '#ffebee' : isSelected ? '#fff3e0' : '#fff',
              transition: 'all 0.2s',
            }}>
              <input type="radio" name={`scenario-${block?.id}`} checked={isSelected}
                onChange={() => !submitted && setSelected(i)}
                disabled={submitted} style={{ accentColor: '#ff9800' }} />
              <span>{text}</span>
              {showCorrect && <span style={{ marginLeft: 'auto' }}>✅</span>}
              {showWrong && <span style={{ marginLeft: 'auto' }}>❌</span>}
            </label>
          );
        })}
      </div>
      {submitted && isBranching && consequence && (
        <div style={{
          background: '#fff3e0',
          border: '1px solid #ff9800',
          borderRadius: '8px', padding: '12px', marginBottom: '16px',
        }}>
          <strong>💡 {isHt ? 'Konsekan:' : 'Consequence:'}</strong> {consequence}
        </div>
      )}
      {submitted && !isBranching && explanation && (
        <div style={{
          background: isCorrect ? '#e8f5e9' : '#ffebee',
          border: `1px solid ${isCorrect ? '#4caf50' : '#f44336'}`,
          borderRadius: '8px', padding: '12px', marginBottom: '16px',
        }}>
          <strong>{isCorrect ? '✅ Bon repons!' : '❌ Pa egzakteman.'}</strong> {explanation}
        </div>
      )}
      {!submitted && (
        <button onClick={handleSubmit} disabled={selected === null} style={{
          padding: '10px 24px', background: selected === null ? '#aaa' : '#ff9800',
          color: '#fff', border: 'none', borderRadius: '8px', cursor: selected === null ? 'not-allowed' : 'pointer',
          fontWeight: '600',
        }}>
          📤 {isHt ? 'Voye' : 'Submit'}
        </button>
      )}
    </div>
  );
}
