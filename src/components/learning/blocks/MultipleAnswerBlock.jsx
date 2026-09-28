/**
 * MultipleAnswerBlock — §16 Multiple Answer (multiple correct answers)
 *
 * Wraps QuestionBase with multi-select configuration.
 *
 * Block data:
 *   - question: string
 *   - description: string (optional)
 *   - options: [{ id, text }]
 *   - correct: number[] (indices of correct options)
 *   - explanation: string (optional)
 *   - required: boolean
 */
import React from 'react';
import QuestionBase from './QuestionBase';

export default function MultipleAnswerBlock({ block, lang = 'ht', reportComplete }) {
  const content = block.content || block;
  const options = (content.options || []).map((opt, i) => ({
    id: String(i),
    text: typeof opt === 'string' ? opt : opt.text || opt.label || `Option ${i + 1}`,
  }));
  const correctIndices = Array.isArray(content.correct) ? content.correct : [];

  return (
    <div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8, fontStyle: 'italic' }}>
        {lang === 'ht' ? '⚠️ Chwazi TOUT repons ki korek.' : '⚠️ Select ALL correct answers.'}
      </div>
      <QuestionBase
        question={content.question || content.title || ''}
        description={content.description}
        options={options}
        correctIds={correctIndices.map(String)}
        multiple={true}
        feedback={{
          correct: lang === 'ht' ? 'Bravo! Tout repons yo korek.' : 'Well done! All correct answers selected.',
          incorrect: lang === 'ht' ? 'Pa egzakteman. Sonje: chwazi tout repons ki korek.' : 'Not quite. Remember: select all correct answers.',
          explanation: content.explanation,
        }}
        required={content.required !== false}
        completionRule="correct"
        onComplete={(result) => {
          if (result.correct || !content.required) {
            reportComplete?.();
          }
        }}
        lang={lang}
      />
    </div>
  );
}
