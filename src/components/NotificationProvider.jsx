/**
 * NotificationProvider.jsx
 *
 * Provides a global notification system for Admin and SuperAdmin roles.
 * Listens for three server-sent socket events:
 *   • no_action_alert       — lead(s) assigned with no call/remark for 1h or 2h
 *   • follow_up_alert       — overdue or today-due follow-up calls
 *   • lead_reassigned_notify— a lead was manually reassigned (super_admin only)
 *
 * Exposes <NotificationBell /> — a bell icon for the CompanyHeader bar that
 * shows an unread badge and opens a dropdown panel listing all notifications.
 *
 * Usage:
 *   1. Wrap AppLayout (or AppInner) with <NotificationProvider>
 *   2. Place <NotificationBell /> inside CompanyHeader
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// ── Socket URL (same logic used by Adminchat + UserDashboard) ────────────────
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
    : 'https://skyup-crm-backend.onrender.com');

// ── Context ───────────────────────────────────────────────────────────────────
const NotificationContext = createContext(null);

export function useNotifications() {
  return useContext(NotificationContext);
}

// ── Max notifications to keep in memory ──────────────────────────────────────
const MAX_NOTIFS = 50;

// ── Helper — human-readable timestamp ────────────────────────────────────────
function timeLabel(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const socketRef = useRef(null);

  // Read user from localStorage; re-read whenever another component writes it
  // (e.g. after login, localStorage.setItem('user', ...) fires a 'storage' event)
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'user') {
        try { setUser(JSON.parse(e.newValue)); } catch { setUser(null); }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addNotification = useCallback((notif) => {
    setNotifications(prev => {
      const next = [notif, ...prev].slice(0, MAX_NOTIFS);
      return next;
    });
    setUnreadCount(c => c + 1);

    // Native browser notification (if user granted permission)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(notif.title, { body: notif.body, icon: '/skyup_logo1.svg' });
    }
  }, []);

  const markAllRead = useCallback(() => setUnreadCount(0), []);
  const clearAll    = useCallback(() => { setNotifications([]); setUnreadCount(0); }, []);

  useEffect(() => {
    // Only run for admin / superadmin roles
    if (!user) return;
    const role = (user?.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'superadmin' && role !== 'super_admin') return;

    const adminId     = user._id || user.id || '';
    const companyId   = user.companyId || user.company?._id || user.company || '';
    const displayName = user.name || 'Admin';
    const isSuperAdmin = role === 'superadmin' || role === 'super_admin';

    if (!adminId || !companyId) return;

    // Request browser notification permission once
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const socket = io(SOCKET_URL, { withCredentials: true });
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

    // ── no_action_alert ───────────────────────────────────────────────────────
    socket.on('no_action_alert', ({ count, threshold, leads, timestamp }) => {
      const thresholdLabel =
        threshold === '1h' ? '1 hour' :
        threshold === '2h' ? '2 hours' : '24 hours';
      const urgency = threshold === '2h' ? '🚨' : '⚠️';
      addNotification({
        id:        `noa-${Date.now()}`,
        type:      'no_action',
        title:     `${urgency} ${count} Lead${count > 1 ? 's' : ''} — No Action`,
        body:      count === 1
          ? `"${leads?.[0]?.leadName}" has had no activity for ${thresholdLabel}.`
          : `${count} leads have had no activity for ${thresholdLabel}.`,
        leads:     leads || [],
        threshold,
        timestamp: timestamp || new Date().toISOString(),
        urgent:    threshold === '2h',
      });
    });

    // ── follow_up_alert ───────────────────────────────────────────────────────
    socket.on('follow_up_alert', ({ type, count, leads, timestamp }) => {
      const isOverdue = type === 'overdue';
      addNotification({
        id:        `fu-${Date.now()}`,
        type:      'follow_up',
        title:     isOverdue
          ? `🔴 ${count} Overdue Follow-Up${count > 1 ? 's' : ''}`
          : `🟡 ${count} Follow-Up${count > 1 ? 's' : ''} Due Today`,
        body:      count === 1
          ? `"${leads?.[0]?.leadName}" — ${isOverdue ? 'overdue' : 'due today'}.`
          : `${count} leads need follow-up ${isOverdue ? '(overdue)' : 'today'}.`,
        leads:     leads || [],
        subType:   type,
        timestamp: timestamp || new Date().toISOString(),
        urgent:    isOverdue,
      });
    });

    // ── lead_reassigned_notify (super_admin only) ─────────────────────────────
    socket.on('lead_reassigned_notify', ({ leadId, leadName, fromAdminName, toUserName, reason, timestamp }) => {
      addNotification({
        id:        `reassign-${Date.now()}`,
        type:      'reassignment',
        title:     '🔄 Lead Reassigned',
        body:      `"${leadName}" moved from ${fromAdminName} → ${toUserName}${reason ? ` — ${reason}` : ''}`,
        leadId,
        leadName,
        fromAdminName,
        toUserName,
        reason:    reason || '',
        timestamp: timestamp || new Date().toISOString(),
        urgent:    false,
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, addNotification]); // re-runs when user logs in/out

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

// ── Bell Icon ──────────────────────────────────────────────────────────────────
function BellIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

// ── Notification Bell (place inside CompanyHeader) ────────────────────────────
export function NotificationBell() {
  const ctx = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!ctx) return null;
  const { notifications, unreadCount, markAllRead, clearAll } = ctx;

  const handleOpen = () => {
    setOpen(v => !v);
    if (!open && unreadCount > 0) markAllRead();
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1D27] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition"
        title="Notifications"
      >
        <BellIcon className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-11 z-[300] w-80 bg-white dark:bg-[#1A1D27] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: '480px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-[#13161E]">
            <span className="text-[13px] font-bold text-gray-800 dark:text-white">Notifications</span>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-[11px] text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition font-semibold"
              >
                Clear all
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <BellIcon className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                <p className="text-[12px] text-gray-400 dark:text-gray-500">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {notifications.map((n) => (
                  <NotificationItem key={n.id} notif={n} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single notification row ───────────────────────────────────────────────────
function NotificationItem({ notif }) {
  const bgClass = notif.urgent
    ? 'bg-red-50 dark:bg-red-950/20'
    : 'hover:bg-gray-50 dark:hover:bg-white/[0.02]';

  const dotColor =
    notif.type === 'reassignment' ? 'bg-blue-500' :
    notif.urgent                  ? 'bg-red-500'  :
    notif.subType === 'overdue'   ? 'bg-red-500'  :
    notif.type === 'follow_up'    ? 'bg-yellow-400':
                                    'bg-amber-500';

  return (
    <div className={`px-4 py-3 ${bgClass} transition`}>
      <div className="flex items-start gap-2.5">
        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-gray-800 dark:text-gray-200 leading-snug">
            {notif.title}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug line-clamp-2">
            {notif.body}
          </p>
          {notif.leads?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {notif.leads.slice(0, 3).map((l, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 font-medium">
                  {l.leadName}
                </span>
              ))}
              {notif.leads.length > 3 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 font-medium">
                  +{notif.leads.length - 3} more
                </span>
              )}
            </div>
          )}
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
            {timeLabel(notif.timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
}
