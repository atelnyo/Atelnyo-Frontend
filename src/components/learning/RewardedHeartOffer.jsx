import React, { useEffect, useState } from 'react';
import { rewardedAdService } from '../../services/api';

function messageFor(reason, isHt) {
  if (reason === 'daily_limit') {
    return isHt
      ? 'Ou rive nan limit 3 reklam pou jodi a. Tann kè yo rejenerasyon.'
      : 'You reached today’s limit of 3 ads. Wait for hearts to regenerate.';
  }
  if (reason === 'no_ads') {
    return isHt ? 'Pa gen videyo pwomosyon disponib kounye a.' : 'No promotional videos are available right now.';
  }
  return '';
}

export default function RewardedHeartOffer({ lang = 'ht', hearts, heartsUnlimited, onGamification }) {
  const isHt = lang === 'ht';
  const empty = !heartsUnlimited && Number(hearts) === 0;
  const [offer, setOffer] = useState(null);
  const [watch, setWatch] = useState(null);
  const [checking, setChecking] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!empty) return undefined;
    let active = true;
    rewardedAdService.next()
      .then((res) => { if (active) setOffer(res?.data || null); })
      .catch(() => {
        if (active) setError(isHt ? 'Pa t kapab chaje videyo a. Eseye ankò.' : 'Could not load a video. Please try again.');
      })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [empty, isHt]);

  const start = async () => {
    if (!offer?.promotion || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await rewardedAdService.start(offer.promotion.id);
      setWatch({ ...res.data, busy: false });
    } catch (e) {
      const reason = e?.response?.data?.detail;
      setError(reason === 'daily_limit_reached'
        ? messageFor('daily_limit', isHt)
        : (isHt ? 'Pa t kapab kòmanse videyo a. Eseye ankò.' : 'Could not start the video. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!watch || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await rewardedAdService.complete(watch.watch_id);
      const data = res?.data || {};
      if (data.gamification) onGamification?.(data.gamification);
      setWatch(null);
      setMessage(data.awarded
        ? (isHt ? 'Ou jwenn 1 kè!' : 'You earned 1 heart!')
        : (isHt ? 'Kè a te deja ajoute.' : 'The heart was already added.'));
    } catch (e) {
      const reason = e?.response?.data?.detail;
      setError(reason === 'ad_not_watched'
        ? (isHt ? 'Gade videyo a nèt anvan ou reklame kè a.' : 'Watch the full video before claiming the heart.')
        : (isHt ? 'Pa t kapab valide videyo a. Eseye ankò.' : 'Could not verify the video. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (!empty) return null;

  return (
    <div className="gami-rewarded-ad">
      {offer?.available ? (
        <button type="button" className="gami-refill-btn" onClick={start} disabled={busy || checking}>
          <i className={`fas ${busy ? 'fa-spinner fa-spin' : 'fa-circle-play'}`} aria-hidden="true" />
          {isHt ? 'Gade videyo a pou 1 kè' : 'Watch video for 1 heart'}
        </button>
      ) : (
        <span className="gami-rewarded-ad-info" role="status">
          {checking
            ? (isHt ? 'Ap chèche videyo…' : 'Checking for a video…')
            : messageFor(offer?.reason, isHt)}
        </span>
      )}
      {message && <span className="gami-rewarded-ad-success" role="status">{message}</span>}
      {error && <span className="gami-hearts-error" role="alert">{error}</span>}
      {watch && (
        <div className="gami-ad-backdrop">
          <section className="gami-ad-dialog" role="dialog" aria-modal="true" aria-labelledby="gami-ad-title">
            <h3 id="gami-ad-title">{watch.promotion.title}</h3>
            <p>{isHt ? 'Gade videyo a nèt pou jwenn 1 kè.' : 'Watch the full video to earn 1 heart.'}</p>
            <video
              src={watch.promotion.video_url}
              autoPlay
              playsInline
              controls
              preload="auto"
              onEnded={complete}
              onError={() => setError(isHt ? 'Videyo a pa t kapab jwe.' : 'The video could not be played.')}
            />
            {watch.promotion.destination_url && (
              <a href={watch.promotion.destination_url} target="_blank" rel="noreferrer">
                {isHt ? 'Aprann plis' : 'Learn more'}
              </a>
            )}
            {error && <p role="alert" className="gami-hearts-error">{error}</p>}
            <button type="button" className="gami-ad-close" onClick={() => setWatch(null)} disabled={busy}>
              {isHt ? 'Fèmen' : 'Close'}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
