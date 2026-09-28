/**
 * Atelnyo PWA ↔ Android Companion Bridge Service
 * Facilitates token synchronization, settings integration, and custom native triggers.
 */

class AndroidBridgeService {
  constructor() {
    this.bridge = typeof window !== 'undefined' ? window.AtelnyoAndroidBridge : null;
  }

  /**
   * Check if PWA is currently running inside the native Android App WebView.
   */
  isAndroid() {
    return !!this.bridge;
  }

  /**
   * Get auth tokens from native Android DataStore storage.
   * Returns: { access_token, refresh_token, user_json }
   */
  getAuthTokens() {
    if (!this.isAndroid()) return null;
    try {
      const dataStr = this.bridge.getAuthTokens();
      if (!dataStr) return null;
      return JSON.parse(dataStr);
    } catch (e) {
      console.error('[AndroidBridge] Error fetching tokens:', e);
      return null;
    }
  }

  /**
   * Send active PWA auth tokens to the native Android app.
   */
  setAuthTokens(access, refresh, userJson = null) {
    if (!this.isAndroid()) return;
    try {
      const userStr = typeof userJson === 'object' ? JSON.stringify(userJson) : userJson || '{}';
      this.bridge.setAuthTokens(access, refresh, userStr, '', '');
    } catch (e) {
      console.error('[AndroidBridge] Error setting tokens:', e);
    }
  }

  /**
   * Get active language from Android preferences.
   */
  getLanguage() {
    if (!this.isAndroid()) return 'ht';
    try {
      return this.bridge.getLanguage() || 'ht';
    } catch (e) {
      console.error('[AndroidBridge] Error getting language:', e);
      return 'ht';
    }
  }

  /**
   * Show a native toast message.
   */
  showToast(message) {
    if (!this.isAndroid()) {
      console.log('[Toast Output]:', message);
      return;
    }
    try {
      this.bridge.showToast(message);
    } catch (e) {
      console.error('[AndroidBridge] Error showing toast:', e);
    }
  }

  /**
   * Post generic actions/messages to the native host container.
   */
  postMessage(action, payload = null) {
    if (!this.isAndroid()) return;
    try {
      const payloadStr = typeof payload === 'object' ? JSON.stringify(payload) : payload;
      this.bridge.postMessageToNative(action, payloadStr);
    } catch (e) {
      console.error('[AndroidBridge] Error posting message:', e);
    }
  }

  /**
   * Synchronizes state from Android App to PWA localStorage on load.
   */
  syncFromNative() {
    if (!this.isAndroid()) return;
    
    const tokens = this.getAuthTokens();
    if (tokens) {
      const { access_token, refresh_token, user_json } = tokens;
      
      // Update local storage in PWA if they differ or exist
      if (access_token && localStorage.getItem('access_token') !== access_token) {
        localStorage.setItem('access_token', access_token);
      }
      if (refresh_token && localStorage.getItem('refresh_token') !== refresh_token) {
        localStorage.setItem('refresh_token', refresh_token);
      }
      if (user_json && Object.keys(user_json).length > 0) {
        localStorage.setItem('user', JSON.stringify(user_json));
      }
      
      console.log('[AndroidBridge] Tokens successfully synchronized from native');
    }
  }
}

export const androidBridge = new AndroidBridgeService();
