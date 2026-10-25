// Only same-site, in-app paths are allowed as a post-login destination.
// Rejects absolute URLs, protocol-relative (//host) and backslash tricks,
// and auth pages themselves (avoids login loops).
export function safeNextPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null;
  }
  const route = value.split(/[?#]/)[0];
  if (/(^|\/)(login|signup)$/.test(route) || route.startsWith('/login') || route.startsWith('/signup') || route.startsWith('/sheet/auth')) {
    return null;
  }
  return value;
}
