/**
 * TrueFalseBlock — §17 True or False
 *
 * Wraps QuestionBase with binary True/False options.
 *
 * Block data:
 *   - question: string
 *   - description: string (optional)
 *   - correct: boolean (true = statement is true)
 *   - explanation: string (optional)
 *   - required: boolean
 */
import React from 'react';
import QuestionBase from './QuestionBase';

export default function TrueFalseBlock({ block, lang = 'ht', reportComplete }) {
  const content = block.content || block;
  const isTrueCorrect = content.correct === true;

  const options = [
    { id: 'true', text: lang === 'ht' ? 'Vrè' : 'True' },
    { id: 'false', text: lang === 'ht' ? 'Fo' : 'False' },
  ];

  return (
    <QuestionBase
      question={content.question || content.title || ''}
      description={content.description}
      options={options}
      correctIds={[isTrueCorrect ? 'true' : 'false']}
      multiple={false}
      feedback={{
        correct: lang === 'ht' ? 'Egzakteman!' : 'Exactly!',
        incorrect: lang === 'ht' ? 'Sa pa vre. Sonje byen.' : 'Not true. Think carefully.',
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
