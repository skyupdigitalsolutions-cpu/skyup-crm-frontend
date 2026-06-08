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
 *
 * FIXES APPLIED:
 *   1. no_action_alert     — changed id from `noa-${Date.now()}` to `noa-${threshold}`
 *                            and added upsert logic (same as follow_up_alert).
 *                            Stops the same alert spamming every 15-min cron tick.
 *   2. daysLeft → daysRemaining — API returns `daysRemaining`, frontend was reading
 *                            `daysLeft` (always undefined). Fixed everywhere.
 *   3. lead_reassigned_notify — changed id from `reassign-${Date.now()}` to
 *                            `reassign-${leadId}` to prevent duplicates per lead.
 *   4. panelRef placement  — moved ref from outer wrapper to the dropdown panel only,
 *                            so click-outside doesn't fight with the toggle button.
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

// ── Socket URL ────────────────────────────────────────────────────────────────
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
    : 'https://skyup-crm-backend.onrender.com');

// ── API base URL — used for the expiry subscription REST fetch ────────────────
const API_BASE =
  import.meta.env.VITE_API_URL || '/api';

// ── Context ───────────────────────────────────────────────────────────────────
const NotificationContext = createContext(null);

export function useNotifications() {
  return useContext(NotificationContext);
}

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

// ── Normalize role ────────────────────────────────────────────────────────────
function normalizeRole(raw) {
  if (!raw) return '';
  const s = String(raw).toLowerCase().trim();
  if (s === 'super_admin' || s === 'superadmin' || s === 'super admin') return 'super_admin';
  if (s === 'admin') return 'admin';
  return s;
}

// ── Resolve companyId from localStorage user object ───────────────────────────
function resolveCompanyId(user) {
  if (!user) return '';
  if (user.companyId && typeof user.companyId === 'string') return user.companyId;
  if (user.company) {
    if (typeof user.company === 'string') return user.company;
    if (typeof user.company === 'object' && user.company._id) return String(user.company._id);
  }
  return '';
}

