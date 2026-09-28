/**
 * src/accessibility/utils/announcer.js
 *
 * Centralized screen reader announcement system using live regions.
 *
 * Architecture:
 *   - A singleton DOM container with two live regions (polite + assertive)
 *   - Messages are set via textContent, which triggers the screen reader
 *   - Debouncing prevents rapid-fire announcements from flooding
 *   - The announcer is created lazily on first use
 *
 * Usage:
 *   import { announce } from '../accessibility/utils/announcer';
 *
 *   announce('Changes saved');                     // polite
 *   announce('Error: could not save', 'assertive'); // assertive
 */
import { LIVE_MODE } from './constants';

let _container = null;

const DEBOUNCE_MS = 300;
let _politeTimer = null;
let _assertiveTimer = null;

/**
 * Lazily create or get the live region container.
 * Appended to document.body on first use.
 */
function getContainer() {
  if (_container && document.body.contains(_container)) {
    return _container;
  }

  _container = document.createElement('div');
  _container.setAttribute('aria-hidden', 'true');
  _container.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';

  const polite = document.createElement('div');
  polite.id = 'a11y-live-polite';
  polite.setAttribute('role', 'status');
  polite.setAttribute('aria-live', LIVE_MODE.POLITE);
  polite.setAttribute('aria-atomic', 'true');

  const assertive = document.createElement('div');
  assertive.id = 'a11y-live-assertive';
  assertive.setAttribute('role', 'alert');
  assertive.setAttribute('aria-live', LIVE_MODE.ASSERTIVE);
  assertive.setAttribute('aria-atomic', 'true');

  _container.appendChild(polite);
  _container.appendChild(assertive);
  document.body.appendChild(_container);

  return _container;
}

/**
 * Announce a message to screen readers.
 *
 * @param {string} message - The message to announce
 * @param {'polite' | 'assertive'} mode - Announcement priority
 * @param {object} options - { debounce: boolean }
 */
export function announce(message, mode = LIVE_MODE.POLITE, options = {}) {
  const container = getContainer();
  const regionId = mode === LIVE_MODE.ASSERTIVE ? 'a11y-live-assertive' : 'a11y-live-polite';
  const region = container.querySelector(`#${regionId}`);
  if (!region) return;

  const { debounce = true } = options;

  // Clear existing timer for this mode
  const timerKey = mode === LIVE_MODE.ASSERTIVE ? '_assertiveTimer' : '_politeTimer';
  if (debounce && timerKey) {
    clearTimeout(window[timerKey]);
  }

  const doAnnounce = () => {
    // Clear first, then set — this ensures the screen reader picks up
    // a repeated message (e.g., two consecutive "Saved" announcements).
    region.textContent = '';
    requestAnimationFrame(() => {
      region.textContent = message;
    });
  };

  if (debounce) {
    window[timerKey] = setTimeout(doAnnounce, DEBOUNCE_MS);
  } else {
    doAnnounce();
  }
}

/**
 * Clear all live region announcements.
 */
export function clearAnnouncements() {
  if (!_container) return;
  const polite = _container.querySelector('#a11y-live-polite');
  const assertive = _container.querySelector('#a11y-live-assertive');
  if (polite) polite.textContent = '';
  if (assertive) assertive.textContent = '';
}

/**
 * Clean up the live region container (for testing or teardown).
 */
export function destroyAnnouncer() {
  if (_container && _container.parentNode) {
    _container.parentNode.removeChild(_container);
  }
  _container = null;
}
