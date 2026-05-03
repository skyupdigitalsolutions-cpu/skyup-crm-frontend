// components/CallRecording.jsx
// Admin dashboard — shows all call recordings uploaded from the mobile app.
// FIX: No longer calls Twilio. Uses /api/call-logs/admin/recordings (admin token).

import React, { useEffect, useState } from 'react';
import api from '../data/axiosConfig';

const BACKEND_ROOT = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
  : 'https://skyup-crm-backend.onrender.com';

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
      // Admin token is automatically attached by axiosConfig interceptor
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
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
          </svg>
          <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Call Recordings</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#8B92A9] dark:text-[#565C75]">{recordings.length} recordings</span>
          <button onClick={() => fetchRecordings(page)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#F1F4FF] dark:bg-[#1E2130] hover:bg-[#EEF3FF] text-[#2563EB] transition" title="Refresh">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input type="text" placeholder="Search by number, contact or agent..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 rounded-xl text-[13px] border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] outline-none focus:border-[#2563EB]"/>
      </div>

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
              {rec.recordingUrl
                ? <audio controls src={audioUrl(rec.recordingUrl)} className="w-full h-8 rounded-xl accent-[#2563EB]" preload="none"/>
                : <p className="text-[11px] text-[#8B92A9] italic">Recording not available</p>
              }
            </div>
          ))}
        </div>
      )}

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
  );
}
