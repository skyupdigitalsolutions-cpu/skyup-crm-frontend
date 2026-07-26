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
 *   5. MOBILE FIX          — Notification panel now uses a portal + fixed positioning
 *                            that clamps to viewport edges. Prevents left-overflow on
 *                            narrow mobile screens when the bell is near screen edges.
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../data/axiosConfig';
import { AlertOctagon, AlertTriangle, ClipboardList, RefreshCw, MessageCircle, CheckCircle2, MapPin, Bell } from 'lucide-react';

// ── Socket URL ────────────────────────────────────────────────────────────────
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL.replace(/\/api$/, '')
    

// ── API base URL — full URL needed for fetch() which has no axios baseURL ─────
const API_BASE = import.meta.env.VITE_API_URL 

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
      return;
    }

    const role         = normalizeRole(user?.role);
    const adminId      = String(user._id || user.id || '');
    const companyId    = resolveCompanyId(user);
    const displayName  = user.name || 'Admin';
    const isSuperAdmin = role === 'super_admin';
    const isEmployee   = role === 'user';

    if (role !== 'admin' && role !== 'super_admin' && role !== 'user') {
      console.debug('[NotificationProvider] skipping — role not eligible:', role, '(raw:', user?.role, ')');
      return;
    }

    if (!adminId) {
      console.warn('[NotificationProvider] missing adminId — check localStorage user object:', user);
      return;
    }
    if (!companyId && !isEmployee) {
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

    // ── Fetch-on-open: seed the bell with CURRENTLY pending notifications ──────
    // Admin/super-admin only — this endpoint returns company-wide no-action and
    // follow-up state. Employees only receive live per-lead assignment events.
    if (!isEmployee) {
      api.get('/lead/admin/pending-notifications')
        .then(res => {
          const list = res.data?.notifications || [];
          list.forEach(notif => handleUpsert(notif, setNotifications, setUnreadCount));
        })
        .catch(err => {
          console.debug('[NotificationProvider] pending fetch skipped:', err?.response?.status || err.message);
        });
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

    // Join on every (re)connect. We must re-emit the join after a reconnect,
    // otherwise the server no longer knows this socket belongs to the admin's
    // room and silently stops delivering notifications. The previous code used
    // a persistent module-level Set that was never cleared on reconnect, so the
    // join fired once and never again after the first network blip — which made
    // the bell go dead until a full logout/login. We instead let socket.io call
    // `connect` on each (re)connection and always emit the join.
    const doJoin = () => {
      if (isEmployee) {
        // Employees join their personal agent room. leadController emits
        // 'new_lead_assigned' to agent:<userId> on every assignment/reassignment.
        console.debug('[NotificationProvider] emitting agent_join (employee)');
        socket.emit('agent_join', { userId: adminId });
        // Also join the WhatsApp-specific rooms so the bell can show inbound
        // lead replies live — mirrors what the admin panel already gets via
        // wa_admin below, and matches the rooms the chat page itself joins.
        console.debug('[NotificationProvider] emitting wa_agent_join / wa_company_join (employee)');
        socket.emit('wa_agent_join', { agentId: adminId });
        if (companyId) socket.emit('wa_company_join', { companyId });
        return;
      }
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

    // Employee clocked in / out — with their captured GPS location. Fired to
    // both admins and super admins (company_admin room). A fresh id per event
    // (userId + type + time) so each clock-in/out is its own notification.
    socket.on('attendance_location', ({ userId, name, type, latitude, longitude, accuracy, at }) => {
      if (latitude == null || longitude == null) return;
      const isIn = type === 'clock_in';
      const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}&z=17`;
      const notif = {
        id:        `attloc-${userId}-${type}-${at || Date.now()}`,
        type:      'attendance_location',
        title:     `${name || 'Employee'} clocked ${isIn ? 'in' : 'out'}`,
        body:      `Location: ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}${accuracy != null ? ` (±${Math.round(accuracy)}m)` : ''}`,
        mapsUrl,
        latitude,
        longitude,
        subType:   type,
        timestamp: at || new Date().toISOString(),
        urgent:    false,
      };
      handleUpsert(notif, setNotifications, setUnreadCount);
    });

    if (isSuperAdmin) {
      socket.on('subscription_expiry_alert', ({ totalExpiring, critical, warning, notice, companies, timestamp }) => {
        if (!totalExpiring) return;

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

    // Fires for the assigned employee on every new/reassigned lead. Emitted by
    // leadController to the agent:<userId> room the employee joined above.
    socket.on('new_lead_assigned', ({ leadId, leadName, source, eventType }) => {
      const isNewLead = !eventType || eventType === 'new';
      handleUpsert({
        id:        `new-lead-${leadId || Date.now()}`,
        type:      'new_lead',
        title:     isNewLead ? 'New Lead Assigned' : 'Lead Assigned to You',
        body:      `${leadName || 'New Lead'} — ${source || 'Web Form'}`,
        leadId,
        leadName:  leadName || 'New Lead',
        timestamp: new Date().toISOString(),
        urgent:    false,
      }, setNotifications, setUnreadCount);
    });

    // Fires whenever a lead sends a WhatsApp message — pushed to wa_admin
    // (admins/super admins) and to wa_agent_<id> / wa_company_<id> (employees,
    // joined above). We only surface INBOUND messages here (the lead replying)
    // — outbound sends the employee/admin just made themselves shouldn't ping
    // their own bell.
    socket.on('wa_message', (payload) => {
      const msg = payload?.message;
      if (!msg || msg.direction !== 'inbound') return;

      const name = payload.contactName || payload.waPhone || 'A lead';
      let bodyText =
        msg.messageType === 'text' || !msg.messageType
          ? (msg.body || '')
          : `[${msg.messageType}]`;
      if (bodyText.length > 120) bodyText = bodyText.slice(0, 120) + '…';

      handleUpsert({
        id:             `wa-msg-${msg._id || payload.conversationId + '-' + (msg.waTimestamp || Date.now())}`,
        type:           'whatsapp_message',
        title:          `New WhatsApp reply — ${name}`,
        body:           bodyText || '(no text)',
        leadId:         payload.leadId || null,
        conversationId: payload.conversationId || null,
        waPhone:        payload.waPhone || '',
        timestamp:      msg.waTimestamp || new Date().toISOString(),
        urgent:         false,
      }, setNotifications, setUnreadCount);
    });

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

    socket.on('lead_invalid_rejected', ({ leadId, leadName, remark, verifiedBy, returnedTo, at }) => {
      handleUpsert({
        id:        `lead-invalid-rejected-${leadId}`,
        type:      'lead_invalid_rejected',
        title:     'Invalid Rejected',
        body:      `${verifiedBy || 'A verifier'} rejected the Invalid mark on "${leadName || 'a lead'}" — returned to ${returnedTo || 'the original employee'}${remark ? ` — ${remark}` : ''}`,
        leadId,
        leadName,
        remark:    remark || '',
        timestamp: at || new Date().toISOString(),
        urgent:    false,
      }, setNotifications, setUnreadCount);
    });

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
      socket.off();
      socket.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id || user?.id]);

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

// ── MOBILE FIX: compute panel position clamped to viewport ───────────────────
// Anchors the panel below the button and aligned to its right edge,
// but clamps so it never overflows left or right viewport edges.
// PANEL_WIDTH must match the w-[320px] set on the panel div below.
const PANEL_WIDTH = 320;
const PANEL_MARGIN = 8; // min gap from screen edge

function getPanelStyle(buttonRef) {
  if (!buttonRef.current) return {};
  const rect = buttonRef.current.getBoundingClientRect();
  const vw   = window.innerWidth;

  // Ideal: right-align panel to button's right edge
  let left = rect.right - PANEL_WIDTH;

  // Clamp: don't overflow left or right edge
  left = Math.max(PANEL_MARGIN, left);
  left = Math.min(left, vw - PANEL_WIDTH - PANEL_MARGIN);

  return {
    position: 'fixed',
    top:      rect.bottom + 8,
    left,
    width:    PANEL_WIDTH,
    zIndex:   500,
  };
}

export function NotificationBell() {
  const ctx = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState({});
  const panelRef  = useRef(null);
  const buttonRef = useRef(null);

  // Click a notification → jump to the target lead's communication page.
  // Employees ('user' role) use /user/communications; admins use /communications.
  // The leadId is passed as a query param so the page auto-opens that lead's chat.
  const openNotif = useCallback((notif) => {
    if (!notif) return;
    let role = '';
    try { role = (JSON.parse(localStorage.getItem('user'))?.role || '').toLowerCase(); } catch { role = ''; }
    const base = role === 'user' ? '/user/communications' : '/communications';
    const isLeadNotif =
      notif.type === 'whatsapp_message' || notif.type === 'new_lead' ||
      notif.type === 'reassignment'     || notif.type === 'follow_up' ||
      notif.type === 'lead_closed'      || !!notif.leadId;
    if (!isLeadNotif) return;
    setOpen(false);
    navigate(notif.leadId ? `${base}?leadId=${notif.leadId}` : base);
  }, [navigate]);

  // Recompute position whenever panel opens or window resizes/scrolls
  useEffect(() => {
    if (!open) return;
    const update = () => setPanelStyle(getPanelStyle(buttonRef));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  // Close on outside click
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

  const panel = open ? (
    <div
      ref={panelRef}
      style={{ ...panelStyle, maxHeight: '480px' }}
      className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl shadow-2xl overflow-hidden"
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
              <NotificationItem key={n.id} notif={n} onOpen={openNotif} />
            ))}
          </div>
        )}
      </div>
    </div>
  ) : null;

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

      {/* Portal — renders outside the header stacking context so it's never clipped */}
      {panel && createPortal(panel, document.body)}
    </div>
  );
}

// ── Single notification row ───────────────────────────────────────────────────
function NotificationItem({ notif, onOpen }) {
  const clickable = !!(onOpen && (notif.leadId ||
    ['whatsapp_message', 'new_lead', 'reassignment', 'follow_up', 'lead_closed'].includes(notif.type)));
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
    notif.type === 'whatsapp_message'                           ? 'bg-green-500'  :
    notif.type === 'lead_closed'                                ? 'bg-green-500'  :
    notif.type === 'meeting_permission'                         ? 'bg-orange-500' :
                                                                  'bg-amber-500';

  const showCompanies = notif.type === 'subscription_expiry' && notif.companies?.length > 0;
  const showLeads     = !showCompanies && notif.leads?.length > 0;

  return (
    <div
      className={`px-4 py-3 transition ${clickable ? 'cursor-pointer' : 'cursor-default'} ${bgClass}`}
      onClick={clickable ? () => onOpen(notif) : undefined}
      role={clickable ? 'button' : undefined}
    >
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
                      notif.type === 'whatsapp_message' ? MessageCircle :
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

          {notif.mapsUrl && (
            <a href={notif.mapsUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              View on map
            </a>
          )}

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