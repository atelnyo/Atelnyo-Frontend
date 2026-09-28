/**
 * MultipleChoiceBlock — §15 Multiple Choice (single correct answer)
 *
 * Wraps QuestionBase with single-select configuration.
 *
 * Block data:
 *   - question: string
 *   - description: string (optional)
 *   - options: [{ id, text }]
 *   - correct: number (index of correct option)
 *   - explanation: string (optional)
 *   - required: boolean
 */
import React from 'react';
import QuestionBase from './QuestionBase';

export default function MultipleChoiceBlock({ block, lang = 'ht', reportComplete }) {
  const content = block.content || block;
  const options = (content.options || []).map((opt, i) => ({
    id: String(i),
    text: typeof opt === 'string' ? opt : opt.text || opt.label || `Option ${i + 1}`,
  }));
  const correctIndex = content.correct ?? 0;

  return (
    <QuestionBase
      question={content.question || content.title || ''}
      description={content.description}
      options={options}
      correctIds={[String(correctIndex)]}
      multiple={false}
      feedback={{
        correct: lang === 'ht' ? 'Repons ou korek!' : 'Correct!',
        incorrect: lang === 'ht' ? 'Pa egzakteman.' : 'Not quite.',
        explanation: content.explanation,
      }}
      required={content.required !== false}
      onComplete={(result) => {
        if (result.correct || !content.required) {
          reportComplete?.();
        }
      }}
      lang={lang}
    />
  );
}
