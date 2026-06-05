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
// Backend Admin model stores: "super_admin" | "admin"
// adminAuthController.js login response sends admin.role directly.
// This helper handles any casing/spacing variant defensively.
function normalizeRole(raw) {
  if (!raw) return '';
  const s = String(raw).toLowerCase().trim();
  // "super_admin", "superadmin", "super admin" → canonical "super_admin"
  if (s === 'super_admin' || s === 'superadmin' || s === 'super admin') return 'super_admin';
  if (s === 'admin') return 'admin';
  return s;
}

// ── Resolve companyId from localStorage user object ───────────────────────────
// Login response shape (adminAuthController.js):
//   { _id, name, email, company: admin.company._id, role, token, plan }
// So user.company is a plain ObjectId string.
// Defensively also handles user.companyId and populated user.company._id.
function resolveCompanyId(user) {
  if (!user) return '';
  // Explicit companyId field (some older login responses)
  if (user.companyId && typeof user.companyId === 'string') return user.companyId;
  if (user.company) {
    // Plain ObjectId string — the normal case from adminAuthController loginAdmin
    if (typeof user.company === 'string') return user.company;
    // Populated object (e.g. from register response which returns admin.company before _id is extracted)
    if (typeof user.company === 'object' && user.company._id) return String(user.company._id);
  }
  return '';
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
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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

    // Only admin and super_admin get notifications
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
    // Pulls the next 30 days of expiring companies from the REST endpoint so the
    // bell is pre-populated right after login, before the cron fires.
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

          // Group by urgency for a single digest notification
          const critical = data.companies.filter(c => c.daysLeft <= 1);
          const warning  = data.companies.filter(c => c.daysLeft > 1 && c.daysLeft <= 3);
          const notice   = data.companies.filter(c => c.daysLeft > 3);

          const total = data.total;
          const mostUrgent = critical.length > 0 ? 'critical'
                           : warning.length  > 0 ? 'warning'
                           : 'notice';

          const emoji   = mostUrgent === 'critical' ? '🚨' : mostUrgent === 'warning' ? '⚠️' : '📋';
          const urgency = mostUrgent === 'critical' || mostUrgent === 'warning';

          // Build one summary notification + one per critical company
          addNotification({
            id:        'sub-expiry-digest',
            type:      'subscription_expiry',
            title:     `${emoji} ${total} Subscription${total > 1 ? 's' : ''} Expiring Soon`,
            body:      critical.length
              ? `${critical.length} plan${critical.length > 1 ? 's' : ''} expire today/tomorrow. Immediate action needed.`
              : `${total} subscription${total > 1 ? 's' : ''} expiring within 7 days.`,
            companies: data.companies,
            critical:  critical.length,
            warning:   warning.length,
            notice:    notice.length,
            timestamp: new Date().toISOString(),
            urgent:    urgency,
          });

          // Also fire individual notifications for critical (≤1 day) companies
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

    // ── Join the correct room(s) ──────────────────────────────────────────────
    //
    // Backend socketHandler.js room mapping:
    //   admin_join       → joins  admin:${adminId}
    //                      receives: no_action_alert, follow_up_alert,
    //                                pushPendingFollowUps on connect
    //                      SCOPED: only leads where assignedAdmin === this admin
    //
    //   super_admin_join → joins  superadmin:${adminId}
    //                      receives: lead_reassigned_notify only
    //                      does NOT receive follow-up / no-action alerts
    //
    // admin role:       emits admin_join only
    // super_admin role: emits super_admin_join only (no follow-up alerts for them)
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
    // Emitted to room admin:${adminId} and superadmin:${adminId} by fcmService.sendNoActionAlert
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
    // Emitted to room admin:${adminId} and superadmin:${adminId} by fcmService.sendFollowUpAlert
    // Also pushed immediately on connect by socketHandler.pushPendingFollowUps
    // Upserts by stable id so reconnects don't stack duplicate notifications.
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
      setNotifications(prev => {
        const exists = prev.some(n => n.id === notif.id);
        if (exists) {
          return prev.map(n => n.id === notif.id ? notif : n);
        }
        setUnreadCount(c => c + 1);
        return [notif, ...prev].slice(0, MAX_NOTIFS);
      });
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(notif.title, { body: notif.body, icon: '/skyup_logo1.svg' });
      }
    });

    // ── lead_reassigned_notify ────────────────────────────────────────────────
    // Emitted to room superadmin:${superAdmin._id} by fcmService.notifySuperAdminReassignment
    socket.on('lead_reassigned_notify', ({ leadId, leadName, fromAdminName, toUserName, reason, timestamp }) => {
      addNotification({
        id:           `reassign-${Date.now()}`,
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
      });
    });

    // ── subscription_expiry_alert ─────────────────────────────────────────────
    // Emitted to room superadmin:${adminId} by subscriptionExpiryJob after the
    // daily cron runs.  Keeps the bell in sync without a page reload.
    if (isSuperAdmin) {
      socket.on('subscription_expiry_alert', ({ totalExpiring, critical, warning, notice, companies, timestamp }) => {
        if (!totalExpiring) return;

        const emoji   = critical > 0 ? '🚨' : warning > 0 ? '⚠️' : '📋';
        const urgency = critical > 0 || warning > 0;

        // Upsert the digest notification (replaces the REST-fetched one if present)
        const notif = {
          id:        'sub-expiry-digest',
          type:      'subscription_expiry',
          title:     `${emoji} ${totalExpiring} Subscription${totalExpiring > 1 ? 's' : ''} Expiring Soon`,
          body:      critical > 0
            ? `${critical} plan${critical > 1 ? 's' : ''} expire today/tomorrow. Immediate action needed.`
            : `${totalExpiring} subscription${totalExpiring > 1 ? 's' : ''} expiring within 7 days.`,
          companies: companies || [],
          critical,
          warning,
          notice,
          timestamp: timestamp || new Date().toISOString(),
          urgent:    urgency,
        };

        setNotifications(prev => {
          const exists = prev.some(n => n.id === notif.id);
          if (exists) return prev.map(n => n.id === notif.id ? notif : n);
          setUnreadCount(c => c + 1);
          return [notif, ...prev].slice(0, MAX_NOTIFS);
        });

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
  const panelRef = useRef(null);

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
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1A1D27] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition"
        title="Notifications"
      >
        <BellIcon className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
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

  // For subscription expiry: show company chips instead of lead chips
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
          {showCompanies && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {notif.companies.slice(0, 3).map((c, i) => {
                const chipColor =
                  (c.daysLeft ?? 99) <= 1 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  : (c.daysLeft ?? 99) <= 3 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                  : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400';
                return (
                  <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${chipColor}`}>
                    {c.name}{c.daysLeft != null ? ` · ${c.daysLeft}d` : ''}
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