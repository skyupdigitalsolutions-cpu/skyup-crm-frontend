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
import api from '../data/axiosConfig';
import { AlertOctagon, AlertTriangle, ClipboardList, RefreshCw, MessageCircle, CheckCircle2, MapPin, Bell } from 'lucide-react';

// ── Socket URL ────────────────────────────────────────────────────────────────
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
    : 'https://skyup-crm-backend.onrender.com');

// ── API base URL — full URL needed for fetch() which has no axios baseURL ─────
const API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.origin !== 'null'
    ? `${window.location.origin}/api`
    : 'https://skyup-crm-backend.onrender.com/api');

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
// Returns { notifications: [], isNew: bool }
// isNew=true  → caller should increment badge + fire browser Notification
// isNew=false → existing entry was updated in-place; no badge change, no browser popup
function upsertNotification(prev, notif) {
  const exists = prev.some(n => n.id === notif.id);
  if (exists) {
    return { notifications: prev.map(n => n.id === notif.id ? notif : n), isNew: false };
  }
  return { notifications: [notif, ...prev].slice(0, MAX_NOTIFS), isNew: true };
}

// Helper: upsert + conditionally fire badge + browser push
function handleUpsert(notif, setNotifications, setUnreadCount) {
  let wasNew = false;
  setNotifications(prev => {
    const result = upsertNotification(prev, notif);
    wasNew = result.isNew;
    return result.notifications;
  });
  // Use setTimeout(0) so the state update settles before we check wasNew
  setTimeout(() => {
    if (wasNew) {
      setUnreadCount(c => c + 1);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(notif.title, { body: notif.body, icon: '/skyup_logo1.svg' });
      }
    }
  }, 0);
}

