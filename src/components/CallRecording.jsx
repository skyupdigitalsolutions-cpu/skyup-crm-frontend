// components/CallRecording.jsx
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE        = 'https://skyup-crm-backend.onrender.com/api/twilio';
const TRANSCRIBE_BASE = 'https://skyup-crm-backend.onrender.com/api/transcription';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function SentimentBadge({ sentiment }) {
  const map = {
    Positive: { bg: 'bg-emerald-100 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', icon: '😊' },
    Neutral:  { bg: 'bg-amber-100  dark:bg-amber-950/40',   text: 'text-amber-600  dark:text-amber-400',   icon: '😐' },
    Negative: { bg: 'bg-red-100    dark:bg-red-950/40',     text: 'text-red-600    dark:text-red-400',     icon: '😟' },
  };
  const s = map[sentiment] || map['Neutral'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text}`}>
      {s.icon} {sentiment}
    </span>
  );
}

function TempBadge({ temp }) {
  if (!temp) return null;
  const map = {
    Hot:  { bg: 'bg-red-100  dark:bg-red-950/40',   text: 'text-red-600  dark:text-red-400',   icon: '🔥' },
    Warm: { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', icon: '☀️' },
    Cold: { bg: 'bg-blue-100 dark:bg-blue-950/40',  text: 'text-blue-600 dark:text-blue-400',   icon: '❄️' },
  };
  const s = map[temp];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${s.bg} ${s.text}`}>
      {s.icon} {temp} Lead
    </span>
  );
}

