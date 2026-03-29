import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

// Socket is created once via ref inside the component — see useEffect below

export default function AdminChat() {
  const socketRef = useRef(null);

  const [onlineUsers, setOnlineUsers]         = useState({});
  const [allUsers, setAllUsers]               = useState([]);
  const [selectedUsername, setSelectedUsername] = useState(null);
  const [chats, setChats]                     = useState({});
  const [message, setMessage]                 = useState('');
  const [unread, setUnread]                   = useState({});
  const [open, setOpen]                       = useState(false);
  const [sidebarOpen, setSidebarOpen]         = useState(true);
  const bottomRef = useRef(null);

  // Derive socketId from live onlineUsers map — never stale
  const selectedSocketId = selectedUsername
    ? (Object.entries(onlineUsers).find(([, name]) => name === selectedUsername)?.[0] ?? null)
    : null;

  // ── Socket setup (once) ────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.emit('admin_join');

    socket.on('users_list',       (list)  => setOnlineUsers(list));
    socket.on('all_users_db',     (users) => setAllUsers(users));
    socket.on('admin_chat_history', ({ username, history }) => {
      const formatted = history.map((m) => ({
        from: m.from === 'admin' ? 'Admin' : m.from,
        message: m.message,
        ts: m.ts || null,
      }));
      setChats((prev) => ({ ...prev, [username]: formatted }));
    });
    socket.on('receive_user_message', ({ from, message: msg }) => {
      setChats((prev) => ({
        ...prev,
        [from]: [...(prev[from] || []), { from, message: msg }],
      }));
      // Use functional update to avoid stale closure on selectedUsername
      setSelectedUsername((sel) => {
        setUnread((prev) => ({
          ...prev,
          [from]: sel === from ? 0 : (prev[from] || 0) + 1,
        }));
        return sel;
      });
    });

    return () => socket.disconnect();
  }, []);

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, selectedUsername]);

  // ── Select user ────────────────────────────────────────────────────────────
  const selectUser = useCallback((username) => {
    setSelectedUsername(username);
    setUnread((prev) => ({ ...prev, [username]: 0 }));
    if (!chats[username]) {
      socketRef.current?.emit('admin_fetch_history', { username });
    }
  }, [chats]);

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    if (!message.trim() || !selectedUsername) return;
    const sid = Object.entries(onlineUsers).find(([, n]) => n === selectedUsername)?.[0] ?? null;

    socketRef.current?.emit('admin_message', {
      toSocketId: sid,
      toUsername: selectedUsername,
      message,
    });

    setChats((prev) => ({
      ...prev,
      [selectedUsername]: [
        ...(prev[selectedUsername] || []),
        { from: 'Admin', message },
      ],
    }));
    setMessage('');
  }, [message, selectedUsername, onlineUsers]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const userList = allUsers.map((u) => ({
    username: u.username,
    online: Object.values(onlineUsers).includes(u.username),
    unread: unread[u.username] || 0,
  }));

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  // ── Minimised FAB ──────────────────────────────────────────────────────────
  if (!open) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setOpen(true)}
          className="relative w-14 h-14 rounded-2xl bg-[#2563EB] hover:bg-blue-700 text-white shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          title="Open support chat"
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
  }

  // ── Full panel ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-6 right-6 z-50 flex shadow-2xl rounded-2xl overflow-hidden border border-[#E4E7EF] dark:border-[#262A38]"
      style={{ width: sidebarOpen ? 600 : 380, height: 520, transition: 'width 0.2s ease' }}>

      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <div className="w-52 shrink-0 bg-white dark:bg-[#1A1D27] border-r border-[#E4E7EF] dark:border-[#262A38] flex flex-col">
          {/* Sidebar header */}
          <div className="px-3 py-3 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/>
                </svg>
              </div>
              <span className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Users</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#F1F4FF] dark:bg-[#21253A] text-[10px] font-semibold text-[#2563EB] dark:text-[#4F8EF7]">
                {Object.keys(onlineUsers).length} online
              </span>
            </div>
          </div>

          {/* User list */}
          <div className="flex-1 overflow-y-auto py-1">
            {userList.length === 0 && (
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] text-center py-6">No users yet</p>
            )}
            {userList.map(({ username, online, unread: u }) => (
              <button
                key={username}
                onClick={() => selectUser(username)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                  selectedUsername === username
                    ? 'bg-[#EEF3FF] dark:bg-[#1A2540]'
                    : 'hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-[10px] font-bold text-white">
                    {username[0]?.toUpperCase()}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#1A1D27] ${online ? 'bg-[#059669]' : 'bg-[#8B92A9]'}`}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] font-semibold truncate ${
                    selectedUsername === username
                      ? 'text-[#2563EB] dark:text-[#4F8EF7]'
                      : 'text-[#0F1117] dark:text-[#F0F2FA]'
                  }`}>{username}</p>
                  <p className={`text-[10px] ${online ? 'text-[#059669] dark:text-[#34D399]' : 'text-[#8B92A9] dark:text-[#565C75]'}`}>
                    {online ? 'Online' : 'Offline'}
                  </p>
                </div>
                {u > 0 && (
                  <span className="w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center shrink-0">
                    {u > 9 ? '9+' : u}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Chat pane ── */}
      <div className="flex-1 flex flex-col bg-[#F8F9FC] dark:bg-[#0D0F14] min-w-0">

        {/* Chat header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1A1D27] border-b border-[#E4E7EF] dark:border-[#262A38] shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9] dark:text-[#565C75] transition"
              title="Toggle sidebar"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>

            {selectedUsername ? (
              <>
                <div className="relative">
                  <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-[10px] font-bold text-white">
                    {selectedUsername[0]?.toUpperCase()}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-[#1A1D27] ${selectedSocketId ? 'bg-[#059669]' : 'bg-[#8B92A9]'}`}/>
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{selectedUsername}</p>
                  <p className={`text-[10px] mt-0.5 ${selectedSocketId ? 'text-[#059669] dark:text-[#34D399]' : 'text-[#8B92A9] dark:text-[#565C75]'}`}>
                    {selectedSocketId ? 'Online' : 'Offline'}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Support Chat</p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9] dark:text-[#565C75] transition"
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
              <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">Choose a user from the sidebar to start chatting</p>
            </div>
          ) : (chats[selectedUsername] || []).length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-[12px] text-[#8B92A9] dark:text-[#565C75]">No messages yet. Say hello!</p>
            </div>
          ) : (
            (chats[selectedUsername] || []).map((c, i) => {
              const isAdmin = c.from === 'Admin';
              return (
                <div key={i} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[72%] px-3 py-2 rounded-2xl text-[12px] leading-relaxed ${
                    isAdmin
                      ? 'bg-[#2563EB] text-white rounded-br-sm'
                      : 'bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[#0F1117] dark:text-[#F0F2FA] rounded-bl-sm'
                  }`}>
                    {!isAdmin && (
                      <p className="text-[10px] font-bold text-[#2563EB] dark:text-[#4F8EF7] mb-0.5">{c.from}</p>
                    )}
                    {c.message}
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
                User is offline — message will be delivered when they reconnect
              </p>
            )}
            <div className="flex items-center gap-2">
              <input
                value={message}
                placeholder={selectedSocketId ? 'Type a message…' : 'Send offline message…'}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                className="flex-1 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] dark:placeholder:text-[#565C75] focus:outline-none focus:border-[#2563EB] transition"
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
}