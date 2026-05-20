// frontend/src/pages/admin/CallLogs.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Admin Call Logs Page
// Displays all call logs synced from the mobile app.
// Features: history, recording playback, employee/lead filters, pagination.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../data/axiosConfig';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDuration(secs) {
  if (!secs || secs === 0) return '0s';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function maskPhone(phone) {
  if (!phone) return '—';
  const s = String(phone);
  if (s.length <= 2) return '••••••••';
  return '•'.repeat(s.length - 2) + s.slice(-2);
}

// ── Type config ───────────────────────────────────────────────────────────────
const TYPE_STYLE = {
  outgoing: { bg: 'bg-[#ECFDF5] dark:bg-[#052E1C]', text: 'text-[#059669] dark:text-[#34D399]', icon: '↗', label: 'Outgoing' },
  incoming: { bg: 'bg-[#EEF3FF] dark:bg-[#1A2540]', text: 'text-[#2563EB] dark:text-[#4F8EF7]', icon: '↙', label: 'Incoming' },
  missed:   { bg: 'bg-[#FEF2F2] dark:bg-[#2D0A0A]', text: 'text-[#DC2626] dark:text-[#F87171]', icon: '✕', label: 'Missed'   },
  rejected: { bg: 'bg-[#FFF0F3] dark:bg-[#2D0A14]', text: 'text-[#E1306C] dark:text-[#F77FAD]', icon: '⊘', label: 'Rejected' },
  unknown:  { bg: 'bg-[#F1F5F9] dark:bg-[#1A1D27]', text: 'text-[#8B92A9] dark:text-[#565C75]', icon: '?', label: 'Unknown'  },
};

function CallTypeBadge({ type }) {
  const s = TYPE_STYLE[type] || TYPE_STYLE.unknown;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span>{s.icon}</span>{s.label}
    </span>
  );
}

