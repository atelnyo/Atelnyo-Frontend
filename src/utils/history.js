/**
 * src/utils/history.js
 *
 * Reliable "can we go back?" detection for in-app back buttons.
 *
 * The naive `window.history.length > 1` check is wrong in a fresh tab:
 * a direct deep-link already has length 2 (blank entry + the link), so
 * navigate(-1) would dump the user on about:blank instead of falling
 * back to '/'. react-router v6 (BrowserRouter) keeps the current stack
 * index in history.state.idx — 0 on the initial in-app entry, incremented
 * on every navigation — so idx > 0 is the accurate "a previous page
 * exists" signal.
 */
export function canGoBack() {
  if (typeof window === 'undefined') return false;
  return (window.history.state?.idx ?? 0) > 0;
}

/**
 * Standard history-aware back: go back in history when a prior in-app
 * entry exists, otherwise fall back to a safe default route.
 */
export function historyBack(navigate, fallback = '/') {
  if (canGoBack()) return navigate(-1);
  return navigate(fallback);
}

/**
 * Navigate to the auth page while remembering where the user was, so
 * AuthRoute can send them back after a successful sign-in. Without the
 * ``from`` state, the auth route has no idea where the user came from
 * and dumps them on the Explore home instead of returning them to the
 * page/action that required login.
 *
 * Pass the current ``useLocation()`` result and the auth destination
 * (SHEETS.LOGIN / SHEETS.SIGNUP / SHEETS.AUTH).
 */
export function requireLogin(navigate, location, target) {
  const from = location?.pathname ? location.pathname + (location.search || '') : null;
  navigate(target, from ? { state: { from } } : undefined);
}
