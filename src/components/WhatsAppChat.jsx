// src/components/WhatsAppChat.jsx
// Drop-in WhatsApp chat panel for your CRM
// Works for both agents (see own chats) and admin (see all chats)

import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';

const API_URL    = import.meta.env.VITE_API_URL;   // e.g. http://localhost:5000/api
const SOCKET_URL = API_URL.replace('/api', '');     // e.g. http://localhost:5000

// ── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d    = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString();
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name = '') {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'WA';
}

function sessionBanner(conv) {
  if (!conv?.sessionExpiresAt) return null;
  const remaining = new Date(conv.sessionExpiresAt) - Date.now();
  if (remaining <= 0) return { expired: true, text: '24h session expired — send a template message' };
  const hours = Math.floor(remaining / 3600000);
  const mins  = Math.floor((remaining % 3600000) / 60000);
  if (hours < 2) return { expired: false, text: `Session closes in ${hours}h ${mins}m` };
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function WhatsAppChat({ currentUser }) {
  // currentUser: { _id, name, role }  — pass from your auth context

  const socketRef            = useRef(null);
  const bottomRef            = useRef(null);
  const inputRef             = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [selected,      setSelected]      = useState(null);   // selected conversation object
  const [messages,      setMessages]      = useState([]);
  const [text,          setText]          = useState('');
  const [loading,       setLoading]       = useState(false);
  const [sending,       setSending]       = useState(false);
  const [search,        setSearch]        = useState('');
  const [filter,        setFilter]        = useState('all');  // all | open | waiting | closed
  const [error,         setError]         = useState('');

  const isAdmin = currentUser?.role === 'admin';
  const token   = localStorage.getItem('token');

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // ── Load conversations ────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API_URL}/whatsapp/conversations`, authHeaders);
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('loadConversations:', err.message);
    }
  }, []);

  // ── Load messages for a conversation ─────────────────────────────────────
  const loadMessages = useCallback(async (conv) => {
    setLoading(true);
    setMessages([]);
    try {
      const { data } = await axios.get(
        `${API_URL}/whatsapp/conversations/${conv._id}/messages`,
        authHeaders
      );
      setMessages(data.messages || []);
      // Reset unread count locally
      setConversations(prev =>
        prev.map(c => c._id === conv._id ? { ...c, unreadCount: 0 } : c)
      );
    } catch (err) {
      console.error('loadMessages:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { auth: { token } });
    socketRef.current = socket;

    // Join the right WA rooms
    if (isAdmin) {
      socket.emit('wa_admin_join');
    } else if (currentUser?._id) {
      socket.emit('wa_agent_join', { agentId: currentUser._id });
    }

    // New incoming/outgoing message
    socket.on('wa_message', (payload) => {
      const { conversationId, message: msg } = payload;

      // Update sidebar conversation list
      setConversations(prev => {
        const idx = prev.findIndex(c => c._id === conversationId);
        if (idx === -1) {
          // New conversation appeared — reload list
          loadConversations();
          return prev;
        }
        const updated = [...prev];
        const conv    = { ...updated[idx] };
        conv.lastMessage   = msg.body;
        conv.lastMessageAt = msg.waTimestamp;
        if (msg.direction === 'inbound') {
          conv.status = 'waiting';
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        } else {
          conv.status = 'open';
        }
        updated[idx] = conv;
        // Move to top
        updated.unshift(updated.splice(idx, 1)[0]);
        return updated;
      });

      // If this conversation is selected, append the message
      setSelected(sel => {
        if (sel?._id === conversationId) {
          setMessages(prev => {
            // Avoid duplicates (optimistic update)
            if (prev.some(m => m._id === msg._id)) return prev;
            return [...prev, msg];
          });
          // Auto-scroll
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        }
        return sel;
      });
    });

    // Status update (delivered/read)
    socket.on('wa_status_update', ({ waMessageId, status }) => {
      setMessages(prev =>
        prev.map(m => m.waMessageId === waMessageId ? { ...m, status } : m)
      );
    });

    // New conversation assigned to this agent
    socket.on('wa_assigned', ({ conversationId }) => {
      loadConversations();
    });

    loadConversations();

    return () => socket.disconnect();
  }, [currentUser]);

  // ── Auto-scroll when messages change ─────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Select conversation ───────────────────────────────────────────────────
  const selectConversation = (conv) => {
    setSelected(conv);
    setError('');
    loadMessages(conv);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!text.trim() || !selected || sending) return;

    const msgText = text.trim();
    setText('');
    setSending(true);
    setError('');

    // Optimistic update
    const optimistic = {
      _id:         `opt_${Date.now()}`,
      direction:   'outbound',
      body:        msgText,
      messageType: 'text',
      waTimestamp: new Date(),
      status:      'pending',
      sentBy:      { name: currentUser?.name },
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      const { data } = await axios.post(
        `${API_URL}/whatsapp/send`,
        { conversationId: selected._id, text: msgText },
        authHeaders
      );

      // Replace optimistic with real message
      setMessages(prev =>
        prev.map(m => m._id === optimistic._id ? { ...optimistic, ...data.message } : m)
      );
    } catch (err) {
      // Remove optimistic and show error
      setMessages(prev => prev.filter(m => m._id !== optimistic._id));
      const code = err.response?.data?.code;
      setError(
        code === 'SESSION_EXPIRED'
          ? '24-hour session expired. Use a template message to re-engage.'
          : err.response?.data?.error || 'Failed to send message'
      );
    } finally {
      setSending(false);
    }
  };

  // ── Close conversation ────────────────────────────────────────────────────
  const closeConversation = async () => {
    if (!selected) return;
    try {
      await axios.patch(`${API_URL}/whatsapp/conversations/${selected._id}/close`, {}, authHeaders);
      setConversations(prev =>
        prev.map(c => c._id === selected._id ? { ...c, status: 'closed' } : c)
      );
      setSelected(prev => ({ ...prev, status: 'closed' }));
    } catch (err) {
      console.error(err.message);
    }
  };

  // ── Filtered conversations ────────────────────────────────────────────────
  const filteredConversations = conversations.filter(c => {
    const matchSearch = !search ||
      c.contactName?.toLowerCase().includes(search.toLowerCase()) ||
      c.waPhone?.includes(search) ||
      c.lead?.name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || c.status === filter;
    return matchSearch && matchFilter;
  });

  const session = sessionBanner(selected);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display:        'flex',
      height:         'calc(100vh - 80px)',
      background:     'var(--color-background-primary)',
      border:         '0.5px solid var(--color-border-tertiary)',
      borderRadius:   'var(--border-radius-lg)',
      overflow:       'hidden',
    }}>

      {/* ── LEFT: Conversation List ───────────────────────────────────────── */}
      <div style={{
        width:        '320px',
        flexShrink:   0,
        borderRight:  '0.5px solid var(--color-border-tertiary)',
        display:      'flex',
        flexDirection: 'column',
        background:   'var(--color-background-secondary)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '0.5px solid var(--color-border-tertiary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.121 1.531 5.845L.057 23.286a.5.5 0 0 0 .64.64l5.431-1.47A11.952 11.952 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.849 0-3.576-.498-5.066-1.367l-.363-.214-3.765 1.018 1.022-3.734-.234-.376A9.967 9.967 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
              </svg>
            </div>
            <span style={{ fontWeight: 500, fontSize: 15, color: 'var(--color-text-primary)' }}>
              WhatsApp Chats
            </span>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search by name or number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 13 }}
          />

          {/* Status filter */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {['all', 'open', 'waiting', 'closed'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  flex:         1,
                  fontSize:     11,
                  padding:      '4px 0',
                  borderRadius: 'var(--border-radius-md)',
                  border:       filter === f ? '1px solid var(--color-border-info)' : '0.5px solid var(--color-border-tertiary)',
                  background:   filter === f ? 'var(--color-background-info)' : 'transparent',
                  color:        filter === f ? 'var(--color-text-info)' : 'var(--color-text-secondary)',
                  cursor:       'pointer',
                  fontWeight:   filter === f ? 500 : 400,
                  textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConversations.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
              No conversations found
            </div>
          )}
          {filteredConversations.map(conv => {
            const isActive  = selected?._id === conv._id;
            const hasUnread = conv.unreadCount > 0;

            return (
              <div
                key={conv._id}
                onClick={() => selectConversation(conv)}
                style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:        10,
                  padding:    '12px 14px',
                  cursor:     'pointer',
                  background: isActive ? 'var(--color-background-primary)' : 'transparent',
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                  transition: 'background 0.15s',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width:          40,
                  height:         40,
                  borderRadius:   '50%',
                  background:     '#dcfce7',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontWeight:     500,
                  fontSize:       14,
                  color:          '#166534',
                  flexShrink:     0,
                }}>
                  {getInitials(conv.contactName || conv.lead?.name || conv.waPhone)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{
                      fontWeight:   hasUnread ? 500 : 400,
                      fontSize:     13,
                      color:        'var(--color-text-primary)',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                      maxWidth:     140,
                    }}>
                      {conv.contactName || conv.lead?.name || `+${conv.waPhone}`}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                      {timeAgo(conv.lastMessageAt)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span style={{
                      fontSize:     12,
                      color:        'var(--color-text-secondary)',
                      overflow:     'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace:   'nowrap',
                      maxWidth:     150,
                    }}>
                      {conv.lastMessage || 'No messages yet'}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      {/* Status dot */}
                      <span style={{
                        width:        6,
                        height:       6,
                        borderRadius: '50%',
                        background:   conv.status === 'waiting' ? '#f59e0b' : conv.status === 'open' ? '#22c55e' : '#9ca3af',
                      }} />

                      {/* Unread badge */}
                      {hasUnread && (
                        <span style={{
                          background:     '#25D366',
                          color:          '#fff',
                          fontSize:       10,
                          fontWeight:     500,
                          padding:        '1px 5px',
                          borderRadius:   10,
                          minWidth:       16,
                          textAlign:      'center',
                        }}>
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Agent tag (admin view only) */}
                  {isAdmin && conv.assignedAgent && (
                    <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                      {conv.assignedAgent.name}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT: Chat Window ───────────────────────────────────────────── */}
      {!selected ? (
        <div style={{
          flex:           1,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          color:          'var(--color-text-tertiary)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            Select a conversation
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Choose a chat from the list to view messages
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Chat header */}
          <div style={{
            padding:       '12px 16px',
            borderBottom:  '0.5px solid var(--color-border-tertiary)',
            display:       'flex',
            alignItems:    'center',
            gap:           10,
            background:    'var(--color-background-primary)',
          }}>
            <div style={{
              width:          40,
              height:         40,
              borderRadius:   '50%',
              background:     '#dcfce7',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontWeight:     500,
              fontSize:       14,
              color:          '#166534',
              flexShrink:     0,
            }}>
              {getInitials(selected.contactName || selected.lead?.name || selected.waPhone)}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--color-text-primary)' }}>
                {selected.contactName || selected.lead?.name || `+${selected.waPhone}`}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                +{selected.waPhone}
                {selected.lead && ` · ${selected.lead.status}`}
                {isAdmin && selected.assignedAgent && ` · Agent: ${selected.assignedAgent.name}`}
              </div>
            </div>

            {/* Close button */}
            {selected.status !== 'closed' && (
              <button
                onClick={closeConversation}
                style={{ fontSize: 12, padding: '6px 12px', color: 'var(--color-text-danger)', borderColor: 'var(--color-border-danger)' }}
              >
                Mark resolved
              </button>
            )}
          </div>

          {/* Session expiry banner */}
          {session && (
            <div style={{
              padding:    '8px 16px',
              fontSize:   12,
              background: session.expired ? 'var(--color-background-danger)' : 'var(--color-background-warning)',
              color:      session.expired ? 'var(--color-text-danger)' : 'var(--color-text-warning)',
              borderBottom: '0.5px solid var(--color-border-tertiary)',
            }}>
              ⚠️ {session.text}
            </div>
          )}

          {/* Messages */}
          <div style={{
            flex:        1,
            overflowY:   'auto',
            padding:     '16px',
            display:     'flex',
            flexDirection: 'column',
            gap:         8,
            background:  '#f0fdf4',
          }}>
            {loading && (
              <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                Loading messages...
              </div>
            )}

            {messages.map((msg) => {
              const isOut = msg.direction === 'outbound';
              return (
                <div
                  key={msg._id}
                  style={{
                    display:        'flex',
                    justifyContent: isOut ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{
                    maxWidth:     '70%',
                    padding:      '8px 12px',
                    borderRadius: isOut ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background:   isOut ? '#dcfce7' : '#ffffff',
                    border:       '0.5px solid',
                    borderColor:  isOut ? '#bbf7d0' : '#e5e7eb',
                    boxShadow:    '0 1px 2px rgba(0,0,0,0.06)',
                  }}>
                    {/* Sender label (admin view) */}
                    {isAdmin && isOut && msg.sentBy && (
                      <div style={{ fontSize: 10, color: '#166534', fontWeight: 500, marginBottom: 2 }}>
                        {msg.sentBy.name}
                      </div>
                    )}

                    <div style={{
                      fontSize: 14,
                      color:    '#111827',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak:  'break-word',
                    }}>
                      {msg.messageType === 'image'    && '🖼️ '}
                      {msg.messageType === 'document' && '📄 '}
                      {msg.messageType === 'audio'    && '🎵 '}
                      {msg.messageType === 'video'    && '🎥 '}
                      {msg.messageType === 'location' && '📍 '}
                      {msg.messageType === 'template' && '📋 '}
                      {msg.body}
                    </div>

                    <div style={{
                      display:        'flex',
                      justifyContent: 'flex-end',
                      alignItems:     'center',
                      gap:            4,
                      marginTop:      4,
                    }}>
                      <span style={{ fontSize: 10, color: '#6b7280' }}>
                        {formatTime(msg.waTimestamp)}
                      </span>
                      {isOut && (
                        <span style={{ fontSize: 10, color: msg.status === 'read' ? '#2563eb' : '#9ca3af' }}>
                          {msg.status === 'read'      ? '✓✓' :
                           msg.status === 'delivered' ? '✓✓' :
                           msg.status === 'sent'      ? '✓'  :
                           msg.status === 'failed'    ? '✗'  : '⏳'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div ref={bottomRef} />
          </div>

          {/* Error bar */}
          {error && (
            <div style={{
              padding:    '8px 16px',
              fontSize:   12,
              background: 'var(--color-background-danger)',
              color:      'var(--color-text-danger)',
              borderTop:  '0.5px solid var(--color-border-danger)',
            }}>
              {error}
              <button
                onClick={() => setError('')}
                style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Input area */}
          <div style={{
            padding:        '12px 16px',
            borderTop:      '0.5px solid var(--color-border-tertiary)',
            display:        'flex',
            gap:            8,
            alignItems:     'flex-end',
            background:     'var(--color-background-primary)',
          }}>
            <textarea
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                selected.status === 'closed'
                  ? 'Conversation is closed'
                  : session?.expired
                    ? 'Session expired — use template message'
                    : 'Type a message... (Enter to send)'
              }
              disabled={selected.status === 'closed' || sending}
              rows={1}
              style={{
                flex:       1,
                resize:     'none',
                fontSize:   14,
                padding:    '10px 12px',
                borderRadius: '20px',
                lineHeight: 1.5,
                maxHeight:  120,
                overflowY:  'auto',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!text.trim() || sending || selected.status === 'closed'}
              style={{
                width:          40,
                height:         40,
                borderRadius:   '50%',
                background:     text.trim() && !sending ? '#25D366' : 'var(--color-border-tertiary)',
                border:         'none',
                cursor:         text.trim() && !sending ? 'pointer' : 'default',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                flexShrink:     0,
                transition:     'background 0.2s',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={text.trim() && !sending ? 'white' : '#9ca3af'}>
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}