/**
 * CertificateVerify — Public certificate verification page.
 *
 * Route: /verify?cert=ATY-XXXXX-XXXXX
 *
 * Employers, institutions, or anyone scanning a QR code can verify
 * a learner's course completion. No login required.
 */

import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

import api from '../services/api';

const en = {
  title: 'Certificate Verification',
  subtitle: 'Verify an Atelnyo course completion certificate',
  valid: '✅ Certificate Verified',
  invalid: '❌ Certificate Not Found',
  validDesc: 'This certificate is authentic and was issued by Atelnyo.',
  invalidDesc: 'No certificate with this number exists in our records.',
  course: 'Course',
  learner: 'Learner',
  issued: 'Issued',
  number: 'Certificate Number',
  notFound: 'Please enter a valid certificate number in the URL.',
  back: '← Back to Atelnyo',
  home: 'Go to Home',
};

const ht = {
  title: 'Verifikasyon Sètifika',
  subtitle: 'Verifye yon sètifika konplete kou Atelnyo',
  valid: '✅ Sètifika Verifye',
  invalid: '❌ Sètifika Pa Jwenn',
  validDesc: 'Sètifika sa a otantik e li te pibliye pa Atelnyo.',
  invalidDesc: 'Pa gen sètifika ak nimewo sa a nan rekòd nou.',
  course: 'Kou',
  learner: 'Elèv',
  issued: 'Pibliye',
  number: 'Nimewo Sètifika',
  notFound: 'Tanpri antre yon nimewo sètifika valid nan URL la.',
  back: '← Retounen nan Atelnyo',
  home: 'Ale nan Accueil',
};