function AISummaryPanel({ transcript, summary }) {
  const [tab, setTab] = useState('summary');
  return (
    <div className="mt-3 rounded-xl border border-[#6366F1]/30 bg-[#6366F1]/5 dark:bg-[#6366F1]/10 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#6366F1]/20">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">✨</span>
          <span className="text-[11px] font-bold text-[#6366F1]">AI Analysis</span>
        </div>
        <div className="flex gap-1">
          {['summary', 'transcript'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-semibold transition ${
                tab === t ? 'bg-[#6366F1] text-white' : 'text-[#8B92A9] hover:text-[#6366F1]'
              }`}>
              {t === 'summary' ? 'Summary' : 'Transcript'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'summary' && summary && (
        <div className="p-3 space-y-3">
          <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed">{summary.summary}</p>
          <div className="flex flex-wrap gap-1.5">
            {summary.sentiment  && <SentimentBadge sentiment={summary.sentiment} />}
            {summary.suggestedTemp && <TempBadge temp={summary.suggestedTemp} />}
          </div>
          {summary.keyPoints?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1.5">Key Points</p>
              <ul className="space-y-1">
                {summary.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-[#4B5168] dark:text-[#9DA3BB]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] mt-1.5 shrink-0" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary.nextAction && (
            <div className="bg-white dark:bg-[#1A1D27] rounded-lg border border-[#E4E7EF] dark:border-[#262A38] px-3 py-2">
              <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1">Recommended Next Action</p>
              <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">→ {summary.nextAction}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'transcript' && (
        <div className="p-3">
          <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">Full Transcript</p>
          <div className="bg-white dark:bg-[#13161E] rounded-lg border border-[#E4E7EF] dark:border-[#262A38] p-3 max-h-48 overflow-y-auto">
            <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed whitespace-pre-wrap">
              {transcript || 'No transcript available.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function TranscribeButton({ rec, onDone }) {
  const [status, setStatus] = useState(rec.transcribeStatus || 'pending');
  const adminToken = localStorage.getItem('adminToken') || localStorage.getItem('token') || '';

  const handleTranscribe = useCallback(async () => {
    if (!rec.recordingSid) return;
    setStatus('processing');
    try {
      const res = await axios.post(
        `${TRANSCRIBE_BASE}/twilio/${rec.recordingSid}`,
        { contactName: rec.contactName },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      setStatus('done');
      onDone(rec._id, res.data.transcript, res.data.summary);
    } catch { setStatus('failed'); }
  }, [rec, adminToken, onDone]);

  if (status === 'done') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">✅ Analysed</span>
  );
  if (status === 'processing') return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-[#6366F1]">
      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      Analysing…
    </span>
  );
  if (status === 'failed') return (
    <button onClick={handleTranscribe} className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500 hover:text-red-700 transition">
      ⚠️ Retry
    </button>
  );
  return (
    <button onClick={handleTranscribe} disabled={!rec.recordingSid}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#6366F1] hover:bg-[#5254d4] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-bold transition">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.346A3.285 3.285 0 0019 16.586V19a1 1 0 01-1 1h-5a1 1 0 01-1-1v-2.414a3.285 3.285 0 00-.653-1.94l-.346-.347z"/>
      </svg>
      AI Analyse
    </button>
  );
}

export default function CallRecording() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [expanded, setExpanded]     = useState({});
  const adminToken = localStorage.getItem('adminToken') || localStorage.getItem('token') || '';

  useEffect(() => {
    axios.get(`${API_BASE}/admin/recordings`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
      .then(res => setRecordings(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [adminToken]);

  const handleAnalysisDone = useCallback((recId, transcript, summary) => {
    setRecordings(prev =>
      prev.map(r => r._id === recId
        ? { ...r, transcript, summary, transcribeStatus: 'done' }
        : r
      )
    );
    setExpanded(prev => ({ ...prev, [recId]: true }));
  }, []);

  const toggleExpanded = (id) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const filtered = recordings.filter(r =>
    r.contactName?.toLowerCase().includes(search.toLowerCase()) ||
    r.agentIdentity?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Call Recordings</h2>
          <p className="text-[11px] text-[#8B92A9] mt-0.5">
            Click <span className="font-semibold text-[#6366F1]">AI Analyse</span> to transcribe & summarize any call
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] text-[#8B92A9] dark:text-[#565C75]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] inline-block" />
          {recordings.length} total
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input type="text" placeholder="Search by contact or agent…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 rounded-xl text-[13px] border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] outline-none focus:border-[#2563EB]" />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 gap-2">
          <svg className="w-4 h-4 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span className="text-[13px] text-[#8B92A9]">Loading recordings…</span>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <svg className="w-8 h-8 text-[#E4E7EF] dark:text-[#262A38]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
          </svg>
          <p className="text-[13px] text-[#8B92A9]">No recordings found.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((rec, i) => (
            <div key={rec._id}
              className="p-4 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]">

              {/* Top row */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[10px] font-bold text-[#2563EB] shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] leading-none">
                      {rec.contactName || 'Unknown Contact'}
                    </p>
                    <p className="text-[11px] text-[#8B92A9] mt-0.5">
                      Agent: <span className="font-medium text-[#4B5168] dark:text-[#9DA3BB]">{rec.agentIdentity || '—'}</span>
                    </p>
                    <p className="text-[10px] text-[#8B92A9] mt-0.5">{fmtDate(rec.recordedAt)}</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] shrink-0">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  {rec.recordingDuration}s
                </span>
              </div>

              {/* Audio player */}
              {rec.recordingSid ? (
                <audio controls src={`${API_BASE}/recording/${rec.recordingSid}/audio`}
                  className="w-full h-8 rounded-xl accent-[#2563EB] mb-3" />
              ) : (
                <div className="flex items-center gap-2 py-2 mb-3">
                  <svg className="w-3.5 h-3.5 animate-spin text-[#8B92A9]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  <p className="text-[12px] text-[#8B92A9] italic">Recording processing…</p>
                </div>
              )}

              {/* Action row */}
              <div className="flex items-center justify-between">
                <TranscribeButton rec={rec} onDone={handleAnalysisDone} />
                {(rec.transcribeStatus === 'done') && (
                  <button onClick={() => toggleExpanded(rec._id)}
                    className="flex items-center gap-1 text-[10px] font-semibold text-[#6366F1] hover:text-[#5254d4] transition">
                    {expanded[rec._id] ? 'Hide analysis ▲' : 'View analysis ▼'}
                  </button>
                )}
              </div>

              {/* AI Summary Panel */}
              {expanded[rec._id] && rec.transcribeStatus === 'done' && (
                <AISummaryPanel transcript={rec.transcript} summary={rec.summary} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
