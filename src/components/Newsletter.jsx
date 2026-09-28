/**
 * src/components/Newsletter.jsx
 *
 * Newsletter email-capture section for the Explore page.
 *
 * Backed by POST /api/newsletter/subscribe/ (anonymous, no auth required).
 * Renders a compact inline form with email input + CTA button.
 * Handles loading, success, error, and already-subscribed states.
 *
 * Phase 52 — diaspora growth engine: every sign-up goes into the
 * NewsletterSubscriber table so the operator can export the list
 * and send launch announcements / course drops / community invites.
 */
import React, { useState } from 'react';
import api from '../services/api';

const Newsletter = ({ lang, t }) => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error | already
  const [errorMsg, setErrorMsg] = useState('');

  const translations = {
    ht: {
      title: 'Rete Konekte',
      subtitle: 'Resevwa nouvo kou, mizik, ak evènman nan bwat resepsyon ou.',
      placeholder: 'Imèl ou...',
      cta: 'Enskri Gratis',
      success: '✅ Enskripsyon reyisi! N ap voye dènye enfòmasyon yo ba ou.',
      already: 'Imèl sa a deja enskri.',
      error: 'Yon erè fèt. Eseye ankò.',
    },
    en: {
      title: 'Stay Connected',
      subtitle: 'Get new courses, music, and events delivered to your inbox.',
      placeholder: 'Your email...',
      cta: 'Subscribe Free',
      success: '✅ Subscribed! We\'ll send you the latest updates.',
      already: 'This email is already subscribed.',
      error: 'Something went wrong. Try again.',
    },
    fr: {
      title: 'Restez Connecté',
      subtitle: 'Recevez les nouveaux cours, musiques et événements dans votre boîte mail.',
      placeholder: 'Votre email...',
      cta: 'S\'inscrire Gratuit',
      success: '✅ Inscription réussie ! Nous vous enverrons les dernières mises à jour.',
      already: 'Cet email est déjà inscrit.',
      error: 'Une erreur est survenue. Réessayez.',
    },
    es: {
      title: 'Mantente Conectado',
      subtitle: 'Recibe nuevos cursos, música y eventos directamente en tu bandeja.',
      placeholder: 'Tu email...',
      cta: 'Suscríbete Gratis',
      success: '✅ ¡Suscripción exitosa! Te enviaremos las últimas novedades.',
      already: 'Este email ya está suscrito.',
      error: 'Algo salió mal. Inténtalo de nuevo.',
    },
  };

  const t2 = translations[lang] || translations.ht;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setErrorMsg(t2.error);
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await api.post('/newsletter/subscribe/', {
        email: trimmed,
        lang: lang || 'ht',
        source: 'explore_page',
      });

      if (res.data?.created === false && res.data?.ok) {
        setStatus('already');
      } else if (res.data?.ok) {
        setStatus('success');
        setEmail('');
      } else {
        setErrorMsg(res.data?.error || t2.error);
        setStatus('error');
      }
    } catch (err) {
      // If the API returned a 400, try to extract the error
      if (err?.response?.status === 400 && err?.response?.data?.error) {
        setErrorMsg(err.response.data.error);
      } else {
        setErrorMsg(t2.error);
      }
      setStatus('error');
    }
  };

  return (
    <div className="newsletter-section" data-testid="newsletter-section">
      <div className="newsletter-container">
        <div className="newsletter-icon" aria-hidden="true">
          <i className="fas fa-paper-plane" />
        </div>
        <h3 className="newsletter-title">{t2.title}</h3>
        <p className="newsletter-subtitle">{t2.subtitle}</p>

        {status === 'success' ? (
          <div className="newsletter-success" role="status">
            <i className="fas fa-check-circle" aria-hidden="true" />
            <span>{t2.success}</span>
          </div>
        ) : status === 'already' ? (
          <div className="newsletter-success" role="status">
            <i className="fas fa-check-circle" aria-hidden="true" />
            <span>{t2.already}</span>
          </div>
        ) : (
          <form className="newsletter-form" onSubmit={handleSubmit}>
            <div className="newsletter-input-group">
              <input
                type="email"
                className="newsletter-input"
                placeholder={t2.placeholder}
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (status === 'error') setStatus('idle'); }}
                disabled={status === 'loading'}
                aria-label={t2.placeholder}
                required
              />
              <button
                type="submit"
                className="newsletter-btn"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? (
                  <i className="fas fa-spinner fa-spin" aria-hidden="true" />
                ) : (
                  <>
                    <i className="fas fa-paper-plane" aria-hidden="true" />
                    <span>{t2.cta}</span>
                  </>
                )}
              </button>
            </div>
            {status === 'error' && (
              <p className="newsletter-error" role="alert">
                <i className="fas fa-exclamation-circle" aria-hidden="true" /> {errorMsg}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default Newsletter;
