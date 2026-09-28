/**
 * AISuggestion — Sijesyon entelijan lè yon URL medya pa mache.
 *
 * Analize erè a epi bay:
 *   - Rezon pwoblèm nan
 *   - Etap pou rezoud li
 *   - Link vers dokimantasyon
 *   - Sijesyon pou eseye yon lòt provider
 */
import React from 'react';

const SUGGESTIONS = {
  403: {
    icon: 'fa-lock',
    titleEn: 'Access Denied',
    titleHt: 'Aksè Refize',
    suggestions: [
      { en: 'Make sure the file is set to "Public" in your provider settings.', ht: 'Asire fichye a mete an "Public" nan anviwònman provider ou.' },
      { en: 'Check if the URL requires authentication or a special header.', ht: 'Tcheke si URL la mande otantifikasyon oswa yon header espesyal.' },
      { en: 'Try uploading the file again and get a fresh public URL.', ht: 'Eseye mete fichye a ankò epi jwenn yon nouvo URL piblik.' },
    ],
  },
  404: {
    icon: 'fa-search',
    titleEn: 'File Not Found',
    titleHt: 'Fichye Pa Jwenn',
    suggestions: [
      { en: 'The file may have been deleted from the provider. Re-upload it.', ht: 'Fichye a ka te efase sou provider la. Mete l ankò.' },
      { en: 'Check if the URL is correct. A single typo can break the link.', ht: 'Tcheke si URL la kòrèk. Yon sèl erè ka kraze lyen an.' },
      { en: 'If the file expired, upload again to get a new URL.', ht: 'Si fichye a ekspire, mete l ankò pou jwenn yon nouvo URL.' },
    ],
  },
  timeout: {
    icon: 'fa-hourglass-end',
    titleEn: 'Connection Timeout',
    titleHt: 'Tan Ekspire',
    suggestions: [
      { en: 'The provider server is slow or unreachable. Try again later.', ht: 'Sèvè provider a lan oswa pa aksesib. Eseye ankò pita.' },
      { en: 'Check the provider\'s status page to see if there is an outage.', ht: 'Tcheke paj estati provider a pou wè si gen yon pàn.' },
      { en: 'Try a different provider that is more reliable.', ht: 'Eseye yon lòt provider ki pi fiable.' },
    ],
  },
  https: {
    icon: 'fa-shield-alt',
    titleEn: 'HTTPS Required',
    titleHt: 'HTTPS Obligatwa',
    suggestions: [
      { en: 'Replace "http://" with "https://" in the URL.', ht: 'Ranplase "http://" ak "https://" nan URL la.' },
      { en: 'Most providers support HTTPS. Check if your provider offers it.', ht: 'Pifò providers sipòte HTTPS. Tcheke si provider ou ofri li.' },
    ],
  },
  unsupported: {
    icon: 'fa-file-alt',
    titleEn: 'Unsupported Format',
    titleHt: 'Fòma Pa Sipòte',
    suggestions: [
      { en: 'Convert the file to a supported format: JPEG, PNG, MP4, MP3, PDF.', ht: 'Konvèti fichye a nan yon fòma sipòte: JPEG, PNG, MP4, MP3, PDF.' },
      { en: 'Make sure the URL points directly to the file, not a webpage.', ht: 'Asire URL la montre dirèkteman sou fichye a, pa yon paj entènèt.' },
    ],
  },
  generic: {
    icon: 'fa-exclamation-triangle',
    titleEn: 'URL Not Working',
    titleHt: 'URL Pa Ap Mache',
    suggestions: [
      { en: 'Check your internet connection and try again.', ht: 'Tcheke koneksyon entènèt ou epi eseye ankò.' },
      { en: 'Verify the file is still present on your provider.', ht: 'Verifye fichye a toujou prezan sou provider ou.' },
      { en: 'Try using a different provider like ImgBB (images) or YouTube (videos).', ht: 'Eseye yon lòt provider tankou ImgBB (imaj) oswa YouTube (videyo).' },
    ],
  },
};

export default function AISuggestion({ error, statusCode, errorMessage, provider, onRetry, lang = 'ht', className = '' }) {
  const isHt = lang === 'ht';

  if (!error && !statusCode && !errorMessage) return null;

  let config;
  if (statusCode === 403 || statusCode === 401) config = SUGGESTIONS[403];
  else if (statusCode === 404) config = SUGGESTIONS[404];
  else if (errorMessage && errorMessage.toLowerCase().includes('timeout')) config = SUGGESTIONS.timeout;
  else if (errorMessage && (errorMessage.toLowerCase().includes('https') || statusCode === 400 && errorMessage.toLowerCase().includes('https'))) config = SUGGESTIONS.https;
  else if (errorMessage && errorMessage.toLowerCase().includes('unsupported')) config = SUGGESTIONS.unsupported;
  else config = SUGGESTIONS.generic;

  return (
    <div className={`ai-suggestion ${className}`} role="alert">
      <div className="ai-suggestion-header">
        <div className="ai-suggestion-icon">
          <i className={`fas ${config.icon}`} />
        </div>
        <div className="ai-suggestion-title-area">
          <span className="ai-suggestion-title">
            <i className="fas fa-robot" />
            AI {isHt ? 'Asistan' : 'Assistant'}
          </span>
          <h4 className="ai-suggestion-heading">
            {isHt ? config.titleHt : config.titleEn}
          </h4>
        </div>
      </div>

      <div className="ai-suggestion-body">
        <ul className="ai-suggestion-list">
          {config.suggestions.map((s, i) => (
            <li key={i} className="ai-suggestion-item">
              <i className="fas fa-lightbulb" />
              <span>{isHt ? s.ht : s.en}</span>
            </li>
          ))}
        </ul>

        {provider && (
          <div className="ai-suggestion-provider">
            <i className="fas fa-cloud" />
            {isHt ? 'Provider detekte' : 'Detected provider'}: <strong>{provider}</strong>
          </div>
        )}

        {errorMessage && (
          <div className="ai-suggestion-error">
            <i className="fas fa-bug" />
            {isHt ? 'Detay erè' : 'Error details'}: <code>{errorMessage}</code>
          </div>
        )}
      </div>

      {onRetry && (
        <div className="ai-suggestion-footer">
          <button type="button" className="btn-primary" onClick={onRetry}>
            <i className="fas fa-redo" />
            {isHt ? 'Eseye ankò' : 'Try again'}
          </button>
        </div>
      )}
    </div>
  );
}