// ── Provider ──────────────────────────────────────────────────────────────────
// ── Module-level Set tracks which adminIds have already received their
// initial pushPendingFollowUps this browser session.
// Using a module-level ref (not component state) means it survives
// React re-renders and effect re-runs — so even if the user object
// changes reference (triggering a new socket), we don't re-emit admin_join
// and trigger duplicate follow-up notifications.
const _joinedAdminIds = new Set();

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
    if (!user) {
      // User logged out — clear the joined-admins Set so next login gets fresh notifications
      _joinedAdminIds.clear();
      return;
    }

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
    if (isSuperAdmin) {
      api.get('/superadmin/expiring-subscriptions?days=30')
        .then(res => {
          const data = res.data;
          if (!data?.companies?.length) return;

          const critical = data.companies.filter(c => c.daysRemaining <= 1);
          const warning  = data.companies.filter(c => c.daysRemaining > 1 && c.daysRemaining <= 3);
          const notice   = data.companies.filter(c => c.daysRemaining > 3);

          const total = data.companies.length;
          const mostUrgent = critical.length > 0 ? 'critical'
                           : warning.length  > 0 ? 'warning'
                           : 'notice';

          const emoji   = '';
          const urgency = mostUrgent === 'critical' || mostUrgent === 'warning';

          addNotification({
            id:        'sub-expiry-digest',
            type:      'subscription_expiry',
            title:     `${total} Subscription${total > 1 ? 's' : ''} Expiring Soon`,
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

          critical.forEach(c => {
            addNotification({
              id:        `sub-critical-${c._id}`,
              type:      'subscription_expiry',
              title:     `Subscription Expires Today — ${c.name}`,
              body:      `${c.name}'s ${(c.plan || 'plan').charAt(0).toUpperCase() + (c.plan || 'plan').slice(1)} plan expires today or tomorrow. Renew immediately.`,
              companies: [c],
              timestamp: new Date().toISOString(),
              urgent:    true,
            });
          });
        })
        .catch(err => {
          console.debug('[NotificationProvider] expiry fetch skipped:', err?.response?.status || err.message);
        });
    }

    const token  = localStorage.getItem('token');

    // Disconnect any lingering socket from a previous effect run before creating a new one.
    // Without this, a fast user→null→user cycle leaves a half-connected socket that
    // causes "WebSocket closed before the connection is established" errors.
    if (socketRef.current) {
      socketRef.current.off();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      transports:      ['websocket', 'polling'],
      auth:            token ? { token } : undefined,
      reconnection:        true,
      reconnectionAttempts: 10,
      reconnectionDelay:    2000,
    });
    socketRef.current = socket;

    // hasJoined guard — uses module-level Set so it survives React effect re-runs.
    // Even if the user object changes reference (causing effect cleanup+rerun),
    // admin_join is only emitted once per adminId per browser session.
    // It IS cleared on logout (user_changed with null user) via _joinedAdminIds.delete().
    const doJoin = () => {
      if (_joinedAdminIds.has(adminId)) return;  // already joined this session
      _joinedAdminIds.add(adminId);
      if (isSuperAdmin) {
        console.debug('[NotificationProvider] emitting super_admin_join');
        socket.emit('super_admin_join', { adminId, company: companyId, displayName });
      } else {
        console.debug('[NotificationProvider] emitting admin_join');
        socket.emit('admin_join', { adminId, company: companyId, displayName });
      }
      socket.emit('wa_admin_join');
    };

    socket.on('connect', doJoin);
    if (socket.connected) doJoin();

    socket.on('connect_error', (err) => {
      console.error('[NotificationProvider] socket connect_error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.debug('[NotificationProvider] socket disconnected:', reason);
    });

    socket.on('no_action_alert', ({ count, threshold, leads, timestamp }) => {
      const thresholdLabel =
        threshold === '1h' ? '1 hour' :
        threshold === '2h' ? '2 hours' :
        threshold === '3h' ? '3 hours' : '24 hours';
      const notif = {
        id:        `noa-${threshold}`,
        type:      'no_action',
        title:     `${count} Lead${count > 1 ? 's' : ''} — No Action`,
        body:      count === 1
          ? `"${leads?.[0]?.leadName}" has had no activity for ${thresholdLabel}.`
          : `${count} leads have had no activity for ${thresholdLabel}.`,
        leads:     leads || [],
        threshold,
        timestamp: timestamp || new Date().toISOString(),
        urgent:    threshold === '2h' || threshold === '3h',
      };
      handleUpsert(notif, setNotifications, setUnreadCount);
    });

    socket.on('follow_up_alert', ({ type, count, leads, timestamp }) => {
      const isOverdue = type === 'overdue';
      const notif = {
        id:        `fu-${type}`,
        type:      'follow_up',
        title:     isOverdue
          ? `${count} Overdue Follow-Up${count > 1 ? 's' : ''}`
          : `${count} Follow-Up${count > 1 ? 's' : ''} Due Today`,
        body:      count === 1
          ? `"${leads?.[0]?.leadName}" — ${isOverdue ? 'overdue' : 'due today'}.`
          : `${count} leads need follow-up ${isOverdue ? '(overdue)' : 'today'}.`,
        leads:     leads || [],
        subType:   type,
        timestamp: timestamp || new Date().toISOString(),
        urgent:    isOverdue,
      };
      handleUpsert(notif, setNotifications, setUnreadCount);
    });

    socket.on('lead_reassigned_notify', ({ leadId, leadName, fromAdminName, toUserName, reason, timestamp }) => {
      const notif = {
        id:           `reassign-${leadId}`,
        type:         'reassignment',
        title:        'Lead Reassigned',
        body:         `"${leadName}" moved from ${fromAdminName} → ${toUserName}${reason ? ` — ${reason}` : ''}`,
        leadId,
        leadName,
        fromAdminName,
        toUserName,
        reason:       reason || '',
        timestamp:    timestamp || new Date().toISOString(),
        urgent:       false,
      };
      handleUpsert(notif, setNotifications, setUnreadCount);
    });

    // ── subscription_expiry_alert ─────────────────────────────────────────────
    // Emitted to room superadmin:${adminId} by subscriptionExpiryJob after the
    // daily cron runs.  Keeps the bell in sync without a page reload.
    if (isSuperAdmin) {
      socket.on('subscription_expiry_alert', ({ totalExpiring, critical, warning, notice, companies, timestamp }) => {
        if (!totalExpiring) return;

        const emoji   = '';
        const urgency = critical > 0 || warning > 0;

        const notif = {
          id:        'sub-expiry-digest',
          type:      'subscription_expiry',
          title:     `${totalExpiring} Subscription${totalExpiring > 1 ? 's' : ''} Expiring Soon`,
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

        handleUpsert(notif, setNotifications, setUnreadCount);
      });
    }

    // wa_new_lead — new lead created from WhatsApp webhook.
    // Only wired in WhatsAppChat before; now handled here so the bell
    // updates on any page the admin is viewing.
    socket.on('wa_new_lead', ({ lead }) => {
      const leadName = lead?.name || 'New Lead';
      const source   = lead?.source || 'WhatsApp';
      addNotification({
        id:        `wa-lead-${lead?._id || Date.now()}`,
        type:      'new_lead',
        title:     'New WhatsApp Lead',
        body:      `${leadName} — ${source}`,
        timestamp: new Date().toISOString(),
        urgent:    false,
      });
    });

    // lead_closed_by_user — an employee closed a lead with a remark.
    // The backend (closeLeadByUser) emits this to admin_room:${adminId}, but
    // nothing was listening, so admins never saw a notification. Wire it here
    // so the bell updates on whatever page the admin is on.
    socket.on('lead_closed_by_user', ({ leadId, leadName, phone, remark, closedBy, closedAt }) => {
      handleUpsert({
        id:        `lead-closed-${leadId}`,
        type:      'lead_closed',
        title:     'Lead Closed',
        body:      `${closedBy || 'An employee'} closed "${leadName || 'a lead'}"${remark ? ` — ${remark}` : ''}`,
        leadId,
        leadName,
        phone:     phone || '',
        remark:    remark || '',
        closedBy:  closedBy || 'Employee',
        timestamp: closedAt || new Date().toISOString(),
        urgent:    false,
      }, setNotifications, setUnreadCount);
    });

    // meeting_permission_requested — an employee is requesting remote (client-
    // meeting) clock-in. Backend emits to admin_room:${adminId}, but nothing was
    // listening, so admins never knew a request came in and the employee stayed
    // blocked. Wire it here so the admin bell surfaces it and they can approve
    // from Employee Management.
    socket.on('meeting_permission_requested', ({ userId: empId, userName, reason, location, requestedAt }) => {
      handleUpsert({
        id:        `meeting-perm-${empId}`,
        type:      'meeting_permission',
        title:     'Remote Clock-in Request',
        body:      `${userName || 'An employee'} requested remote clock-in${location ? ` from ${location}` : ''}${reason ? ` — ${reason}` : ''}. Approve in Employee Management.`,
        userId:    empId,
        userName:  userName || 'Employee',
        reason:    reason || '',
        location:  location || '',
        timestamp: requestedAt || new Date().toISOString(),
        urgent:    true,
      }, setNotifications, setUnreadCount);
    });

    return () => {
      socket.off();           // remove all listeners before disconnect
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id || user?.id]); // stable string dep — prevents effect re-run on object re-parse

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

export function NotificationBell() {
  const ctx = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef  = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        panelRef.current  && !panelRef.current.contains(e.target) &&
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
        className="relative w-9 h-9 flex items-center justify-center rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#6B7280] dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition"
        title="Notifications"
      >
        <BellIcon className="w-3.5 h-3.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none px-0.5 z-10">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 z-[500] w-[320px] bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl overflow-hidden"
          style={{ maxHeight: '480px', top: '100%' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F0F2FA] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]">
            <div className="flex items-center gap-2">
              <BellIcon className="w-3.5 h-3.5 text-[#2563EB]" />
              <span className="text-[13px] font-bold text-[#0F1117] dark:text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-[11px] text-[#8B92A9] hover:text-red-500 dark:hover:text-red-400 transition font-semibold"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Body */}
          <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-12 h-12 rounded-full bg-[#F1F4FF] dark:bg-[#262A38] flex items-center justify-center">
                  <BellIcon className="w-5 h-5 text-[#C4C9D9] dark:text-[#3E4257]" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">All caught up!</p>
                  <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">No new notifications</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[#F0F2FA] dark:divide-[#262A38]">
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
    ? 'bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30'
    : notif.type === 'subscription_expiry'
      ? 'bg-amber-50 dark:bg-amber-950/15 hover:bg-amber-100 dark:hover:bg-amber-950/25'
      : 'hover:bg-[#F8F9FC] dark:hover:bg-[#13161E]';
  const dotColor =
    notif.type === 'subscription_expiry' && notif.critical > 0 ? 'bg-red-500'    :
    notif.type === 'subscription_expiry' && notif.warning  > 0 ? 'bg-amber-400'  :
    notif.type === 'subscription_expiry'                        ? 'bg-indigo-400' :
    notif.type === 'reassignment'                               ? 'bg-blue-500'   :
    notif.urgent                                                ? 'bg-red-500'    :
    notif.subType === 'overdue'                                 ? 'bg-red-500'    :
    notif.type === 'follow_up'                                  ? 'bg-amber-400'  :
    notif.type === 'new_lead'                                   ? 'bg-emerald-500':
    notif.type === 'lead_closed'                                ? 'bg-green-500'  :
    notif.type === 'meeting_permission'                         ? 'bg-orange-500' :
                                                                  'bg-amber-500';

  const showCompanies = notif.type === 'subscription_expiry' && notif.companies?.length > 0;
  const showLeads     = !showCompanies && notif.leads?.length > 0;

  return (
    <div className={`px-4 py-3 transition cursor-default ${bgClass}`}>
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 shrink-0 ${dotColor.replace('bg-', 'text-')}`}>
          {(() => {
            const C = notif.type === 'subscription_expiry' && notif.critical > 0 ? AlertOctagon :
                      notif.type === 'subscription_expiry' && notif.warning  > 0 ? AlertTriangle :
                      notif.type === 'subscription_expiry' ? ClipboardList :
                      notif.type === 'reassignment' ? RefreshCw :
                      notif.urgent ? AlertOctagon :
                      notif.subType === 'overdue' ? AlertTriangle :
                      notif.type === 'follow_up' ? AlertTriangle :
                      notif.type === 'new_lead' ? MessageCircle :
                      notif.type === 'lead_closed' ? CheckCircle2 :
                      notif.type === 'meeting_permission' ? MapPin : Bell;
            return <C className="w-3.5 h-3.5" />;
          })()}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] leading-snug">
            {notif.title}
          </p>
          <p className="text-[11px] text-[#4B5168] dark:text-[#9DA3BB] mt-0.5 leading-snug line-clamp-2">
            {notif.body}
          </p>

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
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F1F4FF] dark:bg-[#262A38] text-[#8B92A9] font-medium">
                  +{notif.companies.length - 3} more
                </span>
              )}
            </div>
          )}

          {showLeads && (
            <div className="flex flex-wrap gap-1 mt-1">
              {notif.leads.slice(0, 3).map((l, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F1F4FF] dark:bg-[#262A38] text-[#8B92A9] font-medium">
                  {l.leadName}
                </span>
              ))}
              {notif.leads.length > 3 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F1F4FF] dark:bg-[#262A38] text-[#8B92A9] font-medium">
                  +{notif.leads.length - 3} more
                </span>
              )}
            </div>
          )}

          <p className="text-[10px] text-[#8B92A9] dark:text-[#565C75] mt-1">
            {timeLabel(notif.timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
}
