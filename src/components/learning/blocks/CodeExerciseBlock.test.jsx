/**
 * CodeExerciseBlock — JavaScript/Canvas exercises must run in the browser
 * without Pyodide, and learners must never be stuck when a runtime fails.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CodeExerciseBlock, { buildWebDoc } from './CodeExerciseBlock';

const jsBlock = {
  id: 'ce-1',
  type: 'code_exercise',
  title: 'Desen yon wonn',
  content: {
    language: 'javascript',
    code: "console.log('Canvas 480x320');",
    expected_output: 'Canvas 480x320',
    instructions: 'Trase yon wonn.',
  },
};

describe('buildWebDoc', () => {
  it('includes a canvas, the learner code and the run token', () => {
    const doc = buildWebDoc("console.log('sali')", 'javascript', 'tok-1');

    expect(doc).toContain('<canvas id="demo"');
    expect(doc).toContain("console.log('sali')");
    expect(doc).toContain('tok-1');
    expect(doc).toContain("source: 'atelnyo-preview'");
  });

  it('renders raw HTML exercises without injecting a canvas', () => {
    const doc = buildWebDoc('<h1>Sali</h1>', 'html', 'tok-2');

    expect(doc).toContain('<h1>Sali</h1>');
    expect(doc).not.toContain('<canvas id="demo"');
  });
});

describe('CodeExerciseBlock (javascript)', () => {
  it('shows a sandboxed preview instead of loading Python', async () => {
    const { container } = render(
      <CodeExerciseBlock block={jsBlock} courseId={null} moduleIndex={4} />,
    );

    await waitFor(() => {
      expect(container.querySelector('iframe')).toBeTruthy();
    });
    const frame = container.querySelector('iframe');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('srcdoc')).toContain('<canvas id="demo"');
    expect(screen.getByText('Editor')).toBeTruthy();
  });
});
