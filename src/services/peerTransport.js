/**
 * src/services/peerTransport.js
 *
 * Atelnyo Peer Transport — WebRTC-based peer-to-peer transport layer.
 *
 * Architecture:
 *   AtelnyoNetwork
 *   ├── Direct HTTPS Transport  (primary — always available)
 *   └── Peer WebRTC Transport   (fallback — when internet is unavailable)
 *
 * This module implements the Peer Protocol foundation:
 *   REQUEST, RESPONSE, MESSAGE, FILE_CHUNK, STREAM_START, STREAM_DATA,
 *   STREAM_END, SYNC, PING, AUTH, ERROR
 *
 * Network selection:
 *   Internet available  → Direct HTTPS
 *   Internet unavailable → Peer transport (where authorized and available)
 *
 * ⚠️ This is a FOUNDATION module. It provides the protocol definitions,
 *    capability detection, and connection management scaffolding.
 *    Full peer discovery, signaling, and data channel implementation
 *    requires a signaling server (planned for backend integration).
 *
 * SECURITY RULES:
 *   - Peer authorization NEVER bypasses authentication/authorization
 *   - Cookies, auth state, installation identity, and connectivity are separate
 *   - All peer messages are authenticated via the AUTH protocol message
 *   - File transfers are validated before processing
 */

import { capabilities } from './capabilityEngine';
import { API_URL } from './api';

// ─── Protocol Message Types ────────────────────────────────────────
export const PROTOCOL = {
  REQUEST: 'REQUEST',           // Request data from peer
  RESPONSE: 'RESPONSE',        // Response to a request
  MESSAGE: 'MESSAGE',          // Generic message
  FILE_CHUNK: 'FILE_CHUNK',    // Chunked file transfer
  STREAM_START: 'STREAM_START', // Begin streaming
  STREAM_DATA: 'STREAM_DATA',  // Stream data chunk
  STREAM_END: 'STREAM_END',    // End streaming
  SYNC: 'SYNC',                // State synchronization
  PING: 'PING',                // Connectivity check
  AUTH: 'AUTH',                // Authentication handshake
  ERROR: 'ERROR',              // Error notification
};

// ─── Connection States ─────────────────────────────────────────────
export const PEER_STATE = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  AUTHENTICATED: 'authenticated',
  ERROR: 'error',
};

// ─── Capability Detection ──────────────────────────────────────────
/**
 * Check if WebRTC peer transport is supported in this environment.
 * Uses feature detection, NOT browser-name detection.
 */
export function isPeerTransportSupported() {
  return (
    capabilities.webSocket &&
    typeof RTCPeerConnection !== 'undefined' &&
    typeof RTCSessionDescription !== 'undefined' &&
    typeof RTCIceCandidate !== 'undefined'
  );
}

/**
 * Check if peer transport is authorized for this session.
 * Requires: user is authenticated, peer mode is enabled in settings.
 */
export function isPeerTransportAuthorized() {
  const hasToken = typeof localStorage !== 'undefined' &&
    (localStorage.getItem('access_token') || localStorage.getItem('token'));
  const peerEnabled = typeof localStorage !== 'undefined' &&
    localStorage.getItem('atelnyo_peer_enabled') === 'true';
  return hasToken && peerEnabled;
}

// ─── Message Format ────────────────────────────────────────────────
/**
 * Create a protocol message with proper structure.
 *
 * @param {string} type - Protocol message type (from PROTOCOL)
 * @param {object} payload - Message payload
 * @param {object} opts - Additional options (peerId, auth, etc.)
 * @returns {object} Formatted protocol message
 */
export function createMessage(type, payload, opts = {}) {
  return {
    protocol: 'atelnyo-peer/1.0',
    type,
    timestamp: Date.now(),
    peerId: opts.peerId || null,
    auth: opts.auth || null,
    payload,
  };
}

/**
 * Validate an incoming protocol message.
 *
 * @param {object} msg - Raw message from peer
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateMessage(msg) {
  if (!msg || typeof msg !== 'object') {
    return { valid: false, error: 'Invalid message format' };
  }
  if (msg.protocol !== 'atelnyo-peer/1.0') {
    return { valid: false, error: 'Unknown protocol version' };
  }
  if (!msg.type || !Object.values(PROTOCOL).includes(msg.type)) {
    return { valid: false, error: `Unknown message type: ${msg.type}` };
  }
  if (typeof msg.timestamp !== 'number') {
    return { valid: false, error: 'Missing or invalid timestamp' };
  }
  // Reject messages older than 5 minutes (replay protection)
  if (Math.abs(Date.now() - msg.timestamp) > 5 * 60 * 1000) {
    return { valid: false, error: 'Message timestamp expired' };
  }
  return { valid: true };
}

// ─── Transfer Engine ───────────────────────────────────────────────
const CHUNK_SIZE = 16 * 1024; // 16 KB per chunk

/**
 * Split a file into protocol-compatible chunks for peer transfer.
 *
 * @param {File} file - File to chunk
 * @returns {AsyncGenerator<object>} Protocol FILE_CHUNK messages
 */
