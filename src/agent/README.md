# Agent app — `/agent`

A phone-first, installable web app (PWA) for sales employees, built into the
CRM frontend. It covers what the SkyUp CRM mobile app does that a browser can:
clock-in with location, breaks, clock-out, remote clock-in requests, leads,
call + post-call remark, follow-ups, temperature and status, calls by day,
and live alerts.

## Calls tab (`pages/Calls.jsx`)
Same endpoints as the mobile app's Calls screen: `GET /call-logs?date&tzOffset`
and `GET /call-logs/uncalled`. Shows calls synced by the Android app (remark
pending / added), remarks saved that day, and leads not called yet (today).

## iPhone call log (`appCallLog.js`, `pendingCall.js`)
iOS gives no app (native or web) access to the call history, so an iPhone
can't sync its call log. Instead the app logs the calls it starts: tap Call →
dialer → come back → `POST /call-logs/app-call` with the dial time and time
away (stored as an estimated duration, shown with "≈"). Saving the remark
adds the outcome; a "didn't answer" outcome sets the duration to 0. Attaching
the call recording (`AttachRecording.jsx`, `POST /call-logs/recording` with
`source=manual`) replaces the estimate with the real length. Not captured on
iPhone: incoming calls and calls made from the Phone app directly.

## Live alerts (`socket.jsx`, `alerts.jsx`, `LiveEvents.jsx`)
socket.io with the mobile app's events and rooms (`agent_join`, `att_join`):
`new_lead_assigned`, `meeting_permission_response`, `attendance:updated`.
Follow-up reminders fire 5 minutes before a follow-up. Alerts show as an
in-app banner, and as a phone notification (Profile → Alerts) when the app is
in the background. When the app is closed, the server sends the same alerts
as web push (`push.js`, `public/agent-sw.js`; backend
`services/agentPushService.js`, `routes/agentPushRoutes.js`). Web
subscriptions are stored separately from `User.fcmToken`, so the Android
app's push is untouched. Needs `AGENT_VAPID_PUBLIC_KEY` /
`AGENT_VAPID_PRIVATE_KEY` on the server (`npx web-push generate-vapid-keys`).

- URL: `https://<your-crm-domain>/agent`
- Sign-in: same accounts as the CRM (employee role). Shares the CRM session in
  the same tab (sessionStorage). Employees stay signed in after closing the app
  (30-day token in localStorage, renewed while in use via `POST /auth/refresh`)
  until they sign out — see `persist.js`.
- Install: iPhone → Safari → Share → Add to Home Screen. Android → Install.
- API: same endpoints and payloads as the mobile app, via its own fetch client
  (`api.js`) so attendance and leads are never served from the 30-second GET
  cache in `src/data/axiosConfig.js`.
- Styles: `styles.css`, every rule scoped under `.agent-app`.
- PWA files (in `/public`): `agent-manifest.json`, `agent-sw.js`,
  `agent-offline.html`, `agent-icons/`. Wiring: `pwa.js` (same pattern as
  `src/finance/pwa.js`). The service worker caches static files only.

Not possible in a browser: full call-log sync (incoming calls, calls made
outside the app), automatic call recordings, call detection, background
location.
