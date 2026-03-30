// components/CallRecording.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = 'https://skyup-crm-backend.onrender.com/api/twilio';

export default function CallRecording() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');

  useEffect(() => {
    axios.get(`${API_BASE}/admin/recordings`)
      .then(res => setRecordings(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = recordings.filter(r =>
    r.contactName?.toLowerCase().includes(search.toLowerCase()) ||
    r.agentIdentity?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
          Call Recordings
        </h2>
        <span className="flex items-center gap-1.5 text-[10px] text-[#8B92A9] dark:text-[#565C75]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] inline-block" />
          {recordings.length} total
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input type="text" placeholder="Search by contact or agent..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 rounded-xl text-[13px] border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] outline-none focus:border-[#2563EB]"/>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-10 gap-2">
          <svg className="w-4 h-4 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span className="text-[13px] text-[#8B92A9]">Loading recordings...</span>
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <svg className="w-8 h-8 text-[#E4E7EF] dark:text-[#262A38]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
          </svg>
          <p className="text-[13px] text-[#8B92A9]">No recordings found.</p>
        </div>
      )}

      {/* List */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((rec, i) => (
            <div key={rec._id}
              className="p-4 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]">

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
                    <p className="text-[10px] text-[#8B92A9] mt-0.5">
                      {rec.recordedAt
                        ? new Date(rec.recordedAt).toLocaleString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })
                        : '—'}
                    </p>
                  </div>
                </div>

                {/* Duration */}
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] shrink-0">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  {rec.recordingDuration}s
                </span>
              </div>

              {/* FIX: Audio proxied through backend so Twilio auth is handled server-side */}
              {rec.recordingSid ? (
                <audio
                  controls
                  src={`${API_BASE}/recording/${rec.recordingSid}/audio`}
                  className="w-full h-8 rounded-xl accent-[#2563EB]"
                />
              ) : (
                <div className="flex items-center gap-2 py-2">
                  <svg className="w-3.5 h-3.5 animate-spin text-[#8B92A9]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  <p className="text-[12px] text-[#8B92A9] italic">Recording processing...</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}