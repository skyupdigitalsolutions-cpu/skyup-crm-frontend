import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLeads } from '../leads.jsx';
import LeadRow from '../components/LeadRow.jsx';
import { TopBar } from '../components/Shell.jsx';
import { IconRefresh, IconSearch } from '../components/icons.jsx';

const STATUS_FILTERS = ['All', 'New', 'In Progress', 'Interested', 'Converted', 'Not Interested'];
const TEMP_FILTERS = ['Hot', 'Warm', 'Cold'];
const PAGE = 50;

export default function Leads() {
  const { leads, loading, error, refresh } = useLeads();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'All';
  const temp = params.get('temp') || '';
  const view = params.get('view') || '';
  const [q, setQ] = useState(params.get('q') || '');
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef(null);

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
    setLimit(PAGE);
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, '');
    let list = leads;
    if (view === 'followups') {
      const end = new Date(); end.setHours(23, 59, 59, 999);
      list = list.filter((l) => l.followUpDate && new Date(l.followUpDate) <= end)
        .sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));
    }
    if (status !== 'All') list = list.filter((l) => l.status === status);
    if (temp) list = list.filter((l) => l.temperature === temp);
    if (needle) {
      list = list.filter((l) =>
        l.name.toLowerCase().includes(needle) ||
        (digits.length >= 3 && l.phone.replace(/\D/g, '').includes(digits)) ||
        l.email.toLowerCase().includes(needle) ||
        (l.source || '').toLowerCase().includes(needle));
    }
    return list;
  }, [leads, q, status, temp, view]);

  // Render 50 rows at a time; load more as the list end scrolls into view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setLimit((n) => n + PAGE);
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  return (
    <>
      <TopBar
        title={view === 'followups' ? 'Follow-ups due' : 'My leads'}
        back={view === 'followups' ? '/agent' : undefined}
        right={
          <button className="icon-btn" onClick={refresh} aria-label="Refresh leads" disabled={loading}>
            <span style={{ display: 'inline-grid', animation: loading ? 'agent-spin 0.8s linear infinite' : 'none' }}><IconRefresh /></span>
          </button>
        }
      />
      <div className="page">
        <label className="search">
          <IconSearch />
          <input
            type="search"
            placeholder="Search name, phone or email"
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
            aria-label="Search leads"
          />
        </label>

        <div className="chips" style={{ marginTop: 12 }} role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((s) => (
            <button key={s} className={`chip${status === s ? ' on' : ''}`} onClick={() => setParam('status', s === 'All' ? '' : s)}>{s}</button>
          ))}
        </div>
        <div className="chips" style={{ marginTop: 8 }} role="group" aria-label="Filter by temperature">
          {TEMP_FILTERS.map((t) => (
            <button key={t} className={`chip${temp === t ? ' on' : ''}`} onClick={() => setParam('temp', temp === t ? '' : t)}>{t}</button>
          ))}
        </div>

        {error && !leads.length ? <div className="alert error" style={{ marginTop: 16 }}>{error}</div> : null}

        <p className="small muted" style={{ margin: '14px 2px 8px' }}>
          {filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}
        </p>

        {loading && !leads.length ? <div className="spinner" /> : filtered.length ? (
          <div className="list">
            {filtered.slice(0, limit).map((l) => <LeadRow key={l.id} lead={l} showFollowUp={view === 'followups'} />)}
          </div>
        ) : (
          <div className="list empty">
            <b>No leads match</b>
            {q || status !== 'All' || temp ? 'Clear the search or filters to see all your leads.' : 'New leads assigned to you appear here.'}
          </div>
        )}
        {limit < filtered.length ? <div ref={sentinel} style={{ height: 1 }} /> : null}
      </div>
    </>
  );
}
