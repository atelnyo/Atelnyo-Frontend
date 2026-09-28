/**
 * src/components/profile/ProfileCardImage.jsx
 *
 * Catalog/pick card image with a real fallback — when the src is empty
 * OR the image fails to load, it renders an icon fallback instead of a
 * broken-image icon or a blank hole (the old `display:none` trick left
 * an empty gap on every card with a dead URL).
 *
 * Used by the Creator Public Profile cards only (Explore keeps its own
 * SVG fallbacks). Props:
 *   - src          — image URL (empty → fallback)
 *   - alt          — alt text
 *   - icon         — FontAwesome icon for the default fallback tile
 *   - fallback     — optional custom fallback JSX (e.g. a pick-card
 *                    initial letter) rendered inside the fallback tile
 *   - imgClassName — class for the <img> (default .csp-catalog-card-img)
 *   - tileClassName— class for the fallback tile
 */
import React, { useState } from 'react';

export default function ProfileCardImage({
  src,
  alt = '',
  icon = 'fa-image',
  fallback = null,
  imgClassName = 'csp-catalog-card-img',
  tileClassName = 'csp-catalog-card-img-fallback',
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={tileClassName}>
        {fallback ?? <i className={`fas ${icon}`} aria-hidden="true" />}
      </div>
    );
  }
  return (
    <img
      className={imgClassName}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