export default function CertificateVerify() {
  const [searchParams] = useSearchParams();
  const certNumber = searchParams.get('cert');

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Detect language
  const isHt = typeof navigator !== 'undefined'
    && navigator.language?.startsWith('ht');
  const t = isHt ? ht : en;

  useEffect(() => {
    if (!certNumber) {
      setLoading(false);
      setError('notFound');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(
          `/api/certificates/verify/${encodeURIComponent(certNumber)}/`
        );
        if (!cancelled) {
          setResult(res.data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          const status = err?.response?.status;
          if (status === 404) {
            setResult({ valid: false });
          } else {
            setError('network');
          }
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [certNumber]);

  /* ── Styles ─────────────────────────────────────────── */

  const pageStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 9000,
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    overflow: 'auto',
  };

  const cardStyle = {
    background: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
    maxWidth: '560px',
    width: '100%',
    overflow: 'hidden',
  };

  const headerStyle = (isValid) => ({
    background: isValid
      ? 'linear-gradient(135deg, #10b981, #059669)'
      : 'linear-gradient(135deg, #ef4444, #dc2626)',
    padding: '32px 24px',
    textAlign: 'center',
    color: '#fff',
  });

  const iconStyle = {
    fontSize: '48px',
    marginBottom: '12px',
  };

  const headingStyle = {
    fontSize: '22px',
    fontWeight: 700,
    margin: 0,
  };

  const bodyStyle = {
    padding: '28px 24px',
  };

  const fieldRow = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 0',
    borderBottom: '1px solid #f1f5f9',
  };

  const fieldLabel = {
    fontSize: '13px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const fieldValue = {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1e293b',
    textAlign: 'right',
    maxWidth: '60%',
    wordBreak: 'break-word',
  };

  const certNumberStyle = {
    ...fieldValue,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: '14px',
    letterSpacing: '1px',
    color: '#0a2540',
  };

  const badgeStyle = {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const footerStyle = {
    padding: '16px 24px 24px',
    textAlign: 'center',
  };

  const linkStyle = {
    color: '#3b82f6',
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: '14px',
  };

  const loaderStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    color: '#64748b',
  };

  const spinnerStyle = {
    width: '40px',
    height: '40px',
    border: '4px solid #e2e8f0',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: '16px',
  };

  /* ── Page title ───────────────────────────────────── */
  useEffect(() => {
    document.title = 'Certificate Verification — Atelnyo';
  }, []);

  /* ── Loading ────────────────────────────────────────── */

  if (loading) {
    return (
      <div style={pageStyle}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={cardStyle}>
          <div style={loaderStyle}>
            <div style={spinnerStyle} />
            <p style={{ margin: 0, fontSize: '15px' }}>{t.subtitle}</p>
          </div>
        </div>
      </div>
    );
  }

  /* ── No cert number provided ────────────────────────── */

  if (error === 'notFound') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={headerStyle(false)}>
            <div style={iconStyle}>🔍</div>
            <h1 style={headingStyle}>{t.title}</h1>
          </div>
          <div style={{ ...bodyStyle, textAlign: 'center', padding: '40px 24px' }}>
            <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.6 }}>
              {t.notFound}
            </p>
          </div>
          <div style={footerStyle}>
            <Link to="/" style={linkStyle}>{t.home}</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Network error ──────────────────────────────────── */

  if (error === 'network') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={headerStyle(false)}>
            <div style={iconStyle}>⚠️</div>
            <h1 style={headingStyle}>Error</h1>
          </div>
          <div style={{ ...bodyStyle, textAlign: 'center', padding: '40px 24px' }}>
            <p style={{ color: '#64748b', fontSize: '15px', lineHeight: 1.6 }}>
              {isHt
                ? 'Erè rezo. Tanpri eseye ankò.'
                : 'Network error. Please try again.'}
            </p>
          </div>
          <div style={footerStyle}>
            <Link to="/" style={linkStyle}>{t.home}</Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Result ─────────────────────────────────────────── */

  const isValid = result?.valid === true;

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={headerStyle(isValid)}>
          <div style={iconStyle}>{isValid ? '🎓' : '❌'}</div>
          <h1 style={headingStyle}>{isValid ? t.valid : t.invalid}</h1>
          <p style={{
            margin: '8px 0 0',
            fontSize: '14px',
            opacity: 0.9,
          }}>
            {isValid ? t.validDesc : t.invalidDesc}
          </p>
        </div>

        {/* Body — only show details for valid certificates */}
        {isValid && (
          <div style={bodyStyle}>
            {/* Status badge */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <span style={{
                ...badgeStyle,
                background: '#ecfdf5',
                color: '#059669',
              }}>
                {isHt ? 'Sètifika Ofisyèl' : 'Official Certificate'}
              </span>
            </div>

            {/* Fields */}
            <div style={fieldRow}>
              <span style={fieldLabel}>{t.number}</span>
              <span style={certNumberStyle}>{result.certificate_number}</span>
            </div>
            <div style={fieldRow}>
              <span style={fieldLabel}>{t.learner}</span>
              <span style={fieldValue}>{result.learner_name}</span>
            </div>
            <div style={fieldRow}>
              <span style={fieldLabel}>{t.course}</span>
              <span style={fieldValue}>{result.course_title}</span>
            </div>
            <div style={{ ...fieldRow, borderBottom: 'none' }}>
              <span style={fieldLabel}>{t.issued}</span>
              <span style={fieldValue}>
                {new Date(result.issued_at).toLocaleDateString(
                  isHt ? 'ht-HT' : 'en-US',
                  { year: 'numeric', month: 'long', day: 'numeric' }
                )}
              </span>
            </div>
          </div>
        )}

        {/* Invalid state body */}
        {!isValid && (
          <div style={{ ...bodyStyle, textAlign: 'center', padding: '32px 24px' }}>
            <p style={{
              color: '#94a3b8',
              fontSize: '14px',
              lineHeight: 1.6,
              margin: 0,
            }}>
              {isHt
                ? 'Sètifika sa a pa egziste oswa nimewo a pa kòrèk.'
                : 'This certificate does not exist or the number is incorrect.'}
            </p>
          </div>
        )}

        {/* Footer */}
        <div style={footerStyle}>
          <Link to="/" style={linkStyle}>{t.back}</Link>
        </div>
      </div>
    </div>
  );
}
