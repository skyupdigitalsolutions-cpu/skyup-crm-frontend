import { useState } from 'react';
import { useVoicebot, LEAD_TEMP } from '../hooks/useVoicebot'; // adjust path as needed

const TEMP_STYLE = {
  Hot:  { bg: 'bg-[#FEF2F2] dark:bg-[#2D0A0A]', text: 'text-[#DC2626] dark:text-[#F87171]', icon: '' },
  Warm: { bg: 'bg-[#FFFBEB] dark:bg-[#2D1F00]', text: 'text-[#D97706] dark:text-[#FCD34D]', icon: '' },
  Cold: { bg: 'bg-[#EEF3FF] dark:bg-[#1A2540]',  text: 'text-[#2563EB] dark:text-[#4F8EF7]', icon: '' },
};

export default function VoiceBotPanel({ leads = [], campaignName = '' }) {
  const {
    callQueue,
    currentCall,
    results,
    isRunning,
    error,
    runQueue,
    stopQueue,
  } = useVoicebot();

  const [expanded, setExpanded] = useState(false);

  const calledIds = new Set(results.map((r) => r.lead?.id || r.lead?._id));
  const pending   = leads.filter((l) => !calledIds.has(l.id || l._id));
  const hotCount  = results.filter((r) => r.Quality === LEAD_TEMP.HOT).length;
  const warmCount = results.filter((r) => r.Quality === LEAD_TEMP.WARM).length;

  return (
    <div className="mt-4 border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-[#F8F9FC] dark:bg-[#13161E] cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[14px]">🤖</span>
          <span className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Voice Bot</span>
          {results.length > 0 && (
            <span className="text-[11px] text-[#8B92A9] dark:text-[#565C75]">
              {results.length}/{leads.length} called · {hotCount}  · {warmCount} 
            </span>
          )}
          {isRunning && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ECFDF5] dark:bg-[#052E1C] text-[#059669] dark:text-[#34D399] text-[10px] font-semibold">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Running
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-[#8B92A9] transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </div>

      {expanded && (
        <div className="px-4 py-4 space-y-4">
          {/* Current call status */}
          {currentCall && (
            <div className="flex items-center gap-2 px-3 py-2 bg-[#EEF3FF] dark:bg-[#1A2540] rounded-xl text-[12px] text-[#2563EB] dark:text-[#4F8EF7] font-medium">
              <svg className="w-3.5 h-3.5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
              Calling {currentCall.lead?.name || 'lead'} — {currentCall.status}
              {currentCall.callId && (
                <span className="text-[10px] text-[#8B92A9] ml-1">#{currentCall.callId}</span>
              )}
            </div>
          )}

          {error && (
            <div className="px-3 py-2 bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D] rounded-xl text-[12px] text-[#DC2626] dark:text-[#F87171]">
              ⚠️ {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {!isRunning ? (
              <button
                onClick={() => runQueue(leads)}
                disabled={leads.length === 0}
                className="flex-1 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                📞 Auto-call all {leads.length} leads
              </button>
            ) : (
              <button
                onClick={stopQueue}
                className="flex-1 py-2 rounded-xl bg-[#FEF2F2] dark:bg-[#2D0A0A] text-[#DC2626] dark:text-[#F87171] text-[12px] font-semibold border border-[#FECACA] dark:border-[#7F1D1D] hover:bg-[#fee2e2] transition"
              >
                ⏹ Stop queue
              </button>
            )}
          </div>

          {/* Queue progress */}
          {callQueue.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wider">Queue</p>
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {callQueue.map((item, i) => {
                  const statusColors = {
                    pending:    'text-[#8B92A9]',
                    calling:    'text-[#2563EB] animate-pulse',
                    done:       'text-[#059669]',
                    failed:     'text-[#DC2626]',
                  };
                  const icons = { pending: '⏳', calling: '📞', done: '✅', failed: '❌' };
                  return (
                    <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[#F8F9FC] dark:bg-[#13161E] text-[11px]">
                      <span className={`font-medium ${statusColors[item.queueStatus] || 'text-[#8B92A9]'}`}>
                        {icons[item.queueStatus] || '⏳'} {item.name || 'Lead'}
                      </span>
                      <span className="text-[#8B92A9] dark:text-[#565C75]">{item.phone || item.mobile || ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-wider">Results</p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {results.map((r, i) => {
                  const ts = TEMP_STYLE[r.Quality] || TEMP_STYLE.Cold;
                  return (
                    <div key={i} className="px-3 py-2.5 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
                          {r.lead?.name || 'Lead'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ts.bg} ${ts.text}`}>
                          {ts.icon} {r.Quality}
                        </span>
                      </div>
                      {r.summary && (
                        <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] italic leading-relaxed">{r.summary}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-[#8B92A9]">
                        <span>Score: {r.score ?? '—'}</span>
                        {r.duration > 0 && <span>Duration: {r.duration}s</span>}
                        {r.status && <span className="capitalize">{r.status}</span>}
                        {r.errorMsg && <span className="text-[#DC2626]">⚠️ {r.errorMsg}</span>}
                      </div>
                      {r.recordingUrl && (
                        
                     <a  href={r.recordingUrl}
                        target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-[#2563EB] dark:text-[#4F8EF7] hover:underline"
                        >
                          🎙 Listen to recording
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}