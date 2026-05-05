/**
 * Scope auth storage per browser tab.
 *
 * This keeps existing code that reads/writes localStorage('token'/'user')
 * working, but transparently stores those keys in sessionStorage instead.
 * Result:
 * - Opening a new tab starts unauthenticated (must login again)
 * - Different tabs can login with different accounts on same device
 */
export function installScopedAuthStorage() {
  if (typeof window === 'undefined') return;
  if (window.__scopedAuthStorageInstalled) return;

  const local = window.localStorage;
  const session = window.sessionStorage;

  const AUTH_KEYS = new Set(['token', 'user']);

  const originalGetItem = local.getItem.bind(local);
  const originalSetItem = local.setItem.bind(local);
  const originalRemoveItem = local.removeItem.bind(local);

  // Clear old persistent auth so fresh tabs always start at login.
  AUTH_KEYS.forEach((key) => {
    try {
      originalRemoveItem(key);
    } catch {
      // Ignore storage errors in restricted environments.
    }
  });

  local.getItem = (key) => {
    if (AUTH_KEYS.has(key)) {
      return session.getItem(key);
    }
    return originalGetItem(key);
  };

  local.setItem = (key, value) => {
    if (AUTH_KEYS.has(key)) {
      session.setItem(key, value);
      return;
    }
    originalSetItem(key, value);
  };

  local.removeItem = (key) => {
    if (AUTH_KEYS.has(key)) {
      session.removeItem(key);
      return;
    }
    originalRemoveItem(key);
  };

  window.__scopedAuthStorageInstalled = true;
}
