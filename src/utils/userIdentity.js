export function getUserIdentity(user) {
  const username = typeof user?.username === 'string' ? user.username.trim() : '';
  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  const emailPrefix = email.includes('@') ? email.split('@', 1)[0] : '';
  // The display name: the platform's name for the user — the Google
  // display name for Google sign-ins (backend `display_name`), else
  // the username / email prefix. The @handle stays the username.
  const displayName = (typeof user?.display_name === 'string' && user.display_name.trim())
    ? user.display_name.trim()
    : (username || emailPrefix || 'user');

  return {
    username,
    email,
    emailPrefix,
    displayName,
    displayLabel: displayName,
    initial: (displayName || 'U').charAt(0).toUpperCase(),
    creatorLookupKey: username || emailPrefix || '',
  };
}
