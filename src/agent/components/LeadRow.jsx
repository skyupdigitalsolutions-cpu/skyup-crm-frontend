import { useState } from 'react';
import { Link } from 'react-router-dom';
import QuotationModal from '../../components/QuotationModal.jsx';
import { STATUS_TONE, TEMP_TONE } from '../constants.js';
import { fmtRelativeDay, initials, maskPhone, telHref } from '../format.js';
import { savePendingCall } from '../pendingCall.js';
import { IconPhone, IconEdit } from './icons.jsx';

const TEMP_COLOR = { Hot: 'var(--red)', Warm: 'var(--orange)', Cold: 'var(--blue)' };

export default function LeadRow({ lead, showFollowUp }) {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const tel = telHref(lead.phone);
  const sub = showFollowUp && lead.followUpDate
    ? `Follow-up ${fmtRelativeDay(lead.followUpDate)}`
    : [maskPhone(lead.phone), lead.source].filter(Boolean).join(', ');
  return (
    <div className="row">
      {lead.temperature && TEMP_COLOR[lead.temperature] ? (
        <span className="temp-mark" style={{ background: TEMP_COLOR[lead.temperature] }} />
      ) : null}
      <Link to={`/agent/leads/${lead.id}`} className="row-link">
      <span className="avatar" aria-hidden="true">{initials(lead.name)}</span>
      <span className="row-main">
        <span className="row-title"><span>{lead.name}</span></span>
        <span className="row-sub" style={{ display: 'block' }}>{sub}</span>
        <span className="row-meta">
          <span className={`tag tone-${STATUS_TONE[lead.status] || 'muted'}`}>{lead.status}</span>
          {lead.temperature ? <span className={`tag tone-${TEMP_TONE[lead.temperature] || 'muted'}`}>{lead.temperature}</span> : null}
        </span>
      </span>
      </Link>
      <button
        type="button"
        className="row-quote"
        aria-label={`Create quotation for ${lead.name}`}
        title="Create quotation"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuoteOpen(true); }}
      >
        <IconEdit />
      </button>
      {tel ? (
        <a
          className="row-call"
          href={tel}
          aria-label={`Call ${lead.name}`}
          onClick={() => savePendingCall(lead)}
        >
          <IconPhone />
        </a>
      ) : null}
      {quoteOpen ? <QuotationModal lead={lead} onClose={() => setQuoteOpen(false)} /> : null}
    </div>
  );
}
