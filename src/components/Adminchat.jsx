/**
 * AdminChat.jsx — Role-aware internal chat widget
 *
 * Renders differently based on the logged-in admin's role:
 *  super_admin → sees all company admins + all employees; can message anyone
 *  admin       → sees super_admin + their own assigned employees only
 *
 * The company super_admin is identified by role === 'superadmin' in localStorage.
 *
 * MOBILE FIXES APPLIED:
 *  1. createPortal — renders both the FAB and full panel into document.body so
 *     they're never trapped by a parent overflow:hidden / transform / will-change
 *     that breaks position:fixed in the app shell.
 *  2. useWindowWidth hook — replaces inline window.innerWidth reads in JSX
 *     (which are unsafe and return stale/wrong values). The hook fires after
 *     mount and updates on resize, so the correct mobile/desktop dimensions
 *     are always used.
 *  3. Mobile panel height — changed from 85vh to `calc(100dvh - env(safe-area-inset-bottom))`
 *     so the panel doesn't get cropped by the iOS browser chrome.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import { getStoredUser, getRole } from '../data/dataService';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
    : 'https://skyup-crm-backend.onrender.com');

// ── Safe window-width hook ────────────────────────────────────────────────────
// Reading window.innerWidth inline in JSX gives the value at render time, which
// may be wrong during hydration or before resize events settle. This hook
// re-reads on mount and on every resize so the value is always current.
function useWindowWidth() {
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 768
  );
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    handler(); // sync immediately after mount
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

export default function AdminChat() {
  const socketRef = useRef(null);

  // ── Identity ──────────────────────────────────────────────────────────────
  const storedUser   = getStoredUser();
  const role         = getRole();
  const isSuperAdmin = role === 'superadmin';
  const adminId      = storedUser?._id || storedUser?.id || '';
  const companyId    = storedUser?.companyId || storedUser?.company?._id || storedUser?.company || '';
  const displayName  = storedUser?.name || 'Admin';
  const myUsername   = isSuperAdmin ? `superadmin:${adminId}` : `admin:${adminId}`;

  // ── Window width (safe) ───────────────────────────────────────────────────
  const windowWidth = useWindowWidth();
  const isMobile    = windowWidth < 768;

  // ── State ─────────────────────────────────────────────────────────────────
  const [onlineUsers, setOnlineUsers]           = useState({});
  const [allUsers, setAllUsers]                 = useState([]);
  const [selectedUsername, setSelectedUsername] = useState(null);
  const [chats, setChats]                       = useState({});
  const [message, setMessage]                   = useState('');
  const [unread, setUnread]                     = useState({});
  const [open, setOpen]                         = useState(false);
  const [sidebarOpen, setSidebarOpen]           = useState(true);

  const [editingId, setEditingId]     = useState(null);
  const [editingText, setEditingText] = useState('');

  const bottomRef = useRef(null);

  const selectedSocketId = selectedUsername
    ? Object.entries(onlineUsers).find(([, name]) => name === selectedUsername)?.[0] ?? null
    : null;

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    const doJoin = () => {
      if (isSuperAdmin) {
        socket.emit('super_admin_join', { adminId, company: companyId, displayName });
      } else {
        socket.emit('admin_join', { adminId, company: companyId, displayName });
      }
    };
    socket.on('connect', doJoin);
    if (socket.connected) doJoin();

    socket.on('users_list', setOnlineUsers);
    socket.on('all_users_db', (users) => setAllUsers(users));

    socket.on('admin_chat_history', ({ username, history }) => {
      const formatted = history.map((m) => ({
        _id:       m._id,
        from:      m.from === myUsername ? 'Me' : m.from,
        message:   m.message,
        ts:        m.timestamp || null,
        isDeleted: m.isDeleted || false,
        editedAt:  m.editedAt  || null,
      }));
      setChats((prev) => ({ ...prev, [username]: formatted }));
    });

    socket.on('receive_user_message', ({ from, displayName: fromDisplay, message: msg, _id }) => {
      setChats((prev) => ({
        ...prev,
        [from]: [...(prev[from] || []), { _id, from: fromDisplay || from, message: msg, isDeleted: false }],
      }));
      setSelectedUsername((sel) => {
        setUnread((prev) => ({
          ...prev,
          [from]: sel === from ? 0 : (prev[from] || 0) + 1,
        }));
        return sel;
      });
    });

    socket.on('receive_admin_message', ({ from, displayName: fromDisplay, message: msg, _id }) => {
      setChats((prev) => ({
        ...prev,
        [from]: [...(prev[from] || []), { _id, from: fromDisplay || from, message: msg, isDeleted: false }],
      }));
      setSelectedUsername((sel) => {
        setUnread((prev) => ({
          ...prev,
          [from]: sel === from ? 0 : (prev[from] || 0) + 1,
        }));
        return sel;
      });
    });

    socket.on('admin_message_sent', ({ toUsername, message: msg, _id }) => {
      setChats((prev) => ({
        ...prev,
        [toUsername]: [
          ...(prev[toUsername] || []),
          { _id, from: 'Me', message: msg, isDeleted: false },
        ],
      }));
    });

    socket.on('message_edited', ({ _id, newText, editedAt }) => {
      setChats((prev) => {
        const updated = {};
        for (const [user, msgs] of Object.entries(prev)) {
          updated[user] = msgs.map((m) =>
            m._id?.toString() === _id?.toString() ? { ...m, message: newText, editedAt } : m
          );
        }
        return updated;
      });
    });

    socket.on('message_deleted', ({ _id }) => {
      setChats((prev) => {
        const updated = {};
        for (const [user, msgs] of Object.entries(prev)) {
          updated[user] = msgs.map((m) =>
            m._id?.toString() === _id?.toString()
              ? { ...m, message: 'This message was deleted', isDeleted: true }
              : m
          );
        }
        return updated;
      });
    });

    socket.on('chat_error', ({ message: err }) => console.warn('Chat error:', err));

    return () => socket.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, selectedUsername]);

  // ── Select contact ────────────────────────────────────────────────────────
  const selectUser = useCallback((username) => {
    setSelectedUsername(username);
    setUnread((prev) => ({ ...prev, [username]: 0 }));
    setEditingId(null);
    if (!chats[username]) {
      socketRef.current?.emit('admin_fetch_history', { username });
    }
  }, [chats]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    if (!message.trim() || !selectedUsername) return;
    const sid = Object.entries(onlineUsers).find(([, n]) => n === selectedUsername)?.[0] ?? null;
    socketRef.current?.emit('admin_message', {
      toSocketId: sid,
      toUsername: selectedUsername,
      message,
    });
    setMessage('');
  }, [message, selectedUsername, onlineUsers]);

  // ── Edit helpers ──────────────────────────────────────────────────────────
  const startEdit  = (msg) => { if (msg.isDeleted) return; setEditingId(msg._id); setEditingText(msg.message); };
  const submitEdit = () => {
    if (!editingText.trim() || !editingId) return;
    socketRef.current?.emit('edit_message', { _id: editingId, newText: editingText.trim(), requester: myUsername });
    setEditingId(null); setEditingText('');
  };
  const cancelEdit = () => { setEditingId(null); setEditingText(''); };

  // ── Delete helper ─────────────────────────────────────────────────────────
  const deleteMsg = (msgId) => {
    if (!window.confirm('Delete this message?')) return;
    socketRef.current?.emit('delete_message', { _id: msgId, requester: myUsername });
  };

  // ── Derived contact list ──────────────────────────────────────────────────
  const onlineUsernames   = new Set(Object.values(onlineUsers));
  const userList          = allUsers.map((u) => ({
    username:    u.username,
    displayName: u.displayName || u.username,
    role:        u.role,
    online:      onlineUsernames.has(u.username),
    unread:      unread[u.username] || 0,
  }));

  const adminContacts    = userList.filter((u) => u.role === 'admin');
  const employeeContacts = userList.filter((u) => u.role === 'employee');
  const superAdminContact = userList.find((u) => u.role === 'super_admin');

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  const roleLabel = (r) => {
    if (r === 'super_admin') return 'Super Admin';
    if (r === 'admin') return 'Admin';
    return 'Employee';
  };

  // ── Panel dimensions ──────────────────────────────────────────────────────
  // Computed from the safe hook value — never reads window inline in JSX.
  const panelWidth  = isMobile ? '100%' : (sidebarOpen ? 640 : 380);
  const panelHeight = isMobile ? 'calc(100dvh - env(safe-area-inset-bottom) - 0px)' : '520px';

  // ── FAB ───────────────────────────────────────────────────────────────────
  const fab = (
    <div className="fixed bottom-6 right-6 z-[9999]">
      <button
        onClick={() => setOpen(true)}
        className="relative w-14 h-14 rounded-2xl bg-[#2563EB] hover:bg-blue-700 text-white shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        title="Open team chat"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
        </svg>
        {totalUnread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center ring-2 ring-white dark:ring-[#0D0F14]">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>
    </div>
  );

  // ── Full panel ────────────────────────────────────────────────────────────
  const panel = (
    <div
      className="fixed z-[9999] flex shadow-2xl overflow-hidden border border-[#E4E7EF] dark:border-[#262A38] bottom-0 right-0 left-0 rounded-t-2xl md:rounded-2xl md:bottom-6 md:right-6 md:left-auto"
      style={{
        width:      panelWidth,
        height:     panelHeight,
        maxHeight:  isMobile ? 'calc(100dvh - 56px)' : '520px',
        transition: 'width 0.2s ease',
      }}
    >
      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <div className={`w-full md:w-56 shrink-0 bg-white dark:bg-[#1A1D27] border-r border-[#E4E7EF] dark:border-[#262A38] flex flex-col ${selectedUsername ? 'hidden md:flex' : 'flex'}`}>
          <div className="px-3 py-3 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/>
                </svg>
              </div>
              <span className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                {isSuperAdmin ? 'Team Chat' : 'Contacts'}
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#F1F4FF] dark:bg-[#21253A] text-[10px] font-semibold text-[#2563EB] dark:text-[#4F8EF7]">
                {Object.keys(onlineUsers).length} online
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {userList.length === 0 && (
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] text-center py-6">No contacts yet</p>
            )}

            {isSuperAdmin ? (
              <>
                {adminContacts.length > 0 && (
                  <>
                    <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-[#8B92A9] dark:text-[#565C75]">Admins</p>
                    {adminContacts.map((u) => <ContactRow key={u.username} u={u} selected={selectedUsername} selectUser={selectUser} />)}
                  </>
                )}
                {employeeContacts.length > 0 && (
                  <>
                    <p className="px-3 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-[#8B92A9] dark:text-[#565C75]">Employees</p>
                    {employeeContacts.map((u) => <ContactRow key={u.username} u={u} selected={selectedUsername} selectUser={selectUser} />)}
                  </>
                )}
              </>
            ) : (
              <>
                {superAdminContact && (
                  <>
                    <p className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-widest text-[#8B92A9] dark:text-[#565C75]">Super Admin</p>
                    <ContactRow u={superAdminContact} selected={selectedUsername} selectUser={selectUser} />
                  </>
                )}
                {employeeContacts.length > 0 && (
                  <>
                    <p className="px-3 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-[#8B92A9] dark:text-[#565C75]">My Employees</p>
                    {employeeContacts.map((u) => <ContactRow key={u.username} u={u} selected={selectedUsername} selectUser={selectUser} />)}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Chat pane ── */}
      <div className={`flex-1 flex-col bg-[#F8F9FC] dark:bg-[#0D0F14] min-w-0 ${selectedUsername ? "flex" : "hidden md:flex"}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1A1D27] border-b border-[#E4E7EF] dark:border-[#262A38] shrink-0">
          <div className="flex items-center gap-2.5">
            {selectedUsername && (
              <button
                onClick={() => setSelectedUsername(null)}
                className="md:hidden w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9] transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
            )}
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              className="hidden md:flex w-7 h-7 items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9] transition"
              title="Toggle sidebar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>

            {selectedUsername ? (
              (() => {
                const contact = userList.find((u) => u.username === selectedUsername);
                return (
                  <>
                    <div className="relative">
                      <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-[10px] font-bold text-white">
                        {(contact?.displayName || selectedUsername)[0]?.toUpperCase()}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#1A1D27] ${selectedSocketId ? 'bg-[#059669]' : 'bg-[#8B92A9]'}`}/>
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                        {contact?.displayName || selectedUsername}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${selectedSocketId ? 'text-[#059669] dark:text-[#34D399]' : 'text-[#8B92A9] dark:text-[#565C75]'}`}>
                        {contact && <span className="mr-1 opacity-60">{roleLabel(contact.role)} ·</span>}
                        {selectedSocketId ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </>
                );
              })()
            ) : (
              <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                {isSuperAdmin ? 'Team Chat' : 'Support Chat'}
              </p>
            )}
          </div>

          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9] transition"
            title="Minimise"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {!selectedUsername ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center">
                <svg className="w-6 h-6 text-[#2563EB] dark:text-[#4F8EF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                </svg>
              </div>
              <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">Select a conversation</p>
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">
                {isSuperAdmin
                  ? 'Chat with any admin or employee in your company'
                  : 'Chat with your super admin or your assigned employees'}
              </p>
            </div>
          ) : (chats[selectedUsername] || []).length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75]">No messages yet. Say hello!</p>
            </div>
          ) : (
            (chats[selectedUsername] || []).map((c, i) => {
              const isMe      = c.from === 'Me';
              const isEditing = editingId === c._id;

              return (
                <div key={c._id || i} className={`flex group ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className="flex flex-col gap-0.5 max-w-[72%]">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') cancelEdit(); }}
                          className="px-2 py-1 rounded-lg border border-[#2563EB] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] bg-white dark:bg-[#1A1D27] focus:outline-none w-48"
                        />
                        <button onClick={submitEdit} className="text-[10px] text-[#2563EB] font-semibold hover:underline">Save</button>
                        <button onClick={cancelEdit}  className="text-[10px] text-[#8B92A9] hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <div className={`relative px-3 py-2 rounded-2xl text-[12px] leading-relaxed ${
                        c.isDeleted
                          ? 'italic text-[#8B92A9] dark:text-[#565C75] bg-[#F8F9FC] dark:bg-[#1A1D27] border border-dashed border-[#E4E7EF] dark:border-[#262A38]'
                          : isMe
                            ? 'bg-[#2563EB] text-white rounded-br-sm'
                            : 'bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#0F1117] dark:text-[#F0F2FA] rounded-bl-sm'
                      }`}>
                        {!isMe && !c.isDeleted && (
                          <p className="text-[10px] font-bold text-[#2563EB] dark:text-[#4F8EF7] mb-0.5">{c.from}</p>
                        )}
                        {c.message}
                        {c.editedAt && !c.isDeleted && (
                          <span className="text-[9px] opacity-60 ml-1">(edited)</span>
                        )}

                        {!c.isDeleted && c._id && (
                          <div className={`absolute top-1 ${isMe ? '-left-14' : '-right-14'} hidden group-hover:flex items-center gap-1`}>
                            {isMe && (
                              <button onClick={() => startEdit(c)} title="Edit"
                                className="w-5 h-5 rounded-full bg-white dark:bg-[#262A38] border border-[#E4E7EF] dark:border-[#3A3F52] flex items-center justify-center text-[#8B92A9] hover:text-[#2563EB] transition shadow-sm">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        {selectedUsername && (
          <div className="px-3 py-3 bg-white dark:bg-[#1A1D27] border-t border-[#E4E7EF] dark:border-[#262A38] shrink-0">
            {!selectedSocketId && (
              <p className="text-[10px] text-[#8B92A9] dark:text-[#565C75] mb-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B92A9] inline-block"/>
                Offline — message will be delivered when they reconnect
              </p>
            )}
            <div className="flex items-center gap-2">
              <input
                value={message}
                placeholder={selectedSocketId ? 'Type a message…' : 'Send offline message…'}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                className="flex-1 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition"
              />
              <button
                onClick={sendMessage}
                disabled={!message.trim()}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:bg-[#E4E7EF] dark:disabled:bg-[#262A38] text-white disabled:text-[#8B92A9] transition"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Render via portal ─────────────────────────────────────────────────────
  // Both the FAB and the full panel are portalled into document.body so they
  // are never trapped by a parent with overflow:hidden, transform, or
  // will-change — all of which break position:fixed in CSS.
  if (typeof document === 'undefined') return null; // SSR guard

  return createPortal(
    open ? panel : fab,
    document.body
  );
}

/** Reusable contact row for the sidebar */
function ContactRow({ u, selected, selectUser }) {
  const roleColor = u.role === 'super_admin'
    ? 'bg-purple-600'
    : u.role === 'admin'
      ? 'bg-indigo-500'
      : 'bg-[#2563EB]';

  return (
    <button
      onClick={() => selectUser(u.username)}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
        selected === u.username
          ? 'bg-[#EEF3FF] dark:bg-[#1A2540]'
          : 'hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]'
      }`}
    >
      <div className="relative shrink-0">
        <div className={`w-7 h-7 rounded-full ${roleColor} flex items-center justify-center text-[10px] font-bold text-white`}>
          {(u.displayName || u.username)[0]?.toUpperCase()}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#1A1D27] ${u.online ? 'bg-[#059669]' : 'bg-[#8B92A9]'}`}/>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[12px] font-semibold truncate ${
          selected === u.username ? 'text-[#2563EB] dark:text-[#4F8EF7]' : 'text-[#0F1117] dark:text-[#F0F2FA]'
        }`}>{u.displayName || u.username}</p>
        <p className={`text-[10px] ${u.online ? 'text-[#059669] dark:text-[#34D399]' : 'text-[#8B92A9] dark:text-[#565C75]'}`}>
          {u.online ? 'Online' : 'Offline'}
        </p>
      </div>
      {u.unread > 0 && (
        <span className="w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center shrink-0">
          {u.unread > 9 ? '9+' : u.unread}
        </span>
      )}
    </button>
  );
}
