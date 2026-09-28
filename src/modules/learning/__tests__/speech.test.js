/**
 * src/modules/learning/__tests__/speech.test.js
 *
 * Unit tests for the real speech analysis — the word-by-word comparison
 * that tells a learner WHICH words they said well / almost / missed,
 * instead of a flat pass-fail.
 */
import { describe, it, expect } from 'vitest';
import {
  analyzeSpeech,
  exactMatch,
  levenshtein,
  normalizeSpeechText,
  wordSimilarity,
  tokenizeSpeech,
} from '../speech';

describe('normalizeSpeechText', () => {
  it('lowercases, strips punctuation and collapses whitespace', () => {
    expect(normalizeSpeechText('  Bonjou, kouman   ou ye? ')).toBe('bonjou kouman ou ye');
  });
});

describe('tokenizeSpeech', () => {
  it('splits a transcript into normalized words', () => {
    expect(tokenizeSpeech('Bonjou tout moun!')).toEqual(['bonjou', 'tout', 'moun']);
  });
  it('returns [] for empty input', () => {
    expect(tokenizeSpeech('')).toEqual([]);
    expect(tokenizeSpeech('   ')).toEqual([]);
  });
});

describe('levenshtein / wordSimilarity', () => {
  it('returns 0 distance for identical words, similarity 1', () => {
    expect(levenshtein('bonjou', 'bonjou')).toBe(0);
    expect(wordSimilarity('bonjou', 'bonjou')).toBe(1);
  });
  it('spots a pronunciation slip as a NEAR miss', () => {
    // "bonjou" vs "bonzou": one substitution in 6 chars → sim 5/6 ≈ 0.83
    expect(wordSimilarity('bonjou', 'bonzou')).toBeGreaterThan(0.7);
    expect(wordSimilarity('bonjou', 'bonzou')).toBeLessThan(1);
  });
  it('returns low similarity for unrelated words', () => {
    expect(wordSimilarity('bonjou', 'mache')).toBeLessThan(0.5);
  });
});

describe('exactMatch (kept for typing fallbacks)', () => {
  it('matches on normalized equality only', () => {
    expect(exactMatch('Bonjou!', 'bonjou').matched).toBe(true);
    expect(exactMatch('Bonjou', 'bonzou').matched).toBe(false);
  });
});

describe('analyzeSpeech — word-level error detection', () => {
  it('full match → score 1, passed, all words matched', () => {
    const a = analyzeSpeech('Bonjou, kouman ou ye?', 'bonjou kouman ou ye');
    expect(a.totalWords).toBe(4);
    expect(a.score).toBe(1);
    expect(a.passed).toBe(true);
    expect(a.matchedWords).toEqual(['bonjou', 'kouman', 'ou', 'ye']);
    expect(a.missingWords).toEqual([]);
    expect(a.nearMisses).toEqual([]);
    expect(a.extraWords).toEqual([]);
  });

  it('one wrong word of four → not passed, error pinpointed', () => {
    const a = analyzeSpeech('bonjou kouman ou ye', 'bonjou kouman ou mache');
    expect(a.score).toBeCloseTo(0.75);
    expect(a.passed).toBe(true); // 3 of 4 words well → pass with feedback
    expect(a.matchedWords).toEqual(['bonjou', 'kouman', 'ou']);
    expect(a.missingWords).toEqual(['ye']);
  });

  it('half the words wrong → failed', () => {
    const a = analyzeSpeech('mwen renmen kafe frèt', 'mwen vle dlo tyèd');
    expect(a.passed).toBe(false);
    expect(a.matchedWords).toEqual(['mwen']);
    expect(a.missingWords.length).toBe(3);
  });

  it('pronunciation slip is a near miss, not a flat wrong', () => {
    const a = analyzeSpeech('bonjou mwen rele Jean', 'bonzou mwen rele Jean');
    expect(a.passed).toBe(true); // 3 exact + 1 near (×0.5) = 0.875
    expect(a.nearMisses).toHaveLength(1);
    expect(a.nearMisses[0].target).toBe('bonjou');
    expect(a.nearMisses[0].said).toBe('bonzou');
    expect(a.missingWords).toEqual([]);
  });

  it('extra filler words are shown but never fail the learner', () => {
    const a = analyzeSpeech('bonjou', 'bonjou wi');
    expect(a.passed).toBe(true);
    expect(a.matchedWords).toEqual(['bonjou']);
    expect(a.extraWords).toEqual(['wi']);
  });

  it('missing words from a partially correct sentence are listed', () => {
    const a = analyzeSpeech('sa k ap fèt', 'sa fèt');
    // "sa" + "fèt" exact, "k" + "ap" missing → 2/4 = 0.5 → fail
    expect(a.passed).toBe(false);
    expect(a.matchedWords).toEqual(['sa', 'fèt']);
    expect(a.missingWords).toEqual(['k', 'ap']);
  });

  it('empty or null target never passes', () => {
    const a = analyzeSpeech('', 'bonjou');
    expect(a.passed).toBe(false);
    expect(a.score).toBe(0);
    expect(a.extraWords).toEqual(['bonjou']);
  });

  it('does not mutate inputs', () => {
    const target = 'bonjou mwen rele Jean';
    const transcript = 'bonjou mwen rele jan';
    analyzeSpeech(target, transcript);
    expect(target).toBe('bonjou mwen rele Jean');
    expect(transcript).toBe('bonjou mwen rele jan');
  });
});
