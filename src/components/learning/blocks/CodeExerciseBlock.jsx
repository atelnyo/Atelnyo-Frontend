/**
 * src/components/learning/blocks/CodeExerciseBlock.jsx
 *
 * Interactive code exercise block for programming courses.
 * Uses Pyodide (Python in WebAssembly) for safe client-side execution.
 *
 * SECURITY: Python code runs in the browser, NOT on the server.
 * Pyodide provides a sandboxed Python runtime via WebAssembly.
 *
 * Features:
 *   - Split-pane editor + output
 *   - Run Python code in browser (Pyodide)
 *   - Starter code with editable editor
 *   - Expected output comparison (auto-grading)
 *   - Submission + scoring via backend API
 *   - Hints system
 *   - Error display with line numbers
 *   - Reset to starter code
 *   - Time tracking
 *   - Copy code button
 *
 * Block config:
 *   - instructions: string (what to do)
 *   - code: string (starter code)
 *   - language: string ('python' | 'javascript')
 *   - expected_output: string (for auto-grading, optional)
 *   - title: string (optional label)
 *   - hint: string (optional hint)
 *   - test_cases: array [{input, expected}] (for auto-grading)
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { blockSubmissionService } from '../../../services/api';

// ─── Pyodide loader (lazy) ────────────────────────────────────────────
let pyodideInstance = null;
let pyodideLoading = false;
let pyodidePromise = null;

async function loadPyodide() {
  if (pyodideInstance) return pyodideInstance;
  if (pyodidePromise) return pyodidePromise;

  pyodideLoading = true;
  pyodidePromise = (async () => {
    try {
      // Dynamically load Pyodide from CDN
      if (!window.loadPyodide) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js';
        script.async = true;
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      pyodideInstance = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/',
      });
      return pyodideInstance;
    } catch (err) {
      console.error('[CodeExercise] Failed to load Pyodide:', err);
      throw err;
    } finally {
      pyodideLoading = false;
    }
  })();

  return pyodidePromise;
}

// ─── Run Python code safely ───────────────────────────────────────────
async function runPython(code, stdin = '') {
  const pyodide = await loadPyodide();

  // Capture stdout/stderr
  let stdout = '';
  let stderr = '';

  pyodide.setStdout({ batched: (text) => { stdout += text; } });
  pyodide.setStderr({ batched: (text) => { stderr += text; } });

  // Handle input() calls by providing stdin
  if (stdin) {
    const lines = stdin.split('\n');
    let lineIdx = 0;
    pyodide.registerJsModule('input_override', {
      readline: () => lines[lineIdx++] || '',
    });
    // Override input() to use our lines
    pyodide.runPython(`
import builtins
_original_input = builtins.input
def _patched_input(prompt=''):
    from input_override import readline
    if prompt:
        print(prompt, end='')
    return readline()
builtins.input = _patched_input
`);
  }

  try {
    const result = await pyodide.runPythonAsync(code);
    return {
      success: true,
      output: stdout,
      error: stderr,
      result: result !== undefined ? String(result) : '',
    };
  } catch (err) {
    return {
      success: false,
      output: stdout,
      error: err.message || String(err),
      result: '',
    };
  }
}

// ─── CodeExerciseBlock Component ──────────────────────────────────────
export default function CodeExerciseBlock({
  block,
  lang = 'ht',
  index,
  courseId,
  moduleIndex,
  onComplete,
  onViewed,
}) {
  const isHt = lang === 'ht';

  // Parse block config
  const config = block.content || block.config || {};
  const instructions = config.instructions || '';
  const starterCode = config.code || config.starter_code || '# Write your code here\n';
  const language = config.language || 'python';
  const expectedOutput = config.expected_output || '';
  const title = config.title || block.title || '';
  const hint = config.hint || '';
  const testCases = config.test_cases || [];

  // State
  const [code, setCode] = useState(starterCode);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(false);
  const [pyodideLoading, setPyodideLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [submittedOutput, setSubmittedOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [startTime] = useState(Date.now());
  const editorRef = useRef(null);

  // Preload Pyodide
  useEffect(() => {
    loadPyodide()
      .then(() => setPyodideReady(true))
      .catch(() => {});
  }, []);

  // ─── Run code ───────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (isRunning || language !== 'python') return;
    setIsRunning(true);
    setOutput('');
    setError('');

    try {
      const result = await runPython(code);
      setOutput(result.output + (result.result ? `\n>>> ${result.result}` : ''));
      setError(result.error || '');
      onViewed?.(moduleIndex, block.id, 'code_exercise');
    } catch (err) {
      setError(err.message || 'Failed to run code');
    } finally {
      setIsRunning(false);
    }
  }, [code, isRunning, language, moduleIndex, block.id, onViewed]);

  // ─── Submit for grading ─────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (submitted || isRunning) return;
    setSubmitted(true);

    try {
      // Run code to get output
      const result = await runPython(code);
      const userOutput = (result.output + (result.result ? `\n${result.result}` : '')).trim();
      setSubmittedOutput(userOutput);

      // Grade against expected output or test cases
      let calculatedScore = 0;
      if (testCases.length > 0) {
        let passed = 0;
        for (const tc of testCases) {
          try {
            const tcResult = await runPython(code, tc.input || '');
            const tcOutput = (tcResult.output + (tcResult.result ? `\n${tcResult.result}` : '')).trim();
            if (tcOutput === (tc.expected || '').trim()) passed++;
          } catch { /* skip */ }
        }
        calculatedScore = Math.round((passed / testCases.length) * 100);
      } else if (expectedOutput) {
        calculatedScore = userOutput === expectedOutput.trim() ? 100 : 0;
      } else {
        // No expected output — give credit for running without errors
        calculatedScore = result.success ? 80 : 0;
      }

      setScore(calculatedScore);

      // Submit to backend
      if (courseId) {
        try {
          await blockSubmissionService.create({
            course: courseId,
            module_index: moduleIndex,
            block_id: block.id,
            block_type: 'code_exercise',
            content: { code, output: userOutput, score: calculatedScore },
            status: calculatedScore >= 70 ? 'approved' : 'pending',
            score: calculatedScore,
          });
        } catch { /* best effort */ }
      }

      if (calculatedScore >= 70) {
        onComplete?.(moduleIndex, block.id, 'code_exercise');
      }
    } catch (err) {
      setError(err.message || 'Submission failed');
    }
  }, [code, submitted, isRunning, testCases, expectedOutput, courseId, moduleIndex, block.id, onComplete]);

  // ─── Reset code ─────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setCode(starterCode);
    setOutput('');
    setError('');
    setSubmitted(false);
    setScore(null);
  }, [starterCode]);

  // ─── Copy code ──────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  }, [code]);

  return (
    <div className="code-exercise-block" style={{ border: '1px solid var(--border-subtle)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      {title && (
        <div style={{ padding: '10px 14px', background: 'var(--surface-2, rgba(148,163,184,0.06))', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-terminal" style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{title}</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{language}</span>
        </div>
      )}

      {/* Instructions */}
      {instructions && (
        <div style={{ padding: '10px 14px', fontSize: '0.85rem', lineHeight: 1.5, borderBottom: '1px solid var(--border-subtle)' }}>
          {instructions}
        </div>
      )}

      {/* Editor + Output split */}
      <div style={{ display: 'flex', flexDirection: 'row', minHeight: 200 }}>
        {/* Editor pane */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-subtle)' }}>
          <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600 }}>Editor</span>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={handleCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: copied ? '#10b981' : 'var(--text-secondary)' }}>
              <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <textarea
            ref={editorRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{
              flex: 1,
              padding: 12,
              border: 'none',
              background: '#1e1e2e',
              color: '#cdd6f4',
              fontFamily: "'Fira Code', 'Consolas', monospace",
              fontSize: '0.85rem',
              lineHeight: 1.6,
              resize: 'none',
              outline: 'none',
              tabSize: 4,
            }}
            spellCheck={false}
            aria-label={isHt ? 'Editè kòd' : 'Code editor'}
          />
        </div>

        {/* Output pane */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <span style={{ fontWeight: 600 }}>{isHt ? 'Sòti' : 'Output'}</span>
            {pyodideLoading && <span style={{ color: '#f59e0b' }}>Loading Python...</span>}
          </div>
          <div style={{
            flex: 1,
            padding: 12,
            background: '#0d1117',
            color: '#8b949e',
            fontFamily: "'Fira Code', 'Consolas', monospace",
            fontSize: '0.82rem',
            lineHeight: 1.6,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
          }}>
            {output && <div style={{ color: '#cdd6f4' }}>{output}</div>}
            {error && <div style={{ color: '#f85149', marginTop: output ? 8 : 0 }}>{error}</div>}
            {!output && !error && !isRunning && (
              <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                {isHt ? 'Klike "Ekzekye" pou wè sòti a.' : 'Click "Run" to see output.'}
              </div>
            )}
            {isRunning && (
              <div style={{ color: '#f59e0b' }}>
                <i className="fas fa-spinner fa-spin" /> {isHt ? 'Ap ekzekye...' : 'Running...'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleRun}
          disabled={isRunning || !pyodideReady}
          aria-label={isRunning ? (isHt ? 'Ap ekzekye...' : 'Running...') : (isHt ? 'Ekzekye kòd la' : 'Run code')}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: 'none',
            background: isRunning ? '#666' : '#10b981',
            color: '#fff',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontSize: '0.82rem',
            fontWeight: 600,
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <i className={`fas ${isRunning ? 'fa-spinner fa-spin' : 'fa-play'}`} />
          {isHt ? 'Ekzekye' : 'Run'}
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={isRunning}
          aria-label={isHt ? 'Reyinisyalize kòd la' : 'Reset code'}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontFamily: 'inherit',
          }}
        >
          <i className="fas fa-undo" /> {isHt ? 'Reyinisyalize' : 'Reset'}
        </button>

        {!submitted ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isRunning}
            aria-label={isHt ? 'Soumèt kòd la pou nòt' : 'Submit code for grading'}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: '#3b82f6',
              color: '#fff',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontSize: '0.82rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginLeft: 'auto',
            }}
          >
            <i className="fas fa-paper-plane" /> {isHt ? 'Soumèt' : 'Submit'}
          </button>
        ) : (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '4px 10px',
              borderRadius: 6,
              background: score >= 70 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: score >= 70 ? '#10b981' : '#ef4444',
              fontWeight: 600,
              fontSize: '0.82rem',
            }}>
              {score >= 70 ? '✅' : '❌'} {score}%
            </span>
          </div>
        )}

        {hint && (
          <button
            type="button"
            onClick={() => setShowHint(!showHint)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px dashed #f59e0b',
              background: 'transparent',
              color: '#f59e0b',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontFamily: 'inherit',
            }}
          >
            <i className="fas fa-lightbulb" /> {isHt ? 'Indis' : 'Hint'}
          </button>
        )}
      </div>

      {/* Hint */}
      {showHint && hint && (
        <div style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(245,158,11,0.06)',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}>
          💡 {hint}
        </div>
      )}

      {/* Submission results */}
      {submitted && (
        <div style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border-subtle)',
          background: score >= 70 ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
          fontSize: '0.82rem',
        }}>
          {score >= 70
            ? (isHt ? '🎉 Brav! Ou pase egzèsis sa a!' : '🎉 Great! You passed this exercise!')
            : (isHt ? '⚠️ Eseye ankò — revize kòd ou a epi tcheke sòti a.' : '⚠️ Try again — review your code and check the output.')}
        </div>
      )}
    </div>
  );
}
