const pad = (n) => String(n).padStart(2, '0');

export function fmtTime(d) {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(x)) return '—';
  let h = x.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${pad(x.getMinutes())} ${ap}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(d) {
  if (!d) return '—';
  const x = new Date(d);
  if (isNaN(x)) return '—';
  return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
}

export function fmtRelativeDay(d) {
  if (!d) return '';
  const x = new Date(d);
  if (isNaN(x)) return '';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(x); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day - today) / 86400000);
  if (diff === 0) return `Today, ${fmtTime(x)}`;
  if (diff === 1) return `Tomorrow, ${fmtTime(x)}`;
  if (diff === -1) return `Yesterday, ${fmtTime(x)}`;
  return `${x.getDate()} ${MONTHS[x.getMonth()]}, ${fmtTime(x)}`;
}

export function fmtDuration(totalSecs) {
  const s = Math.max(0, Math.floor(totalSecs));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function telHref(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

export function whatsappHref(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) d = '91' + d;
  return d ? `https://wa.me/${d}` : null;
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
}

// For <input type="datetime-local"> values.
export function toLocalInput(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

// Same masking as the mobile app's lead screens.
export function maskPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length < 6) return '••••••';
  return d.slice(0, 2) + '•••••' + d.slice(-2);
}

/** Call length: 45s, 4m 5s, 1h 12m. */
export function fmtTalk(secs) {
  const s = Math.max(0, Math.round(secs || 0));
  if (s < 60) return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m ${s % 60 ? `${s % 60}s` : ''}`.trim();
}
