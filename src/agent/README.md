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

## Live alerts (`socket.jsx`, `alerts.jsx`, `LiveEvents.jsx`)
socket.io with the mobile app's events and rooms (`agent_join`, `att_join`):
`new_lead_assigned`, `meeting_permission_response`, `attendance:updated`.
Follow-up reminders fire 5 minutes before a follow-up. Alerts show as an
in-app banner, and as a phone notification (Profile → Alerts) when the app is
in the background. Not delivered once the phone has closed the app — that
needs server push: the backend must store several FCM tokens per user (phone
+ web), otherwise a web token would replace the Android app's token.

- URL: `https://<your-crm-domain>/agent`
- Sign-in: same accounts as the CRM (employee role). Shares the CRM session in
  the same tab (sessionStorage), so it signs out when the app/tab is closed.
- Install: iPhone → Safari → Share → Add to Home Screen. Android → Install.
- API: same endpoints and payloads as the mobile app, via its own fetch client
  (`api.js`) so attendance and leads are never served from the 30-second GET
  cache in `src/data/axiosConfig.js`.
- Styles: `styles.css`, every rule scoped under `.agent-app`.
- PWA files (in `/public`): `agent-manifest.json`, `agent-sw.js`,
  `agent-offline.html`, `agent-icons/`. Wiring: `pwa.js` (same pattern as
  `src/finance/pwa.js`). The service worker caches static files only.

Not possible in a browser: call-log sync, call recordings, call detection,
background location. Server push (alerts while the app is closed) needs the
backend change above.
