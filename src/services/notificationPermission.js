/**
 * Centralized browser notification permission helpers.
 *
 * Keep permission checks and requests in one place so the app does not
 * scatter `Notification.requestPermission()` calls across components.
 */

export function hasNotificationSupport() {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window;
}

export function getNotificationPermission() {
  if (!hasNotificationSupport()) return 'unsupported';
  return Notification.permission || 'default';
}

export async function requestNotificationPermission() {
  if (!hasNotificationSupport()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export async function ensureBrowserNotificationPermission({ request = true } = {}) {
  if (!hasNotificationSupport()) {
    return { granted: false, permission: 'unsupported' };
  }

  const permission = getNotificationPermission();
  if (permission === 'granted') {
    return { granted: true, permission };
  }

  if (!request) {
    return { granted: false, permission };
  }

  const nextPermission = await requestNotificationPermission();
  return {
    granted: nextPermission === 'granted',
    permission: nextPermission,
  };
}

export function describeNotificationPermission(permission) {
  switch (permission) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'default':
      return 'default';
    default:
      return 'unsupported';
  }
}
