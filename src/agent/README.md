# Agent app — `/agent`

A phone-first, installable web app (PWA) for sales employees, built into the
CRM frontend. It covers what the SkyUp CRM mobile app does that a browser can:
clock-in with location, breaks, clock-out, remote clock-in requests, leads,
call + post-call remark, follow-ups, temperature and status.

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
background location. Push notifications are not wired up yet.
