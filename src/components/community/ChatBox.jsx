/**
 * src/components/community/ChatBox.jsx
 *
 * Real-time Chat Box Component for Community Groups and Discussions.
 * Provides a complete chat interface with message sending, typing
 * indicators, and online presence.
 *
 * Features:
 *   - Real-time messaging
 *   - Message history
 *   - Typing indicators
 *   - Online user list
 *   - Message reactions
 *   - Auto-scroll to bottom
 *   - Responsive design
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chatService, formatMessageTime, groupMessagesByDate } from '../../services/chat';
import api from '../../services/api';

// ─── Message Bubble ────────────────────────────────────────────────

function MessageBubble({ message, isOwn, showAvatar, lang }) {
  const [showReactions, setShowReactions] = useState(false);

  const quickReactions = ['👍', '❤️', '😂', '🎉', '🤔', '👀'];

  const handleReaction = async (emoji) => {
    try {
      chatService.sendReaction(message.id, emoji);
      setShowReactions(false);
    } catch (err) {
      console.error('Failed to send reaction:', err);
    }
  };

  return (
    <div className={`chat-message ${isOwn ? 'chat-message-own' : 'chat-message-other'}`}>
      {!isOwn && showAvatar && (
        <div className="chat-avatar">
          {message.sender_avatar ? (
            <img src={message.sender_avatar} alt={message.sender_name} />
          ) : (
            <span>{message.sender_name?.charAt(0)?.toUpperCase() || '?'}</span>
          )}
        </div>
      )}

      <div className="chat-bubble-wrapper">
        {!isOwn && showAvatar && (
          <div className="chat-sender-name">{message.sender_name || 'Anonymous'}</div>
        )}

        <div
          className={`chat-bubble ${isOwn ? 'chat-bubble-own' : 'chat-bubble-other'}`}
          onDoubleClick={() => setShowReactions(!showReactions)}
        >
          {message.message_type === 'image' ? (
            <img src={message.content} alt="" className="chat-image" />
          ) : message.message_type === 'file' ? (
            <div className="chat-file">
              <i className="fas fa-file" />
              <span>{message.file_name || 'File'}</span>
            </div>
          ) : (
            <div className="chat-text">{message.content}</div>
          )}
        </div>

        <div className="chat-message-meta">
          <span className="chat-time">{formatMessageTime(message.created_at)}</span>
          {isOwn && message.read && (
            <span className="chat-read">
              <i className="fas fa-check-double" />
            </span>
          )}
        </div>

        {message.reactions && message.reactions.length > 0 && (
          <div className="chat-reactions">
            {message.reactions.map((reaction, idx) => (
              <span key={idx} className="chat-reaction" onClick={() => handleReaction(reaction.emoji)}>
                {reaction.emoji} {reaction.count > 1 && reaction.count}
              </span>
            ))}
          </div>
        )}

        {showReactions && (
          <div className="chat-reactions-picker">
            {quickReactions.map(emoji => (
              <button key={emoji} onClick={() => handleReaction(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Typing Indicator ──────────────────────────────────────────────

function TypingIndicator({ users }) {
  if (!users || users.length === 0) return null;

  const names = users.map(u => u.username).join(', ');
  const text = users.length === 1
    ? `${names} is typing...`
    : `${names} are typing...`;

  return (
    <div className="chat-typing">
      <div className="chat-typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span className="chat-typing-text">{text}</span>
    </div>
  );
}

// ─── Online Users ──────────────────────────────────────────────────

function OnlineUsers({ users }) {
  if (!users || users.length === 0) return null;

  return (
    <div className="chat-online">
      <div className="chat-online-header">
        <i className="fas fa-circle" />
        <span>{users.length} online</span>
      </div>
      <div className="chat-online-list">
        {users.slice(0, 10).map(user => (
          <div key={user.id} className="chat-online-user">
            {user.avatar ? (
              <img src={user.avatar} alt={user.username} />
            ) : (
              <span>{user.username?.charAt(0)?.toUpperCase()}</span>
            )}
          </div>
        ))}
        {users.length > 10 && (
          <div className="chat-online-more">+{users.length - 10}</div>
        )}
      </div>
    </div>
  );
}

// ─── Date Separator ────────────────────────────────────────────────

function DateSeparator({ date }) {
  return (
    <div className="chat-date-separator">
      <span>{date}</span>
    </div>
  );
}

// ─── Main Chat Box Component ───────────────────────────────────────

export default function ChatBox({
  roomId,
  roomType = 'group',
  lang = 'ht',
  user,
  onClose,
  isMuted = false,
  mutedUntil = null,
}) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastMessageId = useRef(null);

  // Connect to WebSocket
  useEffect(() => {
    if (!roomId || !user) return;

    chatService.connect(roomId, user.id);

    const unsubscribes = [
      chatService.on('connected', () => setIsConnected(true)),
      chatService.on('disconnected', () => setIsConnected(false)),
      chatService.on('message', handleNewMessage),
      chatService.on('typing', handleTyping),
      chatService.on('presence', handlePresence),
      chatService.on('reaction', handleReaction),
    ];

    return () => {
      unsubscribes.forEach(unsub => unsub());
      chatService.disconnect();
    };
  }, [roomId, user?.id]);

  // Load message history
  useEffect(() => {
    if (!roomId) return;
    loadMessages();
  }, [roomId]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadMessages = async (before = null) => {
    try {
      setLoading(true);
      const history = await chatService.getMessageHistory(roomId, 50, before);

      if (before) {
        setMessages(prev => [...history, ...prev]);
      } else {
        setMessages(history);
        if (history.length > 0) {
          lastMessageId.current = history[0].id;
        }
      }

      setHasMore(history.length === 50);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNewMessage = useCallback((message) => {
    setMessages(prev => {
      // Avoid duplicates
      if (prev.some(m => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  const handleTyping = useCallback((data) => {
    if (data.userId === user?.id) return;

    setTypingUsers(prev => {
      if (data.isTyping) {
        if (prev.some(u => u.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, username: data.username }];
      } else {
        return prev.filter(u => u.userId !== data.userId);
      }
    });
  }, [user?.id]);

  const handlePresence = useCallback((data) => {
    setOnlineUsers(prev => {
      const idx = prev.findIndex(u => u.id === data.userId);
      if (data.status === 'online') {
        if (idx >= 0) return prev;
        return [...prev, { id: data.userId, username: data.username }];
      } else {
        if (idx < 0) return prev;
        return prev.filter(u => u.id !== data.userId);
      }
    });
  }, []);

  const handleReaction = useCallback((data) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== data.messageId) return msg;
      const reactions = msg.reactions || [];
      const existing = reactions.find(r => r.emoji === data.emoji);
      if (existing) {
        return { ...msg, reactions: reactions.map(r =>
          r.emoji === data.emoji ? { ...r, count: r.count + 1 } : r
        )};
      }
      return { ...msg, reactions: [...reactions, { emoji: data.emoji, count: 1 }] };
    }));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);

    // Send typing indicator
    chatService.sendTyping(true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after timeout
    typingTimeoutRef.current = setTimeout(() => {
      chatService.sendTyping(false);
    }, TYPING_TIMEOUT);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isMuted) return;

    chatService.sendMessage(inputValue.trim());
    setInputValue('');
    chatService.sendTyping(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleLoadMore = () => {
    if (messages.length > 0) {
      loadMessages(messages[0].id);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Group messages by date
  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <h3>
            <i className={`fas ${roomType === 'group' ? 'fa-layer-group' : 'fa-comments'}`} />
            {roomType === 'group' ? 'Group Chat' : 'Discussion'}
          </h3>
          <div className={`chat-status ${isConnected ? 'chat-status-connected' : 'chat-status-disconnected'}`}>
            <i className="fas fa-circle" />
            <span>{isConnected ? 'Connected' : 'Reconnecting...'}</span>
          </div>
        </div>

        <OnlineUsers users={onlineUsers} />

        {onClose && (
          <button className="chat-close-btn" onClick={onClose}>
            <i className="fas fa-times" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {loading && messages.length === 0 ? (
          <div className="chat-loading">
            <i className="fas fa-spinner fa-spin" />
            <span>Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <i className="fas fa-comments" />
            <p>{lang === 'ht' ? 'Kòmanse yon konvèsasyon' : 'Start a conversation'}</p>
          </div>
        ) : (
          <>
            {hasMore && (
              <button className="chat-load-more" onClick={handleLoadMore}>
                Load more messages
              </button>
            )}

            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <React.Fragment key={date}>
                <DateSeparator date={date} />
                {msgs.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isOwn={msg.sender_id === user?.id}
                    showAvatar={idx === 0 || msgs[idx - 1]?.sender_id !== msg.sender_id}
                    lang={lang}
                  />
                ))}
              </React.Fragment>
            ))}
          </>
        )}

        <TypingIndicator users={typingUsers} />
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form className="chat-input" onSubmit={handleSendMessage}>
        {isMuted ? (
          <div className="chat-muted-notice" role="status" style={{
            flex: 1, textAlign: 'center', padding: '10px 14px',
            fontSize: '0.8rem', color: '#92400e',
            background: 'rgba(245,158,11,0.12)', borderRadius: 10,
          }}>
            <i className="fas fa-volume-xmark" style={{ marginRight: 6 }} aria-hidden="true" />
            {lang === 'ht'
              ? (mutedUntil
                ? `Ou mute jouk ${new Date(mutedUntil).toLocaleString()}.`
                : 'Ou mute nan chat la — ou pa ka poste kounye a.')
              : (mutedUntil
                ? `You are muted until ${new Date(mutedUntil).toLocaleString()}.`
                : 'You are muted in this chat — posting is disabled.')}
          </div>
        ) : (
          <>
            <button type="button" className="chat-attach-btn">
              <i className="fas fa-paperclip" />
            </button>

            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={lang === 'ht' ? 'Ekri yon mesaj...' : 'Type a message...'}
              disabled={!isConnected}
            />
          </>
        )}

        <button type="submit" className="chat-send-btn" disabled={!inputValue.trim() || !isConnected || isMuted}>
          <i className="fas fa-paper-plane" />
        </button>
      </form>
    </div>
  );
}
