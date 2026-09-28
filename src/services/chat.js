/**
 * src/services/chat.js
 *
 * Real-time Chat Service for Community Groups and Discussions.
 * Handles WebSocket connections, message sending/receiving, and
 * presence tracking.
 *
 * Features:
 *   - WebSocket connection management
 *   - Message sending/receiving
 *   - Typing indicators
 *   - Online presence
 *   - Message history
 *   - Reactions
 */
import api from './api';

// ─── Configuration ─────────────────────────────────────────────────

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
const RECONNECT_DELAY = 1000;
const MAX_RECONNECT_ATTEMPTS = 10;
const TYPING_TIMEOUT = 3000;

// ─── Chat Service Class ────────────────────────────────────────────

class ChatService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.typingTimers = {};
    this.listeners = new Map();
    this.connected = false;
    this.roomId = null;
    this.userId = null;
  }

  /**
   * Connect to WebSocket server
   */
  connect(roomId, userId) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.disconnect();
    }

    this.roomId = roomId;
    this.userId = userId;
    this.reconnectAttempts = 0;

    const token = localStorage.getItem('access_token');
    const url = `${WS_URL}/ws/chat/${roomId}/?token=${token}`;

    try {
      this.ws = new WebSocket(url);
      this._setupEventHandlers();
    } catch (err) {
      console.error('WebSocket connection failed:', err);
      this._scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.connected = false;
    this.roomId = null;
    this._emit('disconnected');
  }

  /**
   * Send a message
   */
  sendMessage(content, type = 'text', metadata = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, queuing message');
      this._queueMessage({ content, type, metadata });
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'message',
      content,
      message_type: type,
      metadata,
    }));
  }

  /**
   * Send typing indicator
   */
  sendTyping(isTyping = true) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'typing',
      is_typing: isTyping,
    }));
  }

  /**
   * Send reaction to a message
   */
  sendReaction(messageId, emoji) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'reaction',
      message_id: messageId,
      emoji,
    }));
  }

  /**
   * Mark message as read
   */
  markRead(messageId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'read',
      message_id: messageId,
    }));
  }

  /**
   * Subscribe to events
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  /**
   * Get message history
   */
  async getMessageHistory(roomId, limit = 50, before = null) {
    try {
      const params = { room: roomId, limit };
      if (before) params.before = before;

      const res = await api.get('/chat/messages/', { params });
      return res.data.results || res.data;
    } catch (err) {
      console.error('Failed to fetch message history:', err);
      return [];
    }
  }

  /**
   * Get online users in room
   */
  async getOnlineUsers(roomId) {
    try {
      const res = await api.get(`/chat/rooms/${roomId}/online/`);
      return res.data;
    } catch (err) {
      console.error('Failed to fetch online users:', err);
      return [];
    }
  }

  // ── Private Methods ───────────────────────────────────────────────

  _setupEventHandlers() {
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.connected = true;
      this.reconnectAttempts = 0;
      this._emit('connected');
      this._flushQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._handleMessage(data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.connected = false;
      this._emit('disconnected');

      if (event.code !== 1000) {
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  _handleMessage(data) {
    switch (data.type) {
      case 'message':
        this._emit('message', data.message);
        break;
      case 'typing':
        this._emit('typing', {
          userId: data.user_id,
          username: data.username,
          isTyping: data.is_typing,
        });
        break;
      case 'reaction':
        this._emit('reaction', {
          messageId: data.message_id,
          emoji: data.emoji,
          userId: data.user_id,
        });
        break;
      case 'read':
        this._emit('read', {
          messageId: data.message_id,
          userId: data.user_id,
        });
        break;
      case 'presence':
        this._emit('presence', {
          userId: data.user_id,
          username: data.username,
          status: data.status,
        });
        break;
      case 'error':
        this._emit('error', data.message);
        break;
      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  _emit(event, data) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('Event listener error:', err);
        }
      });
    }
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      this._emit('reconnect_failed');
      return;
    }

    const delay = RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect(this.roomId, this.userId);
    }, delay);
  }

  _queueMessage(message) {
    const queue = JSON.parse(localStorage.getItem('chat_queue') || '[]');
    queue.push({ ...message, timestamp: Date.now() });
    localStorage.setItem('chat_queue', JSON.stringify(queue));
  }

  _flushQueue() {
    const queue = JSON.parse(localStorage.getItem('chat_queue') || '[]');
    if (queue.length === 0) return;

    queue.forEach(message => {
      this.sendMessage(message.content, message.type, message.metadata);
    });

    localStorage.removeItem('chat_queue');
  }
}

// ─── Singleton Instance ────────────────────────────────────────────

export const chatService = new ChatService();

// ─── Helper Functions ──────────────────────────────────────────────

export function formatMessageTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (messageDate.getTime() === yesterday.getTime()) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function groupMessagesByDate(messages) {
  const groups = {};
  messages.forEach(msg => {
    const date = new Date(msg.created_at).toLocaleDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
  });
  return groups;
}

export default chatService;
