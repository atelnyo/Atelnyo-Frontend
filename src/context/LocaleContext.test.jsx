/**
 * src/context/LocaleContext.test.jsx — unit tests for the AtelyonaContext
 * provider. Verifies the source-of-truth priority from the spec (§30 —
 * Detection ≠ Routing):
 *
 *   1. Explicit URL intent    — /fr-HT/… → language=fr, country=HT
 *   2. User preference        — atelnyo_lang + atelnyo_market (props)
 *   3. Detection              — detected country (last resort)
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LocaleProvider, { useLocaleContext } from './LocaleContext';

function Probe() {
  const ctx = useLocaleContext();
  return (
    <div data-testid="ctx">
      {JSON.stringify({
        language: ctx.language,
        country: ctx.country,
        market: ctx.market,
        tag: ctx.tag,
        isLocalized: ctx.isLocalized,
        source: ctx.source,
      })}
    </div>
  );
}

describe('LocaleProvider — URL intent wins', () => {
  it('parses /fr-HT/explore → fr + HT, isLocalized, source=url', () => {
    render(
      <LocaleProvider
        pathname="/fr-HT/explore"
        userLanguage="ht"
        userMarket="HT"
        detected={{ country: 'US', confidence: 0.9 }}
      >
        <Probe />
      </LocaleProvider>,
    );
    const el = screen.getByTestId('ctx');
    expect(el).toHaveTextContent('"language":"fr"');
    expect(el).toHaveTextContent('"country":"HT"');
    expect(el).toHaveTextContent('"market":"HT"');
    expect(el).toHaveTextContent('"isLocalized":true');
    expect(el).toHaveTextContent('"source":"url"');
  });

  it('keeps language ≠ country (fr + HT is a valid distinct context)', () => {
    render(<LocaleProvider pathname="/fr-HT/"><Probe /></LocaleProvider>);
    const el = screen.getByTestId('ctx');
    expect(el).toHaveTextContent('"language":"fr"');
    expect(el).toHaveTextContent('"country":"HT"');
    expect(el).toHaveTextContent('"tag":"fr-HT"');
  });
});

describe('LocaleProvider — user preference beats detection on bare paths', () => {
  it('uses stored language + market over the detected country', () => {
    render(
      <LocaleProvider
        pathname="/explore"
        userLanguage="en"
        userMarket="CA"
        detected={{ country: 'HT', confidence: 0.95 }}
      >
        <Probe />
      </LocaleProvider>,
    );
    const el = screen.getByTestId('ctx');
    expect(el).toHaveTextContent('"language":"en"');
    expect(el).toHaveTextContent('"country":"CA"');
    expect(el).toHaveTextContent('"isLocalized":false');
    expect(el).toHaveTextContent('"source":"user"');
  });

  it('falls back to defaults when nothing is set (provider sees no signals → detection source)', () => {
    render(<LocaleProvider pathname="/"><Probe /></LocaleProvider>);
    const el = screen.getByTestId('ctx');
    expect(el).toHaveTextContent('"language":"ht"');
    expect(el).toHaveTextContent('"country":"HT"');
    expect(el).toHaveTextContent('"source":"detection"');
  });
});

describe('LocaleProvider — detection is the last resort', () => {
  it('uses the detected country when there is no URL or user preference', () => {
    render(
      <LocaleProvider pathname="/" detected={{ country: 'DO', confidence: 0.8 }}>
        <Probe />
      </LocaleProvider>,
    );
    const el = screen.getByTestId('ctx');
    expect(el).toHaveTextContent('"country":"DO"');
    expect(el).toHaveTextContent('"source":"detection"');
  });
});

describe('useLocaleContext — safe fallback outside a provider', () => {
  it('returns defaults instead of throwing', () => {
    render(<Probe />);
    const el = screen.getByTestId('ctx');
    expect(el).toHaveTextContent('"language":"ht"');
    expect(el).toHaveTextContent('"isLocalized":false');
  });
});
