/**
 * src/accessibility/hooks/useAnnounce.js
 *
 * React hook wrapping the centralized announcer.
 *
 * Usage:
 *   const { announce, announcePolite, announceAssertive } = useAnnounce();
 *   announcePolite('Changes saved');
 *   announceAssertive('Error: could not save');
 */
import { useCallback } from 'react';
import { announce as rawAnnounce } from '../utils/announcer';
import { LIVE_MODE } from '../utils/constants';

export default function useAnnounce() {
  const announcePolite = useCallback((message) => {
    rawAnnounce(message, LIVE_MODE.POLITE);
  }, []);

  const announceAssertive = useCallback((message) => {
    rawAnnounce(message, LIVE_MODE.ASSERTIVE);
  }, []);

  return {
    announce: rawAnnounce,
    announcePolite,
    announceAssertive,
  };
}
