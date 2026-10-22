// src/agent/recordingUpload.js
// ────────────────────────────────────────────
// Helpers for "Attach call recording" (AttachRecording.jsx).
//
// WHY THIS EXISTS: an iPhone cannot sync call logs or recordings. Its built-in call recording saves the audio in the
// Notes app (Call Recordings folder). The employee saves that audio to Files ("Save Audio Files") and attaches it to
// the lead here. The backend (POST /api/call-logs/recording, source=manual) stores it, links it to the lead and the
// call, and the normal transcription / summary then works on it like on an Android recording.
//
// Everything in this file is plain logic (no React) so it can be tested on its own.
// ────────────────────────────────────────────

import { normalizePhone } from './phone.js';

export const MAX_BYTES = 50 * 1024 * 1024;      // the server's upload limit

// The audio types the server accepts as sent (kept in step with allowedMimes in mobileCallLogController.js).
const SERVER_OK = new Set([
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/aac', 'audio/x-aac', 'video/mp4',
  'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/amr', 'audio/amr-nb', 'audio/amr-wb',
  'audio/3gpp', 'audio/3gpp2', 'video/3gpp', 'video/3gpp2', 'audio/ogg', 'audio/opus', 'audio/x-opus+ogg',
  'application/octet-stream', 'binary/octet-stream',
]);

// File extension -> a type the server accepts. Safari often reports an empty or unusual type for files picked from
// the Files app, so the extension is the reliable signal.
const EXT_MIME = {
  m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mpeg', wav: 'audio/wav', amr: 'audio/amr',
  '3gp': 'audio/3gpp', '3g2': 'audio/3gpp2', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg',
};

export const ACCEPT = 'audio/*,.m4a,.mp3,.aac,.wav,.amr,.3gp,.mp4,.ogg,.opus';

export const extOf = (name = '') => {
  const s = String(name);
  const i = s.lastIndexOf('.');
  return i < 0 ? '' : s.slice(i + 1).toLowerCase();
};

/** The type to send for this file: the file's own type if the server accepts it, else one chosen by extension. */
export function mimeFor(file) {
  const t = String((file && file.type) || '').toLowerCase();
  if (t && SERVER_OK.has(t) && t !== 'application/octet-stream' && t !== 'binary/octet-stream') return t;
  const byExt = EXT_MIME[extOf(file && file.name)];
  if (byExt) return byExt;
  return t || '';
}

/** Same file, with a type the server accepts (only re-wraps when the type needs changing). */
export function withMime(file) {
  const type = mimeFor(file);
  if (!type || type === file.type) return file;
  return new File([file], file.name, { type, lastModified: file.lastModified });
}

export function fmtSize(bytes) {
  const b = Number(bytes) || 0;
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** { ok, message } — checked before anything is uploaded. */
export function validateRecordingFile(file) {
  if (!file) return { ok: false, message: 'No file was chosen.' };
  if (!file.size) return { ok: false, message: 'That file is empty. Choose the saved call recording.' };
  if (file.size > MAX_BYTES) {
    return { ok: false, message: `That file is ${fmtSize(file.size)}. The limit is 50 MB. Choose a shorter recording.` };
  }
  const t = String(file.type || '').toLowerCase();
  if (!(EXT_MIME[extOf(file.name)] || t.startsWith('audio/'))) {
    return { ok: false, message: 'Choose an audio file (.m4a, .mp3, .wav, .aac). Save the recording from Notes to Files first.' };
  }
  if (!SERVER_OK.has(mimeFor(file))) {            // audio, but a format the server would refuse (for example .caf): say so now, not after the upload
    return { ok: false, message: 'That audio format is not supported. Use a .m4a, .mp3, .wav or .aac file.' };
  }
  return { ok: true, message: '' };
}

/** Last 10 digits of a phone number (the server stores calls this way). '' when there are fewer than 10 digits. */
export function phone10(phone) { return normalizePhone(phone) || ''; }   // the server's rule (phone.js): an invalid number gives ''

/** Same idea as the Android app: one key per file, so attaching the same file twice is recognised. */
export function makeFileKey(phone, file) {
  return `${phone10(phone)}::${file.name}::${file.lastModified || 0}`;
}

const pad = (n) => String(n).padStart(2, '0');
/** ms -> "YYYY-MM-DDTHH:mm" in the phone's local time, for <input type="datetime-local">. */
export function toLocalInput(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
/** "YYYY-MM-DDTHH:mm" (local time) -> ms; NaN when empty or invalid. */
export function fromLocalInput(value) {
  if (!value) return NaN;
  return new Date(value).getTime();
}

/** The call time to suggest: the file's saved time when it looks sane (not in the future, not older than 60 days), else now. */
export function defaultCallTime(file, now = Date.now()) {
  const lm = Number(file && file.lastModified);
  const ok = Number.isFinite(lm) && lm > 0 && lm <= now + 60000 && lm >= now - 60 * 24 * 3600 * 1000;
  return Math.floor((ok ? lm : now) / 60000) * 60000;
}

/** Audio length in seconds, read from the file itself. 0 when the browser cannot read it (never blocks the upload). */
export function readDurationSec(file, timeoutMs = 4000) {
  return new Promise((resolve) => {
    let done = false;
    let url = '';
    const audio = document.createElement('audio');
    const finish = (v) => {
      if (done) return;
      done = true;
      try { audio.removeAttribute('src'); audio.load(); } catch { /* ignore */ }
      if (url) URL.revokeObjectURL(url);
      resolve(Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
    };
    try {
      url = URL.createObjectURL(file);
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => finish(audio.duration);
      audio.onerror = () => finish(0);
      audio.src = url;
      setTimeout(() => finish(0), timeoutMs);
    } catch { finish(0); }
  });
}

/** The multipart body the server expects (file field name is "recording"). */
export function buildRecordingForm({ lead, file, callTimeMs, durationSec = 0, remark = '' }) {
  const f = withMime(file);
  const form = new FormData();
  form.append('source', 'manual');
  form.append('leadId', String(lead.id));
  form.append('phoneNumber', phone10(lead.phone));
  form.append('timestamp', String(Math.round(callTimeMs)));
  if (durationSec > 0) form.append('duration', String(Math.round(durationSec)));
  form.append('callType', 'outgoing');
  if (remark && remark.trim()) form.append('remark', remark.trim().slice(0, 500));
  form.append('fileKey', makeFileKey(lead.phone, file));
  form.append('recording', f, f.name);          // the file goes last
  return form;
}

/** A short, plain-language reason for a failed upload. */
export function describeUploadError(err) {
  const status = Number(err && err.status);
  const msg = (err && err.message) || '';
  if (status === 0 || !status) return msg || 'Could not reach the server. Check your internet connection and try again.';
  if (status === 404) return 'This lead is not assigned to you, so you cannot attach a recording to it.';
  if (status === 413) return 'The file is too large. The limit is 50 MB.';
  if (status === 400 || status === 403) return msg || 'The server did not accept this recording.';
  if (status >= 500) return 'The server had a problem saving the recording. Wait a moment and try again.';
  return msg || 'The recording could not be uploaded. Try again.';
}
