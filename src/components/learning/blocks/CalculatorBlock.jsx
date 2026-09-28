/**
 * CalculatorBlock — Interactive calculator for pricing, budget, profit.
 * Student fills in fields and sees calculated results.
 */
import React, { useState, useEffect } from 'react';

export default function CalculatorBlock({ block, lang = 'ht', onComplete, onPortfolioSave }) {
  const isHt = lang === 'ht';
  const fields = block?.fields || [];
  const formula = block?.formula || '';
  const [values, setValues] = useState({});

  // Load draft
  useEffect(() => {
    try {
      const key = `calc_draft_${block?.id}`;
      const saved = localStorage.getItem(key);
      if (saved) setValues(JSON.parse(saved));
    } catch (e) {}
  }, [block?.id]);

  const handleChange = (key, val) => {
    const newValues = { ...values, [key]: parseFloat(val) || 0 };
    setValues(newValues);
    try {
      localStorage.setItem(`calc_draft_${block?.id}`, JSON.stringify(newValues));
    } catch (e) {}
  };

  // Calculate result based on formula
  const calculateResult = () => {
    try {
      let expr = formula;
      for (const [k, v] of Object.entries(values)) {
        expr = expr.replace(new RegExp(`\\b${k}\\b`, 'g'), v);
      }
      return Function(`"use strict"; return (${expr})`)();
    } catch (e) {
      return '—';
    }
  };

  const result = formula ? calculateResult() : null;

  const handleSave = () => {
    if (onComplete) onComplete({ values, result });
    if (onPortfolioSave && block?.portfolioSection) {
      onPortfolioSave(block.portfolioSection, { text: JSON.stringify(values), result });
    }
  };

  return (
    <div className="calculator-block" style={{
      background: '#e3f2fd',
      border: '2px solid #2196f3',
      borderRadius: '12px',
      padding: '24px',
      margin: '16px 0',
    }}>
      <h3 style={{ margin: '0 0 12px', color: '#1565c0' }}>
        🧮 {block?.title || (isHt ? 'Kalkilatè' : 'Calculator')}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {fields.map((f, i) => (
          <div key={i}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px', color: '#333' }}>
              {f.label}
            </label>
            <input
              type="number"
              value={values[f.key] ?? ''}
              onChange={(e) => handleChange(f.key, e.target.value)}
              placeholder={f.placeholder || '0'}
              style={{
                width: '100%', padding: '10px', border: '1px solid #90caf9',
                borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box',
              }}
            />
          </div>
        ))}
      </div>
      {result !== null && (
        <div style={{
          background: '#fff', border: '2px solid #1976d2', borderRadius: '8px',
          padding: '16px', textAlign: 'center', marginBottom: '16px',
        }}>
          <div style={{ fontSize: '14px', color: '#666' }}>{isHt ? 'Rezilta:' : 'Result:'}</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#1565c0' }}>
            ${typeof result === 'number' ? result.toLocaleString(undefined, { maximumFractionDigits: 2 }) : result}
          </div>
        </div>
      )}
      <button onClick={handleSave} style={{
        padding: '10px 24px', background: '#2196f3', color: '#fff',
        border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600',
      }}>
        💾 {isHt ? 'Sove Kalkilasyon' : 'Save Calculation'}
      </button>
    </div>
  );
}