// ── Upsert helper — replaces existing notification by id or prepends new ──────
function upsertNotification(prev, notif, setUnreadCount) {
  const exists = prev.some(n => n.id === notif.id);
  if (exists) {
    return prev.map(n => n.id === notif.id ? notif : n);
  }
  setUnreadCount(c => c + 1);
  return [notif, ...prev].slice(0, MAX_NOTIFS);
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const socketRef = useRef(null);

  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'user') {
        try { setUser(JSON.parse(e.newValue)); } catch { setUser(null); }
      }
    };
    const onUserChanged = () => {
      try { setUser(JSON.parse(localStorage.getItem('user'))); } catch { setUser(null); }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('user_changed', onUserChanged);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('user_changed', onUserChanged);
    };
  }, []);

  // addNotification — used for events that are always unique (not upserted)
  const addNotification = useCallback((notif) => {
    setNotifications(prev => [notif, ...prev].slice(0, MAX_NOTIFS));
    setUnreadCount(c => c + 1);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(notif.title, { body: notif.body, icon: '/skyup_logo1.svg' });
    }
  }, []);

  const markAllRead = useCallback(() => setUnreadCount(0), []);
  const clearAll    = useCallback(() => { setNotifications([]); setUnreadCount(0); }, []);

  useEffect(() => {
    if (!user) return;

    const role         = normalizeRole(user?.role);
    const adminId      = String(user._id || user.id || '');
    const companyId    = resolveCompanyId(user);
    const displayName  = user.name || 'Admin';
    const isSuperAdmin = role === 'super_admin';

    if (role !== 'admin' && role !== 'super_admin') {
      console.debug('[NotificationProvider] skipping — role not eligible:', role, '(raw:', user?.role, ')');
      return;
    }

    if (!adminId) {
      console.warn('[NotificationProvider] missing adminId — check localStorage user object:', user);
      return;
    }
    if (!companyId) {
      console.warn('[NotificationProvider] missing companyId — check localStorage user object:', user);
      return;
    }

    console.debug(
      '[NotificationProvider] init | role:', role,
      '| isSuperAdmin:', isSuperAdmin,
      '| adminId:', adminId,
      '| companyId:', companyId
    );

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    // ── SuperAdmin: Fetch expiring subscriptions on mount ─────────────────────
    // FIX #2: API returns `daysRemaining`, not `daysLeft`. All filter/display
    // references updated from c.daysLeft → c.daysRemaining.
    if (isSuperAdmin) {
      const token = user.token || localStorage.getItem('token');
      fetch(`${API_BASE}/superadmin/expiring-subscriptions?days=30`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
        .then(res => res.ok ? res.json() : Promise.reject(res.status))
        .then(data => {
          if (!data?.companies?.length) return;

          // FIX #2: was c.daysLeft — API sends c.daysRemaining
          const critical = data.companies.filter(c => c.daysRemaining <= 1);
          const warning  = data.companies.filter(c => c.daysRemaining > 1 && c.daysRemaining <= 3);
          const notice   = data.companies.filter(c => c.daysRemaining > 3);

          const total = data.companies.length;
          const mostUrgent = critical.length > 0 ? 'critical'
                           : warning.length  > 0 ? 'warning'
                           : 'notice';

          const emoji   = mostUrgent === 'critical' ? '🚨' : mostUrgent === 'warning' ? '⚠️' : '📋';
          const urgency = mostUrgent === 'critical' || mostUrgent === 'warning';

          addNotification({
            id:        'sub-expiry-digest',
            type:      'subscription_expiry',
            title:     `${emoji} ${total} Subscription${total > 1 ? 's' : ''} Expiring Soon`,
            body:      critical.length
              ? `${critical.length} plan${critical.length > 1 ? 's' : ''} expire today/tomorrow. Immediate action needed.`
              : `${total} subscription${total > 1 ? 's' : ''} expiring within 30 days.`,
            companies: data.companies,
            critical:  critical.length,
            warning:   warning.length,
            notice:    notice.length,
            timestamp: new Date().toISOString(),
            urgent:    urgency,
          });

          // Individual notifications for critical (≤1 day) companies
          critical.forEach(c => {
            addNotification({
              id:        `sub-critical-${c._id}`,
              type:      'subscription_expiry',
              title:     `🔴 Subscription Expires Today — ${c.name}`,
              body:      `${c.name}'s ${(c.plan || 'plan').charAt(0).toUpperCase() + (c.plan || 'plan').slice(1)} plan expires today or tomorrow. Renew immediately.`,
              companies: [c],
              timestamp: new Date().toISOString(),
              urgent:    true,
            });
          });
        })
        .catch(err => {
          console.debug('[NotificationProvider] expiry fetch skipped:', err);
        });
    }

    const socket = io(SOCKET_URL, { withCredentials: true });
    socketRef.current = socket;

    const doJoin = () => {
      if (isSuperAdmin) {
        console.debug('[NotificationProvider] emitting super_admin_join');
        socket.emit('super_admin_join', { adminId, company: companyId, displayName });
      } else {
        console.debug('[NotificationProvider] emitting admin_join');
        socket.emit('admin_join', { adminId, company: companyId, displayName });
      }
    };

    socket.on('connect', doJoin);
    if (socket.connected) doJoin();

    socket.on('connect_error', (err) => {
      console.error('[NotificationProvider] socket connect_error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.debug('[NotificationProvider] socket disconnected:', reason);
    });

    // ── no_action_alert ───────────────────────────────────────────────────────
    // FIX #1: was `noa-${Date.now()}` — unique every call → stacked duplicates
    // every 15-min cron tick.  Now uses stable `noa-${threshold}` + upsert so
    // repeated firings for the same threshold update in place, not stack.
    socket.on('no_action_alert', ({ count, threshold, leads, timestamp }) => {
      const thresholdLabel =
        threshold === '1h' ? '1 hour' :
        threshold === '2h' ? '2 hours' :
        threshold === '3h' ? '3 hours' : '24 hours';
      const urgency = (threshold === '2h' || threshold === '3h') ? '🚨' : '⚠️';
      const notif = {
        id:        `noa-${threshold}`,   // FIX: stable id per threshold
        type:      'no_action',
        title:     `${urgency} ${count} Lead${count > 1 ? 's' : ''} — No Action`,
        body:      count === 1
          ? `"${leads?.[0]?.leadName}" has had no activity for ${thresholdLabel}.`
          : `${count} leads have had no activity for ${thresholdLabel}.`,
        leads:     leads || [],
        threshold,
        timestamp: timestamp || new Date().toISOString(),
        urgent:    threshold === '2h' || threshold === '3h',
      };
      // Upsert — same pattern as follow_up_alert
      setNotifications(prev => upsertNotification(prev, notif, setUnreadCount));
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(notif.title, { body: notif.body, icon: '/skyup_logo1.svg' });
      }
    });

    // ── follow_up_alert ───────────────────────────────────────────────────────
    // Already correct: uses stable id `fu-${type}` + upsert. Unchanged.
    socket.on('follow_up_alert', ({ type, count, leads, timestamp }) => {
      const isOverdue = type === 'overdue';
      const notif = {
        id:        `fu-${type}`,
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
      };
      setNotifications(prev => upsertNotification(prev, notif, setUnreadCount));
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(notif.title, { body: notif.body, icon: '/skyup_logo1.svg' });
      }
    });

    // ── lead_reassigned_notify ────────────────────────────────────────────────
    // FIX #3: was `reassign-${Date.now()}` — duplicated on reconnect.
    // Now uses `reassign-${leadId}` so same lead doesn't stack multiple entries.
    socket.on('lead_reassigned_notify', ({ leadId, leadName, fromAdminName, toUserName, reason, timestamp }) => {
      const notif = {
        id:           `reassign-${leadId}`,   // FIX: stable id per lead
        type:         'reassignment',
        title:        '🔄 Lead Reassigned',
        body:         `"${leadName}" moved from ${fromAdminName} → ${toUserName}${reason ? ` — ${reason}` : ''}`,
        leadId,
        leadName,
        fromAdminName,
        toUserName,
        reason:       reason || '',
        timestamp:    timestamp || new Date().toISOString(),
        urgent:       false,
      };
      setNotifications(prev => upsertNotification(prev, notif, setUnreadCount));
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(notif.title, { body: notif.body, icon: '/skyup_logo1.svg' });
      }
    });

    // ── subscription_expiry_alert ─────────────────────────────────────────────
    // Emitted to room superadmin:${adminId} by subscriptionExpiryJob after the
    // daily cron runs.  Keeps the bell in sync without a page reload.
    if (isSuperAdmin) {
      socket.on('subscription_expiry_alert', ({ totalExpiring, critical, warning, notice, companies, timestamp }) => {
        if (!totalExpiring) return;

        const emoji   = critical > 0 ? '🚨' : warning > 0 ? '⚠️' : '📋';
        const urgency = critical > 0 || warning > 0;

        const notif = {
          id:        'sub-expiry-digest',
          type:      'subscription_expiry',
          title:     `${emoji} ${totalExpiring} Subscription${totalExpiring > 1 ? 's' : ''} Expiring Soon`,
          body:      critical > 0
            ? `${critical} plan${critical > 1 ? 's' : ''} expire today/tomorrow. Immediate action needed.`
            : `${totalExpiring} subscription${totalExpiring > 1 ? 's' : ''} expiring within 30 days.`,
          companies: companies || [],
          critical,
          warning,
          notice,
          timestamp: timestamp || new Date().toISOString(),
          urgent:    urgency,
        };

        setNotifications(prev => upsertNotification(prev, notif, setUnreadCount));

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(notif.title, { body: notif.body, icon: '/skyup_logo1.svg' });
        }
      });
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, addNotification]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