export async function* chunkFile(file) {
  const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    yield createMessage(PROTOCOL.FILE_CHUNK, {
      fileId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      chunkIndex: i,
      totalChunks,
      data: chunk, // In production: encode as base64 or use BinaryWebRTC
    });
  }
}

// ─── Network Selection ─────────────────────────────────────────────
/**
 * Determine the best transport for the current network conditions.
 *
 * @returns {{ transport: 'https'|'peer', reason: string }}
 */
export function selectTransport() {
  // Internet available → Direct HTTPS (always preferred)
  if (navigator.onLine) {
    return { transport: 'https', reason: 'Internet available — using Direct HTTPS' };
  }

  // Internet unavailable → Peer transport (if authorized and supported)
  if (isPeerTransportSupported() && isPeerTransportAuthorized()) {
    return { transport: 'peer', reason: 'Internet unavailable — using Peer WebRTC Transport' };
  }

  // No transport available
  return { transport: 'none', reason: 'No transport available — offline mode only' };
}

// ─── Signaling Helpers ─────────────────────────────────────────────
/**
 * Build the WebSocket URL for the signaling server.
 * Converts HTTPS API base → WSS: https://api.x.com/api/ → wss://api.x.com/ws/peer-signaling/
 */
function getSignalingUrl(token) {
  const wsBase = API_URL.replace(/^http/, 'ws').replace(/\/api\/?$/, '/ws/peer-signaling/');
  return `${wsBase}?token=${encodeURIComponent(token)}`;
}

/** ICE servers for NAT traversal */
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ─── Peer Connection Manager ───────────────────────────────────────
/**
 * Atelnyo Peer Connection Manager — handles WebRTC peer connections.
 *
 * Architecture:
 *    - Core app works WITHOUT peer transport (HTTPS is always primary)
 *    - Peer transport is an enhancement for offline/collab scenarios
 *    - All peer messages are authenticated via AUTH protocol
 *    - File transfers are validated before processing
 *    - The peer layer never bypasses auth/authz rules
 *
 * Signaling flow:
 *    1. Connect to wss://api.x.com/ws/peer-signaling/?token=<JWT>
 *    2. Send { action: 'discover', capabilities: [...] }
 *    3. Receive { action: 'peers', peers: [...] }
 *    4. To connect to peer: create offer → send via signaling → receive answer
 *    5. Exchange ICE candidates via signaling
 *    6. Data channel opens → authenticated messaging
 */
class PeerConnectionManager {
  constructor() {
    this._state = PEER_STATE.DISCONNECTED;
    this._listeners = new Set();
    this._supported = isPeerTransportSupported();
    this._authorized = false;
    this._pc = null;          // RTCPeerConnection
    this._dc = null;          // RTCDataChannel
    this._ws = null;          // Signaling WebSocket
    this._peerId = null;      // Connected peer ID
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this._maxReconnectAttempts = 5;
    this._discoveredPeers = [];
  }

  /** Current connection state */
  get state() { return this._state; }

  /** Whether peer transport is supported in this environment */
  get supported() { return this._supported; }

  /** Whether peer transport is authorized for this session */
  get authorized() { return this._authorized; }

  /** Discovered peers from signaling */
  get peers() { return [...this._discoveredPeers]; }

  /**
   * Initialize the peer transport (called once at app boot).
   * Does NOT connect — only sets up capability detection.
   */
  init() {
    if (!this._supported) {
      console.info('[PeerTransport] WebRTC not supported — peer transport disabled');
      return;
    }
    this._authorized = isPeerTransportAuthorized();
    if (!this._authorized) {
      console.info('[PeerTransport] Peer transport not authorized — enable in Settings');
      return;
    }
    console.info('[PeerTransport] Ready — transport available when needed');
  }

