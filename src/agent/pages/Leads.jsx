import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLeads } from '../leads.jsx';
import LeadRow from '../components/LeadRow.jsx';
import { TopBar } from '../components/Shell.jsx';
import { IconFilter, IconRefresh, IconSearch } from '../components/icons.jsx';
import Sheet from '../components/Sheet.jsx';
import { DATE_PRESETS, SORTS, activeFilterCount, applyLeadFilters, distinct, sortLeads } from '../leadFilters.js';
import { getFilterOptions } from '../api.js';

const STATUS_FILTERS = ['All', 'New', 'In Progress', 'Interested', 'Converted', 'Not Interested'];
const TEMP_FILTERS = ['Hot', 'Warm', 'Cold'];
const PAGE = 50;

export default function Leads() {
  const { leads, loading, error, refresh } = useLeads();
  const [params, setParams] = useSearchParams();
  const [customFilters, setCustomFilters] = useState([]);
  useEffect(() => { let on = true; getFilterOptions().then((x) => { if (on) setCustomFilters(x); }); return () => { on = false; }; }, []);
  const status = params.get('status') || 'All';
  const temp = params.get('temp') || '';
  const view = params.get('view') || '';
  const date = params.get('date') || 'all';
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const industry = params.get('industry') || '';
  const source = params.get('source') || '';
  const sort = params.get('sort') || 'recent';
  const [sheet, setSheet] = useState(false);
  const [q, setQ] = useState(params.get('q') || '');
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef(null);

  // Functional update: two quick taps (for example "All time", then an industry) both apply, instead of the second
  // one starting from a stale copy of the address.
  const setParam = (k, v) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (v) next.set(k, v); else next.delete(k);
      return next;
    }, { replace: true });
    setLimit(PAGE);
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = leads;
    if (view === 'followups') {
      const end = new Date(); end.setHours(23, 59, 59, 999);
      list = list.filter((l) => l.followUpDate && new Date(l.followUpDate) <= end)
        .sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));
    }
    list = applyLeadFilters(list, { q: needle, status, temp, date, from, to, industry, source, custom });
    return view === 'followups' ? list : sortLeads(list, sort);
  }, [leads, q, status, temp, view, date, from, to, industry, source, sort, customFilters, params]);
  const industries = useMemo(() => distinct(leads, 'industry'), [leads]);
  const sources = useMemo(() => distinct(leads, 'source'), [leads]);
  const custom = {}; customFilters.forEach((cf) => { const v = params.get(`cf_${cf.key}`); if (v) custom[cf.key] = v; });
  const customActive = Object.keys(custom).length;
  const filterCount = activeFilterCount({ status, temp, date, industry, source }) + customActive;
  const clearAll = () => { setParams(new URLSearchParams(view ? { view } : {}), { replace: true }); setQ(''); setLimit(PAGE); };

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
            placeholder="Search name, phone, email or campaign"
            value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
            aria-label="Search leads"
          />
        </label>
        <button className="btn block ghost" style={{ marginTop: 10 }} onClick={() => setSheet(true)} aria-label="Filter and sort">
          <IconFilter />Filter &amp; sort{filterCount ? <span className="badge">{filterCount}</span> : null}
        </button>

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
            {q || filterCount ? 'Clear the search or filters to see all your leads.' : 'New leads assigned to you appear here.'}
          </div>
        )}
        {limit < filtered.length ? <div ref={sentinel} style={{ height: 1 }} /> : null}
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} label="Filter and sort leads">
        <h3>Filter &amp; sort</h3>
        <div className="group-label">Received</div>
        <div className="chip-grid" role="group" aria-label="Received">
          {DATE_PRESETS.map((d) => <button key={d.id} className={`chip${date === d.id ? ' on' : ''}`} aria-pressed={date === d.id} onClick={() => setParam('date', d.id === 'all' ? '' : d.id)}>{d.label}</button>)}
        </div>
        {date === 'custom' ? (
          <div className="field-row" style={{ marginTop: 10 }}>
            <label className="field"><span>From</span><input className="input" type="date" value={from} onChange={(e) => setParam('from', e.target.value)} aria-label="From date" /></label>
            <label className="field"><span>To</span><input className="input" type="date" value={to} onChange={(e) => setParam('to', e.target.value)} aria-label="To date" /></label>
          </div>
        ) : null}
        {industries.length ? (
          <label className="field" style={{ marginTop: 14 }}><span>Industry</span>
            <select className="select" value={industry} onChange={(e) => setParam('industry', e.target.value)} aria-label="Industry">
              <option value="">All industries</option>{industries.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
        ) : null}
        {sources.length ? (
          <label className="field"><span>Source</span>
            <select className="select" value={source} onChange={(e) => setParam('source', e.target.value)} aria-label="Source">
              <option value="">All sources</option>{sources.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
        ) : null}
        {customFilters.map((cf) => (
          cf.values && cf.values.length ? (
            <label className="field" key={cf.key}><span>{cf.label}</span>
              <select className="select" value={params.get(`cf_${cf.key}`) || ''} onChange={(e) => setParam(`cf_${cf.key}`, e.target.value)} aria-label={cf.label}>
                <option value="">All {cf.label.toLowerCase()}</option>{cf.values.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          ) : null
        ))}
        <label className="field"><span>Sort by</span>
          <select className="select" value={sort} onChange={(e) => setParam('sort', e.target.value === 'recent' ? '' : e.target.value)} aria-label="Sort by">
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <button className="btn block" onClick={() => setSheet(false)} style={{ marginTop: 6 }}>Show {filtered.length} {filtered.length === 1 ? 'lead' : 'leads'}</button>
        <button className="btn block ghost" onClick={clearAll} style={{ marginTop: 8 }}>Clear all filters</button>
      </Sheet>
    </>
  );
}