// ── Bell Icon ─────────────────────────────────────────────────────────────────
function BellIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

// ── Notification Bell ─────────────────────────────────────────────────────────
export function NotificationBell() {
  const ctx = useNotifications();
  const [open, setOpen] = useState(false);
  // FIX #4: panelRef is now on the dropdown div only (not the outer wrapper).
  // Previously the ref wrapped the button too, causing the click-outside handler
  // to fight with the toggle — clicking the button to close would reopen instantly.
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      // Close if clicked outside both the panel AND the button
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
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
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1D27] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition"
        title="Notifications"
      >
        <BellIcon className="w-3.5 h-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-11 z-[300] w-80 bg-white dark:bg-[#1A1D27] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: '480px' }}
        >
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
    : notif.type === 'subscription_expiry'
      ? 'bg-amber-50 dark:bg-amber-950/15'
      : 'hover:bg-gray-50 dark:hover:bg-white/[0.02]';

  const dotColor =
    notif.type === 'subscription_expiry' && notif.critical > 0 ? 'bg-red-500'    :
    notif.type === 'subscription_expiry' && notif.warning  > 0 ? 'bg-amber-400'  :
    notif.type === 'subscription_expiry'                        ? 'bg-indigo-400' :
    notif.type === 'reassignment'                               ? 'bg-blue-500'   :
    notif.urgent                                                ? 'bg-red-500'    :
    notif.subType === 'overdue'                                 ? 'bg-red-500'    :
    notif.type === 'follow_up'                                  ? 'bg-yellow-400' :
                                                                  'bg-amber-500';

  const showCompanies = notif.type === 'subscription_expiry' && notif.companies?.length > 0;
  const showLeads     = !showCompanies && notif.leads?.length > 0;

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

          {/* Subscription expiry: show company chips */}
          {/* FIX #2: was c.daysLeft — API sends c.daysRemaining */}
          {showCompanies && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {notif.companies.slice(0, 3).map((c, i) => {
                const days = c.daysRemaining ?? c.daysLeft ?? 99;
                const chipColor =
                  days <= 1 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  : days <= 3 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                  : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400';
                return (
                  <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${chipColor}`}>
                    {c.name}{days !== 99 ? ` · ${days}d` : ''}
                  </span>
                );
              })}
              {notif.companies.length > 3 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 font-medium">
                  +{notif.companies.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Lead alerts: show lead name chips */}
          {showLeads && (
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