// ── Recording Player ──────────────────────────────────────────────────────────
function RecordingPlayer({ url, name }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else         { audioRef.current.play();  setPlaying(true);  }
  };

  return (
    <div className="flex items-center gap-2">
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} className="hidden" />
      <button onClick={toggle}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition text-white text-[11px] font-bold ${playing ? 'bg-[#DC2626]' : 'bg-[#2563EB] hover:bg-blue-700'}`}
        title={playing ? 'Pause' : 'Play recording'}>
        {playing ? '■' : '▶'}
      </button>
      <span className="text-[11px] text-[#8B92A9] truncate max-w-[120px]" title={name}>{name || 'Recording'}</span>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-8 animate-pulse">
      <div className="h-7 w-40 bg-[#E5E7EB] dark:bg-[#262A38] rounded-xl mb-2" />
      <div className="h-4 w-64 bg-[#E5E7EB] dark:bg-[#262A38] rounded-xl mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => <div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl h-24" />)}
      </div>
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl h-72" />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CallLogs() {
  const [logs,       setLogs]       = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [filter,     setFilter]     = useState({ type: 'all', employee: '', date: '' });
  const [isSuperAdmin] = useState(() => {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return u?.role === 'superadmin' || u?.role === 'super_admin';
  });

  const LIMIT = 25;

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (filter.type     && filter.type !== 'all') params.set('callType', filter.type);
      if (filter.employee) params.set('userId',   filter.employee);
      if (filter.date)     params.set('date',     filter.date);

      const res = await api.get(`/call-logs/admin?${params.toString()}`);
      setLogs(res.data?.logs     || []);
      setTotal(res.data?.total   || 0);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load call logs.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { setPage(1); fetchLogs(1); }, [filter]);
  useEffect(() => { if (page > 1) fetchLogs(page); }, [page]);

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalDuration = logs.reduce((s, l) => s + (l.duration || 0), 0);
  const outgoing      = logs.filter(l => l.callType === 'outgoing').length;
  const incoming      = logs.filter(l => l.callType === 'incoming').length;
  const missed        = logs.filter(l => l.callType === 'missed').length;
  const withRecording = logs.filter(l => l.recordings?.length > 0).length;

  const pages = Math.ceil(total / LIMIT);

  if (loading && page === 1) return <Skeleton />;

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[22px] sm:text-[24px] font-bold text-[#0F1117] dark:text-white">Call Logs</h1>
          <p className="text-[13px] text-[#8B92A9] mt-0.5">Calls synced from mobile app · all employees</p>
        </div>
        <button onClick={() => fetchLogs(page)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Calls',  value: total,         icon: '📞', color: '#2563EB' },
          { label: 'Outgoing',     value: outgoing,      icon: '↗',  color: '#059669' },
          { label: 'Missed',       value: missed,        icon: '✕',  color: '#DC2626' },
          { label: 'Recordings',   value: withRecording, icon: '🎙', color: '#7C3AED' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">{s.label}</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[15px]" style={{ background: s.color + '20' }}>{s.icon}</div>
            </div>
            <div className="text-[28px] font-bold text-[#0F1117] dark:text-white leading-none">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
          <p className="text-[12px] text-red-600 dark:text-red-400 flex-1">{error}</p>
          <button onClick={() => fetchLogs(page)} className="text-red-600 underline text-[11px]">Retry</button>
        </div>
      )}

      {/* Table card */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">

        {/* Filters */}
        <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-1 bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-1">
            {['all', 'outgoing', 'incoming', 'missed'].map(t => (
              <button key={t} onClick={() => setFilter(f => ({ ...f, type: t }))}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize whitespace-nowrap transition ${
                  filter.type === t ? 'bg-[#2563EB] text-white' : 'text-[#4B5168] dark:text-[#9DA3BB] hover:bg-white dark:hover:bg-[#1A1D27]'
                }`}>
                {t}
              </button>
            ))}
          </div>
          <input type="date" value={filter.date}
            onChange={e => setFilter(f => ({ ...f, date: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-white focus:outline-none focus:border-[#2563EB]" />
          <button onClick={() => setFilter({ type: 'all', employee: '', date: '' })}
            className="text-[12px] text-[#8B92A9] hover:text-[#DC2626] transition">Clear filters</button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E4E7EF] dark:border-[#262A38]">
                {['Time', 'Phone', 'Employee', 'Type', 'Duration', 'Lead', 'Recording'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-[#F0F2FA] dark:border-[#1E2130]">
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-4 bg-[#F1F5F9] dark:bg-[#262A38] rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-[13px] text-[#8B92A9]">
                    No call logs found. Make sure the mobile app is syncing correctly.
                  </td>
                </tr>
              ) : logs.map((log, i) => {
                const ts  = TYPE_STYLE[log.callType] || TYPE_STYLE.unknown;
                const lead = log.matchedLead;
                return (
                  <tr key={String(log._id || i)}
                    className="border-b border-[#F0F2FA] dark:border-[#1E2130] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
                    <td className="px-5 py-4 whitespace-nowrap text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">
                      {fmtDateTime(log.timestamp)}
                    </td>
                    <td className="px-5 py-4 font-mono text-[12px] text-[#0F1117] dark:text-white">
                      {isSuperAdmin ? (log.phoneNumber || '—') : maskPhone(log.phoneNumber)}
                    </td>
                    <td className="px-5 py-4">
                      {log.user ? (
                        <div>
                          <div className="font-semibold text-[#0F1117] dark:text-white text-[12px]">
                            {log.user?.name || 'Employee'}
                          </div>
                          <div className="text-[10px] text-[#8B92A9]">{log.user?.email || ''}</div>
                        </div>
                      ) : <span className="text-[#8B92A9]">—</span>}
                    </td>
                    <td className="px-5 py-4"><CallTypeBadge type={log.callType} /></td>
                    <td className="px-5 py-4 text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB]">
                      {fmtDuration(log.duration)}
                    </td>
                    <td className="px-5 py-4">
                      {lead ? (
                        <div>
                          <div className="text-[12px] font-semibold text-[#2563EB] dark:text-[#4F8EF7]">{lead.name}</div>
                          <div className="text-[10px] text-[#8B92A9]">{lead.status}</div>
                        </div>
                      ) : <span className="text-[11px] text-[#8B92A9]">No match</span>}
                    </td>
                    <td className="px-5 py-4">
                      {log.recordings?.length > 0 ? (
                        <RecordingPlayer url={log.recordings[0].url} name={log.recordings[0].name} />
                      ) : (
                        <span className="text-[11px] text-[#8B92A9]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="px-5 py-4 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
            <p className="text-[12px] text-[#8B92A9]">
              Showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} of {total} logs
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] disabled:opacity-30 hover:bg-[#F1F4FF] transition">
                ← Prev
              </button>
              <span className="px-3 py-1.5 text-[12px] text-[#8B92A9]">
                {page} / {pages}
              </span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="px-3 py-1.5 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] disabled:opacity-30 hover:bg-[#F1F4FF] transition">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Total duration footer */}
      <div className="mt-4 text-center">
        <p className="text-[12px] text-[#8B92A9]">
          Total call duration on this page: <span className="font-semibold text-[#2563EB]">{fmtDuration(totalDuration)}</span>
        </p>
      </div>
    </div>
  );
}
