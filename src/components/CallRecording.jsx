// components/CallRecording.jsx
// Admin dashboard — shows all call recordings uploaded from the mobile app.
// Includes AI transcription + summary via OpenAI Whisper (backend route).

import React, { useEffect, useState } from 'react';
import api from '../data/axiosConfig';

const BACKEND_ROOT = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
  : 'https://skyup-crm-backend.onrender.com';

const SENTIMENT_STYLE = {
  Positive: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400' },
  Neutral:  { bg: 'bg-slate-100 dark:bg-slate-800',       text: 'text-slate-500 dark:text-slate-400' },
  Negative: { bg: 'bg-red-50 dark:bg-red-900/20',         text: 'text-red-500 dark:text-red-400' },
};
const TEMP_STYLE = {
  Hot:  { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  Warm: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-500', dot: 'bg-yellow-400' },
  Cold: { bg: 'bg-blue-50 dark:bg-blue-900/20',     text: 'text-blue-500 dark:text-blue-400',     dot: 'bg-blue-400' },
};

function TranscriptionPanel({ callLogId, recording, contactName }) {
  const [status,     setStatus]     = useState(recording.transcribeStatus || 'pending');
  const [transcript, setTranscript] = useState(recording.transcript || null);
  const [summary,    setSummary]    = useState(recording.summary    || null);
  const [expanded,   setExpanded]   = useState(false);
  const [error,      setError]      = useState(null);
  const recId = recording._id;

  useEffect(() => {
    if (status !== 'processing') return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/transcription/mobile/${callLogId}/${recId}`);
        const s = res.data.transcribeStatus;
        setStatus(s);
        if (s === 'done') {
          setTranscript(res.data.transcript);
          setSummary(res.data.summary);
          clearInterval(interval);
        } else if (s === 'failed') {
          setError('Transcription failed. Check your OpenAI API key on the server.');
          clearInterval(interval);
        }
      } catch { /* keep polling */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [status, callLogId, recId]);

  const handleTranscribe = async () => {
    setStatus('processing');
    setError(null);
    try {
      const res = await api.post(`/transcription/mobile/${callLogId}/${recId}`, {
        contactName: contactName || 'the customer',
      });
      setStatus('done');
      setTranscript(res.data.transcript);
      setSummary(res.data.summary);
    } catch (e) {
      setStatus('failed');
      setError(e.response?.data?.message || 'Transcription failed. Make sure OPENAI_API_KEY is set on the server.');
    }
  };

  if (status === 'pending') {
    return (
      <div className="mt-2">
        <button
          onClick={handleTranscribe}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] hover:bg-[#DBEAFE] dark:hover:bg-[#1E2E55] transition"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          AI Transcribe &amp; Summarize
        </button>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F1F4FF] dark:bg-[#1A2540]">
        <svg className="w-3.5 h-3.5 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <span className="text-[11px] text-[#2563EB] font-medium">Transcribing with Whisper AI…</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20">
          <svg className="w-3.5 h-3.5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span className="text-[11px] text-red-500">{error || 'Transcription failed.'}</span>
        </div>
        <button onClick={handleTranscribe} className="text-[11px] text-[#2563EB] underline pl-1">Retry</button>
      </div>
    );
  }

  // status === 'done'
  const sent = summary?.sentiment;
  const temp = summary?.suggestedTemp;
  const sentStyle = SENTIMENT_STYLE[sent] || SENTIMENT_STYLE.Neutral;
  const tempStyle = TEMP_STYLE[temp];

  return (
    <div className="mt-3 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-[#F1F4FF] dark:bg-[#1A2540] hover:bg-[#EEF3FF] dark:hover:bg-[#1E2E55] transition"
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          <span className="text-[11px] font-bold text-[#2563EB] dark:text-[#4F8EF7]">AI Summary</span>
          {sent && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sentStyle.bg} ${sentStyle.text}`}>{sent}</span>
          )}
          {temp && tempStyle && (
            <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${tempStyle.bg} ${tempStyle.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tempStyle.dot}`}/>
              {temp}
            </span>
          )}
        </div>
        <svg className={`w-3.5 h-3.5 text-[#8B92A9] transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {expanded && (
        <div className="px-3 py-3 space-y-3 bg-white dark:bg-[#13161E]">
          {summary?.summary && (
            <div>
              <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1">Summary</p>
              <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed">{summary.summary}</p>
            </div>
          )}
          {Array.isArray(summary?.keyPoints) && summary.keyPoints.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest mb-1">Key Points</p>
              <ul className="space-y-1">
                {summary.keyPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#2563EB] shrink-0"/>
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {summary?.nextAction && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#F0FDF4] dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/30">
              <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <div>
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-0.5">Next Action</p>
                <p className="text-[12px] text-emerald-700 dark:text-emerald-300">{summary.nextAction}</p>
              </div>
            </div>
          )}
          {transcript && (
            <details className="group">
              <summary className="cursor-pointer text-[10px] font-bold text-[#8B92A9] uppercase tracking-widest select-none list-none flex items-center gap-1">
                <svg className="w-3 h-3 group-open:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
                Full Transcript
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto">
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] leading-relaxed whitespace-pre-wrap font-mono bg-[#F8F9FC] dark:bg-[#0D0F14] rounded-lg px-3 py-2">
                  {transcript}
                </p>
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

export default function CallRecording() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchRecordings = async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/call-logs/recordings?page=${p}&limit=50`);
      setRecordings(res.data.recordings || []);
      setTotalPages(res.data.totalPages || 1);
      setPage(p);
    } catch (e) {
      setError('Failed to load recordings. Please try again.');
      console.error('[CallRecording]', e.response?.status, e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecordings(1); }, []);

  const filtered = recordings.filter(r =>
    r.phoneNumber?.includes(search) ||
    r.matchedLead?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.callType?.includes(search.toLowerCase())
  );

  const fmtDuration = (sec) => {
    if (!sec) return '—';
    const m = Math.floor(sec / 60), s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const fmtDate = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const callTypeColor = (type) => ({
    incoming: '#059669',
    outgoing: '#2563EB',
    missed:   '#EF4444',
    rejected: '#F59E0B',
    blocked:  '#64748B',
  }[type] || '#8B92A9');

  const audioUrl = (recordingUrl) => {
    if (!recordingUrl) return null;
    if (recordingUrl.startsWith('http')) return recordingUrl;
    return `${BACKEND_ROOT}${recordingUrl}`;
  };

  return (
    // ── Full screen height, flex column, no overflow on the outer shell ───────
    <div className="h-screen flex flex-col bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">

      {/* ── Fixed header ───────────────────────────────────────────────────── */}
      <div className="shrink-0 px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
            </svg>
            <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Call Recordings</h2>
            <span className="text-[10px] text-[#8B92A9] dark:text-[#565C75] bg-[#F1F4FF] dark:bg-[#1E2130] px-2 py-0.5 rounded-full">
              {recordings.length} total
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
              </svg>
              Whisper AI
            </span>
            <button onClick={() => fetchRecordings(page)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#F1F4FF] dark:bg-[#1E2130] hover:bg-[#EEF3FF] text-[#2563EB] transition" title="Refresh">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Search bar ───────────────────────────────────────────────────── */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="text" placeholder="Search by number, contact or agent..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl text-[13px] border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] outline-none focus:border-[#2563EB]"/>
        </div>
      </div>

      {/* ── Scrollable content area ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">

        {loading && (
          <div className="flex items-center justify-center py-10 gap-2">
            <svg className="w-4 h-4 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="text-[13px] text-[#8B92A9]">Loading recordings...</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center py-8 gap-2">
            <p className="text-[13px] text-red-500">{error}</p>
            <button onClick={() => fetchRecordings(1)} className="text-[12px] text-[#2563EB] underline">Retry</button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <svg className="w-8 h-8 text-[#E4E7EF] dark:text-[#262A38]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
            </svg>
            <p className="text-[13px] text-[#8B92A9]">
              {recordings.length > 0 ? 'No matches for your search.' : 'No recordings yet. They upload automatically after calls on the mobile app.'}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((rec, i) => (
              <div key={rec._id || i} className="p-4 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[10px] font-bold text-[#2563EB] shrink-0">{i + 1}</span>
                    <div>
                      <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] leading-none">{rec.matchedLead?.name || rec.phoneNumber}</p>
                      {rec.matchedLead?.name && <p className="text-[11px] text-[#8B92A9] mt-0.5">{rec.phoneNumber}</p>}
                      <p className="text-[11px] text-[#8B92A9] mt-0.5">Agent: <span className="font-medium text-[#4B5168] dark:text-[#9DA3BB]">{rec.user?.name || '—'}</span></p>
                      <p className="text-[10px] text-[#8B92A9] mt-0.5">{fmtDate(rec.timestamp)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                      style={{ backgroundColor: callTypeColor(rec.callType) + '20', color: callTypeColor(rec.callType) }}>
                      {rec.callType || 'call'}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      {fmtDuration(rec.duration)}
                    </span>
                  </div>
                </div>

                {rec.remark && <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] italic mb-2">"{rec.remark}"</p>}

                {Array.isArray(rec.recordings) && rec.recordings.length > 0
                  ? rec.recordings.map((r, ri) => (
                      <div key={r._id || ri} className="mb-3 last:mb-0">
                        <audio
                          controls
                          src={audioUrl(r.url)}
                          className="w-full h-8 rounded-xl accent-[#2563EB] mb-1"
                          preload="none"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        {rec._id && r._id && (
                          <TranscriptionPanel
                            callLogId={rec._id}
                            recording={r}
                            contactName={rec.matchedLead?.name || rec.phoneNumber}
                          />
                        )}
                      </div>
                    ))
                  : rec.recordingUrl
                    ? <audio controls src={audioUrl(rec.recordingUrl)} className="w-full h-8 rounded-xl accent-[#2563EB]" preload="none"/>
                    : <p className="text-[11px] text-[#8B92A9] italic">Recording not available</p>
                }
              </div>
            ))}
          </div>
        )}

        {/* ── Pagination ───────────────────────────────────────────────────── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-4 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38]">
            <button onClick={() => fetchRecordings(page - 1)} disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] disabled:opacity-40 hover:border-[#2563EB] hover:text-[#2563EB] transition">
              ← Prev
            </button>
            <span className="text-[12px] text-[#8B92A9]">Page {page} of {totalPages}</span>
            <button onClick={() => fetchRecordings(page + 1)} disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] disabled:opacity-40 hover:border-[#2563EB] hover:text-[#2563EB] transition">
              Next →
            </button>
          </div>
        )}

      </div>
      {/* ── End scrollable area ─────────────────────────────────────────────── */}

    </div>
  );
}
