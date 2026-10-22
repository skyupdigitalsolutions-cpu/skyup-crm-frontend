// src/agent/contactCard.js — "Save to contacts". A browser cannot write to the phone's address book, but an iPhone
// (and Android) opens a .vcf file with "Add to Contacts". This builds that file.
const esc = (v) => String(v ?? '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');   // any kind of line break (even a lone CR) becomes a literal \n

export function buildVCard(lead) {
  const name = String(lead.name || 'Lead').trim();
  const parts = name.split(/\s+/); const last = parts.length > 1 ? parts.pop() : ''; const first = parts.join(' ');
  const digits = (p) => String(p || '').replace(/[^\d+]/g, '');
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${esc(last)};${esc(first)};;;`, `FN:${esc(name)}`];
  if (digits(lead.phone)) lines.push(`TEL;TYPE=CELL:${digits(lead.phone)}`);
  if (digits(lead.secondaryPhone)) lines.push(`TEL;TYPE=WORK:${digits(lead.secondaryPhone)}`);
  if (lead.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(lead.email)}`);
  if (lead.industry) lines.push(`ORG:${esc(lead.industry)}`);
  lines.push(`NOTE:${esc(['SkyUp CRM lead', lead.source, lead.campaign].filter(Boolean).join(' - '))}`, 'END:VCARD');
  return lines.join('\r\n') + '\r\n';
}
export const vcardFileName = (lead) => `${String(lead.name || 'lead').replace(/[^\w\-]+/g, '_').slice(0, 40) || 'lead'}.vcf`;

export function downloadVCard(lead) {
  const blob = new Blob([buildVCard(lead)], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = vcardFileName(lead);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