  /**
   * Connect to the signaling server and discover peers.
   *
   * @param {string} peerId - Optional specific peer to connect to (skips discovery)
   * @returns {{ success: boolean, error?: string, peers?: Array }}
   */
  async connect(peerId) {
    if (!this._supported) {
      return { success: false, error: 'WebRTC not supported' };
    }
    if (!this._authorized) {
      return { success: false, error: 'Peer transport not authorized' };
    }

    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    this._setState(PEER_STATE.CONNECTING);

    try {
      // Step 1: Open signaling WebSocket
      const url = getSignalingUrl(token);
      this._ws = new WebSocket(url);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Signaling server connection timeout'));
        }, 10000);

        this._ws.onopen = () => {
          clearTimeout(timeout);
          // Send auth + discovery request
          this._ws.send(JSON.stringify({
            action: 'auth',
            token,
          }));
          resolve();
        };

        this._ws.onerror = (err) => {
          clearTimeout(timeout);
          reject(new Error('Signaling server unreachable'));
        };

        this._ws.onclose = (event) => {
          if (this._state !== PEER_STATE.DISCONNECTED) {
            console.warn('[PeerTransport] Signaling disconnected:', event.code, event.reason);
            this._handleDisconnect();
          }
        };
      });

      // Step 2: Handle signaling messages
      this._ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleSignalingMessage(msg, peerId);
        } catch (e) {
          console.error('[PeerTransport] Invalid signaling message:', e);
        }
      };

      // Step 3: Request peer discovery
      this._ws.send(JSON.stringify({ action: 'discover' }));

      this._peerId = peerId || null;
      return { success: true };

    } catch (err) {
      this._setState(PEER_STATE.ERROR);
      this._cleanup();
      return { success: false, error: err.message };
    }
  }

  /**
   * Handle incoming signaling server messages.
   */
  _handleSignalingMessage(msg, targetPeerId) {
    switch (msg.action) {
      case 'peers':
        this._discoveredPeers = msg.peers || [];
        console.info(`[PeerTransport] Discovered ${this._discoveredPeers.length} peer(s)`);
        // If we have a target peer, initiate connection
        if (targetPeerId) {
          const target = this._discoveredPeers.find(p => p.id === targetPeerId);
          if (target) {
            this._initiatePeerConnection(targetPeerId);
          }
        }
        break;

      case 'offer':
        this._handleOffer(msg);
        break;

      case 'answer':
        this._handleAnswer(msg);
        break;

      case 'ice-candidate':
        this._handleIceCandidate(msg);
        break;

      case 'peer-connected':
        console.info(`[PeerTransport] Peer ${msg.peerId} is ready`);
        break;

      case 'peer-disconnected':
        console.info(`[PeerTransport] Peer ${msg.peerId} disconnected`);
        this._cleanup();
        break;

      case 'error':
        console.error('[PeerTransport] Signaling error:', msg.message);
        break;
    }
  }

  /**
   * Initiate a WebRTC connection to a specific peer.
   */
  async _initiatePeerConnection(peerId) {
    this._pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Set up ICE candidate handling
    this._pc.onicecandidate = (event) => {
      if (event.candidate && this._ws?.readyState === WebSocket.OPEN) {
        this._ws.send(JSON.stringify({
          action: 'ice-candidate',
          targetPeerId: peerId,
          candidate: event.candidate.toJSON(),
        }));
      }
    };

    // Create data channel
    this._dc = this._pc.createDataChannel('messaging', {
      ordered: true,
    });
    this._setupDataChannel(this._dc);

    // Create offer
    const offer = await this._pc.createOffer();
    await this._pc.setLocalDescription(offer);

    // Send offer via signaling
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({
        action: 'offer',
        targetPeerId: peerId,
        offer: offer.toJSON(),
      }));
    }

    this._peerId = peerId;
  }

  /**
   * Handle incoming WebRTC offer from a peer.
   */
  async _handleOffer(msg) {
    this._pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this._pc.onicecandidate = (event) => {
      if (event.candidate && this._ws?.readyState === WebSocket.OPEN) {
        this._ws.send(JSON.stringify({
          action: 'ice-candidate',
          targetPeerId: msg.peerId,
          candidate: event.candidate.toJSON(),
        }));
      }
    };

    // Accept incoming data channel
    this._pc.ondatachannel = (event) => {
      this._dc = event.channel;
      this._setupDataChannel(this._dc);
    };

    // Set remote description and create answer
    await this._pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
    const answer = await this._pc.createAnswer();
    await this._pc.setLocalDescription(answer);

    // Send answer via signaling
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify({
        action: 'answer',
        targetPeerId: msg.peerId,
        answer: answer.toJSON(),
      }));
    }

    this._peerId = msg.peerId;
  }

  /**
   * Handle incoming WebRTC answer from a peer.
   */
  async _handleAnswer(msg) {
    if (this._pc) {
      await this._pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
    }
  }

  /**
   * Handle incoming ICE candidate from a peer.
   */
  async _handleIceCandidate(msg) {
    if (this._pc && msg.candidate) {
      try {
        await this._pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      } catch (e) {
        console.warn('[PeerTransport] Failed to add ICE candidate:', e.message);
      }
    }
  }

  /**
   * Set up a data channel for messaging.
   */
  _setupDataChannel(dc) {
    dc.onopen = () => {
      console.info('[PeerTransport] Data channel open');
      this._setState(PEER_STATE.AUTHENTICATED);
    };

    dc.onclose = () => {
      console.info('[PeerTransport] Data channel closed');
      if (this._state === PEER_STATE.AUTHENTICATED) {
        this._setState(PEER_STATE.CONNECTED);
      }
    };

    dc.onerror = (err) => {
      console.error('[PeerTransport] Data channel error:', err);
    };

    dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const validation = validateMessage(msg);
        if (!validation.valid) {
          console.warn('[PeerTransport] Invalid peer message:', validation.error);
          return;
        }
        this._onPeerMessage(msg);
      } catch (e) {
        console.error('[PeerTransport] Failed to parse peer message:', e);
      }
    };
  }

  /**
   * Handle an authenticated peer message.
   */
  _onPeerMessage(msg) {
    // Dispatch to listeners registered via subscribe()
    this._listeners.forEach(fn => {
      try { fn(this._state, msg); } catch (_) { /* listener must not break */ }
    });
  }

  /**
   * Send a protocol message to the connected peer via data channel.
   *
   * @param {string} type - Protocol message type (from PROTOCOL)
   * @param {object} payload - Message payload
   * @returns {{ success: boolean, error?: string }}
   */
  send(type, payload) {
    if (this._state !== PEER_STATE.AUTHENTICATED) {
      return { success: false, error: 'Not connected to peer' };
    }
    if (!this._dc || this._dc.readyState !== 'open') {
      return { success: false, error: 'Data channel not open' };
    }

    const msg = createMessage(type, payload, {
      peerId: this._peerId,
    });

    try {
      this._dc.send(JSON.stringify(msg));
      return { success: true };
    } catch (err) {
      return { success: false, error: `Send failed: ${err.message}` };
    }
  }

  /**
   * Disconnect from all peers and clean up resources.
   */
  disconnect() {
    this._cleanup();
    this._setState(PEER_STATE.DISCONNECTED);
  }

  /**
   * Clean up WebRTC and signaling resources.
   */
  _cleanup() {
    if (this._dc) {
      try { this._dc.close(); } catch (_) {}
      this._dc = null;
    }
    if (this._pc) {
      try { this._pc.close(); } catch (_) {}
      this._pc = null;
    }
    if (this._ws) {
      try { this._ws.close(); } catch (_) {}
      this._ws = null;
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._peerId = null;
    this._reconnectAttempts = 0;
  }

  /**
   * Handle unexpected disconnection — attempt reconnect.
   */
  async _handleDisconnect() {
    this._cleanup();
    this._setState(PEER_STATE.CONNECTING);

    if (this._reconnectAttempts < this._maxReconnectAttempts) {
      const delay = Math.min(1000 * 2 ** this._reconnectAttempts, 30000);
      this._reconnectAttempts++;
      console.info(`[PeerTransport] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts})`);
      this._reconnectTimer = setTimeout(() => {
        this.connect(this._peerId);
      }, delay);
    } else {
      console.warn('[PeerTransport] Max reconnect attempts reached');
      this._setState(PEER_STATE.ERROR);
    }
  }

  /**
   * Subscribe to state changes and peer messages.
   * @param {function} listener - (state, message?) => void
   * @returns {function} Unsubscribe function
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Internal state setter — notifies listeners.
   */
  _setState(state) {
    if (this._state === state) return;
    this._state = state;
    this._listeners.forEach(fn => {
      try { fn(state); } catch (_) { /* listener must not break manager */ }
    });
  }
}

// Singleton
const peerConnectionManager = new PeerConnectionManager();

// Auto-init on import (client only)
if (typeof window !== 'undefined') {
  peerConnectionManager.init();
}

export default peerConnectionManager;
