// src/agent/components/CallLogList.jsx — a list of call-log records (synced from Android, or logged by this app on
// iPhone). Used on the lead page ("Call log") — the Calls tab has its own day view.
import { approx } from '../appCallLog.js';
import { fmtRelativeDay, fmtTalk } from '../format.js';
import { IconMic, IconPhone } from './icons.jsx';

const CALL_TYPES = {
  outgoing: { label: 'Outgoing', tone: 'blue' },
  incoming: { label: 'Incoming', tone: 'green' },
  missed: { label: 'Missed', tone: 'red' },
  rejected: { label: 'Rejected', tone: 'amber' },
};

export default function CallLogList({ logs }) {
  return (
    <div className="list">
      {logs.map((log) => {
        const t = CALL_TYPES[log.callType] || CALL_TYPES.outgoing;
        const dur = Number(log.duration) || 0;
        const recs = (log.recordings || []).length;
        const byHand = log.source === 'manual-entry';                 // logged by hand on iPhone (LogCallSheet): no talk time
        const notConnected = log.callType === 'outgoing' && dur === 0 && !byHand;
        return (
          <div className="row" key={log._id}>
            <span className={`call-type tone-${notConnected ? 'muted' : t.tone}`} aria-hidden="true"><IconPhone /></span>
            <span className="row-main">
              <span className="row-title"><span>{t.label}{notConnected ? ' · not connected' : ''}</span></span>
              <span className="row-sub" style={{ display: 'block' }}>
                {fmtRelativeDay(log.timestamp)}{dur > 0 ? ` · ${approx(log)}${fmtTalk(dur)}` : ''}
              </span>
              {recs || log.outcome || byHand ? (
                <span className="row-meta">
                  {recs ? <span className="tag tone-purple"><IconMic />{recs > 1 ? `${recs} recordings` : 'Recording'}</span> : null}
                  {log.outcome ? <span className="tag tone-muted">{log.outcome}</span> : null}
                  {byHand ? <span className="tag tone-blue">Logged by hand</span> : null}
                </span>
              ) : null}
              {log.remark ? <span className="row-note">{log.remark}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
