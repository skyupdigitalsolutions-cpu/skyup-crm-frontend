// src/agent/appCallLog.js
// ────────────────────────────────────────────
// Call log for iPhone.
//
// iOS gives no app — native or web — access to the phone's call history, so an iPhone can't sync its call log like
// the Android app does. What this app CAN know is the calls it starts: the employee taps Call, the dialer opens, and
// when they come back we know the lead, the dial time and how long they were away. That becomes a normal call-log
// record on the server (POST /api/call-logs/app-call), so the call shows in Calls by Day, Call Monitoring, reports
// and talk time.
//
//   1. on return from the dialer   → logged with the time away as an ESTIMATED duration (ringing + talking)
//   2. when the remark is saved    → outcome + remark added; a "didn't answer" outcome sets the duration to 0
//   3. if a recording is attached  → the server replaces the estimate with the recording's real length
//
// Not possible on iPhone: incoming calls, and calls made from the Phone app directly instead of from this app.
// Android phones are skipped here: the Android app syncs the real call log (the server also drops duplicates).
// Plain logic, no React, so it can be tested on its own.
// ────────────────────────────────────────────
import { OUTCOMES_NOT_ANSWERED } from './constants.js';
import { isIOS } from './pwa.js';

/** Only iPhone / iPad log calls this way. */
export const shouldLogAppCalls = () => isIOS();

/** Shortest time away that counts as a call (a cancelled dial comes straight back). */
export const MIN_AWAY_MS = 5000;
/** If the app was closed during the call and reopened later than this, it is not treated as a return from that call. */
export const COLD_START_MAX_MS = 60 * 60 * 1000;

/** Body for POST /call-logs/app-call. `remarkInfo` is added when the after-call remark is saved. */
export function appCallPayload(call, remarkInfo) {
  const body = { leadId: String(call.leadId), dialedAt: Math.round(call.dialedAt) };
  if (call.returnedAt) body.returnedAt = Math.round(call.returnedAt);
  if (call.phone) body.phoneNumber = String(call.phone);
  if (remarkInfo) {
    const outcome = String(remarkInfo.outcome || '');
    body.outcome = outcome;
    body.answered = outcome ? !OUTCOMES_NOT_ANSWERED.includes(outcome) && outcome !== 'Invalid' : undefined;   // an invalid number was never answered
    if (remarkInfo.remark) body.remark = String(remarkInfo.remark).slice(0, 500);
  }
  return body;
}

// ── Retry queue ──────────────────────────────────────────────────────────────
// A call log that fails because the phone is offline (or the server hiccups) is kept on the phone and sent again
// when the app is opened or comes back online. Safe to repeat: the server keys the record by employee + number +
// dial time. Requests for the same call are merged, so the newest information wins. Cleared on sign-out.
export const QUEUE_KEY = 'skyup_call_log_queue';
const QUEUE_MAX = 50;
const QUEUE_MAX_AGE_MS = 23 * 3600 * 1000;      // the server refuses calls older than 24 hours

const readQueue = () => { try { const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); return Array.isArray(q) ? q : []; } catch { return []; } };
const writeQueue = (q) => { try { if (q.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); else localStorage.removeItem(QUEUE_KEY); } catch { /* ignore */ } };
const sameCall = (a, b) => String(a.leadId) === String(b.leadId) && Number(a.dialedAt) === Number(b.dialedAt);
const retryable = (e) => { const s = Number(e && e.status) || 0; return s === 0 || s === 408 || s === 429 || s >= 500; };

export function queueAppCall(body, now = Date.now()) {
  const q = readQueue().filter((x) => now - Number(x.dialedAt) < QUEUE_MAX_AGE_MS);
  const i = q.findIndex((x) => sameCall(x, body));
  if (i >= 0) q[i] = { ...q[i], ...body }; else q.push(body);
  writeQueue(q.slice(-QUEUE_MAX));
}
export const pendingAppCalls = () => readQueue();

/** Send one call log; on a network/server failure keep it for later. Never throws. */
export async function sendAppCall(send, body) {
  try { await send(body); return true; } catch (e) { if (retryable(e)) queueAppCall(body); return false; }
}

let flushing = false;
/** Send everything waiting. Entries the server refuses for good (4xx) are dropped. */
export async function flushAppCallQueue(send, now = Date.now()) {
  if (flushing) return;
  flushing = true;
  try {
    for (const body of readQueue()) {
      if (now - Number(body.dialedAt) >= QUEUE_MAX_AGE_MS) { writeQueue(readQueue().filter((x) => !sameCall(x, body))); continue; }
      const sent = JSON.stringify(body);
      try { await send(body); } catch (e) { if (retryable(e)) break; }       // still offline: try again later
      // remove only what was sent — a newer update for this call queued meanwhile stays for the next try
      writeQueue(readQueue().filter((x) => !(sameCall(x, body) && JSON.stringify(x) === sent)));
    }
  } finally { flushing = false; }
}

/** Talk time shown with "≈" when it is an estimate. */
export const approx = (log) => (log && log.durationEstimated ? '≈ ' : '');
