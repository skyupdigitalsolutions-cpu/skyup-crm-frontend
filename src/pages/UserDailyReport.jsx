

import { useState, useMemo } from 'react';
import { useDailyReport } from '../hooks/useDailyReport';
import {
  addDays, formatLong, formatMedium, isToday as isTodayFn,
} from '../utils/dateUtils';
import { FlameIcon, CheckIcon, LoaderICon, TrendingUpIcon} from "lucide-icon";

const STATUS_STYLE = {
  'New':            { bg: 'bg-[#EEF3FF] dark:bg-[#1A2540]', text: 'text-[#2563EB] dark:text-[#4F8EF7]', dot: '#2563EB' },
  'In Progress':    { bg: 'bg-[#FFFBEB] dark:bg-[#2D1F00]', text: 'text-[#D97706] dark:text-[#FCD34D]', dot: '#D97706' },
  'Converted':      { bg: 'bg-[#ECFDF5] dark:bg-[#052E1C]', text: 'text-[#059669] dark:text-[#34D399]', dot: '#059669' },
  'Not Interested': { bg: 'bg-[#FEF2F2] dark:bg-[#2D0A0A]', text: 'text-[#DC2626] dark:text-[#F87171]', dot: '#DC2626' },
};
const TEMP_STYLE = {
  Hot:  { bg: 'bg-[#FEF2F2] dark:bg-[#2D0A0A]', text: 'text-[#DC2626] dark:text-[#F87171]', icon: '🔥' },
  Warm: { bg: 'bg-[#FFFBEB] dark:bg-[#2D1F00]', text: 'text-[#D97706] dark:text-[#FCD34D]', icon: '🌤' },
  Cold: { bg: 'bg-[#EEF3FF] dark:bg-[#1A2540]', text: 'text-[#2563EB] dark:text-[#4F8EF7]', icon: '❄' },
};
const SOURCE_COLORS = {
  'Google Ads': '#2563EB', 'Facebook Ads': '#0891B2', 'Web Form': '#059669',
  'Referral': '#D97706', 'Campaign': '#7C3AED', 'Other': '#8B92A9',
};

// ── Mini components ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color, trend }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: color + '20' }}>{icon}</div>
      </div>
      <div className="text-[28px] font-bold text-[#0F1117] dark:text-white leading-none mb-1">{value ?? '—'}</div>
      {sub && <div className="text-[11px] text-[#8B92A9]">{sub}</div>}
      {trend !== undefined && (
        <div className={`text-[11px] font-semibold mt-1 ${trend >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)} vs yesterday
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE['New'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />{status}
    </span>
  );
}

function TempBadge({ quality }) {
  const s = TEMP_STYLE[quality];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>
      {s.icon} {quality}
    </span>
  );
}

function FunnelBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[#4B5168] dark:text-[#E5E7EB]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-[#0F1117] dark:text-white">{value}</span>
          <span className="text-[10px] text-[#8B92A9] w-8 text-right">{pct}%</span>
        </div>
      </div>
      <div className="h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Card({ title, badge, bc, children }) {
  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-2">
        <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-white flex-1">{title}</h2>
        {badge !== undefined && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ background: (bc || '#2563EB') + '20', color: bc || '#2563EB' }}>{badge}</span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="bg-[#F0F4FF] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-8 animate-pulse">
      <div className="h-8 w-48 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-3" />
      <div className="h-4 w-64 bg-[#E4E7EF] dark:bg-[#262A38] rounded-xl mb-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl h-28" />
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function UserDailyReport() {
  const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
  const userId     = storedUser?._id || storedUser?.id || null;

  const [viewDate,  setViewDate]  = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');

  const viewingToday = isTodayFn(viewDate);

  const { data, loading, error, refresh } = useDailyReport({
    date:   viewDate,
    userId: userId || undefined,
  });

  const summary     = data?.summary     || {};
  const leads       = data?.leads       || [];
  const sources     = data?.sources     || [];
  const followUps   = data?.followUps   || [];
  const conversions = data?.conversions || [];

  // Derive quality counts from leads (temperature field)
  const hot  = useMemo(() => leads.filter(l => l.temperature === 'Hot').length,  [leads]);
  const warm = useMemo(() => leads.filter(l => l.temperature === 'Warm').length, [leads]);
  const cold = useMemo(() => leads.filter(l => l.temperature === 'Cold').length, [leads]);

  const goBack    = () => setViewDate(d => addDays(d, -1));
  const goForward = () => { if (!viewingToday) setViewDate(d => addDays(d, 1)); };
  const goToday   = () => setViewDate(new Date());

  const TABS = [
    { id: 'overview',    label: 'Overview',       count: null },
    { id: 'leads',       label: "Today's leads",  count: leads.length },
    { id: 'followups',   label: 'Follow-ups',     count: followUps.length },
    { id: 'conversions', label: 'Conversions',    count: conversions.length },
  ];

  if (loading) return <Skeleton />;

  return (
    <div className="min-h-screen bg-[#F0F4FF] dark:bg-[#0D0F14] px-4 sm:px-6 py-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${viewingToday ? 'bg-[#059669] animate-pulse' : 'bg-[#8B92A9]'}`} />
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${viewingToday ? 'text-[#059669]' : 'text-[#8B92A9]'}`}>
              {viewingToday ? 'Live — today' : 'Historical report'}
            </span>
          </div>
          <h1 className="text-[22px] sm:text-[24px] font-bold text-[#0F1117] dark:text-white">My Daily Report</h1>
          <p className="text-[13px] text-[#8B92A9] mt-0.5">
            {formatLong(viewDate)} · <span className="font-semibold text-[#2563EB]">{storedUser?.name || 'Employee'}</span>
          </p>
        </div>

        <div className="flex items-center gap-1 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-1">
          <button onClick={goBack} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#4B5168] transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button onClick={goToday}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition ${viewingToday ? 'bg-[#2563EB] text-white' : 'text-[#4B5168] dark:text-[#E5E7EB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38]'}`}>
            {viewingToday ? 'Today' : formatMedium(viewDate)}
          </button>
          <button onClick={goForward} disabled={viewingToday}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#4B5168] disabled:opacity-30 disabled:cursor-not-allowed transition">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <p className="text-[12px] font-semibold text-red-600 dark:text-red-400 flex-1">{error}</p>
          <button onClick={refresh} className="text-red-600 underline text-[11px] font-semibold">Retry</button>
        </div>
      )}

      {!error && leads.length === 0 && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-[#EEF3FF] dark:bg-[#1A2540] border border-[#C7D7FF] dark:border-[#2D3A6B]">
          <svg className="w-4 h-4 text-[#2563EB] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z"/></svg>
          <p className="text-[12px] font-semibold text-[#1D4ED8] dark:text-[#4F8EF7]">
            No leads for {formatMedium(viewDate)}.{' '}
            {viewingToday ? 'New leads will appear here as they are assigned.' : 'Try another date.'}
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Leads today"  value={summary.total || 0}      icon={<TrendingUpIcon  size={16} strokeWidth={2} />} color="#2563EB" sub="Assigned to you"                        trend={summary.trendTotal} />
        <StatCard label="Converted"    value={summary.converted || 0}  icon={<CheckIcon   size={16} strokeWidth={2} />} color="#059669" sub={`${summary.convRate || 0}% conv. rate`} trend={summary.trendConverted} />
        <StatCard label="In progress"  value={summary.inProgress || 0} icon={<LoaderIcon          size={16} strokeWidth={2} />} color="#D97706" sub="Need follow-up" />
        <StatCard label="Hot leads"    value={hot}                     icon={<FlameIcon          size={16} strokeWidth={2} />} color="#DC2626" sub={`${warm} warm · ${cold} cold`} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap transition ${
              activeTab === t.id ? 'bg-[#2563EB] text-white' : 'text-[#4B5168] dark:text-[#E5E7EB] hover:bg-[#F1F4FF] dark:hover:bg-[#21253A]'
            }`}>
            {t.label}
            {t.count !== null && t.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === t.id ? 'bg-white/20 text-white' : 'bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB]'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card title="Conversion funnel">
              <div className="space-y-3">
                <FunnelBar label="Total leads"    value={summary.total || 0}      total={summary.total || 0} color="#2563EB" />
                <FunnelBar label="Contacted"      value={summary.contacted || 0}  total={summary.total || 0} color="#0891B2" />
                <FunnelBar label="In progress"    value={summary.inProgress || 0} total={summary.total || 0} color="#D97706" />
                <FunnelBar label="Converted"      value={summary.converted || 0}  total={summary.total || 0} color="#059669" />
                <FunnelBar label="Not interested" value={summary.notInterested || 0} total={summary.total || 0} color="#DC2626" />
              </div>
              {(summary.total || 0) > 0 && (
                <div className="mt-4 pt-4 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between">
                  <span className="text-[12px] text-[#8B92A9]">Conversion rate</span>
                  <span className="text-[22px] font-bold text-[#059669] dark:text-[#34D399]">{summary.convRate || 0}%</span>
                </div>
              )}
            </Card>

            <Card title="Leads by source" badge={summary.total} bc="#2563EB">
              {sources.length === 0 ? (
                <p className="text-[13px] text-[#8B92A9] py-8 text-center">No leads for {formatMedium(viewDate)}.</p>
              ) : (
                <div className="space-y-3.5">
                  {sources.map(s => {
                    const color = SOURCE_COLORS[s.label] || '#8B92A9';
                    return (
                      <div key={s.label}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-[12px] text-[#4B5168] dark:text-[#E5E7EB]">{s.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-[#0F1117] dark:text-white">{s.count}</span>
                            <span className="text-[10px] text-[#8B92A9] w-8 text-right">
                              {Math.round(s.count / (summary.total || 1) * 100)}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-[#F1F4FF] dark:bg-[#262A38] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.round(s.count / (summary.total || 1) * 100)}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card title="Status breakdown">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'New',         value: summary.newLeads || 0,      ...STATUS_STYLE['New'] },
                  { label: 'In progress', value: summary.inProgress || 0,    ...STATUS_STYLE['In Progress'] },
                  { label: 'Converted',   value: summary.converted || 0,     ...STATUS_STYLE['Converted'] },
                  { label: 'Not int.',    value: summary.notInterested || 0, ...STATUS_STYLE['Not Interested'] },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl px-4 py-3.5 ${s.bg}`}>
                    <div className={`text-[24px] font-bold ${s.text}`}>{s.value}</div>
                    <div className={`text-[11px] font-semibold ${s.text} opacity-80 mt-0.5`}>{s.label}</div>
                    {(summary.total || 0) > 0 && (
                      <div className={`text-[10px] ${s.text} opacity-60 mt-0.5`}>
                        {Math.round(s.value / (summary.total || 1) * 100)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Quality heatmap */}
          <Card title="Lead quality — today">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Hot',  value: hot,  bg: 'bg-[#FEF2F2] dark:bg-[#2D0A0A]', text: 'text-[#DC2626] dark:text-[#F87171]', bar: '#DC2626' },
                { label: 'Warm', value: warm, bg: 'bg-[#FFFBEB] dark:bg-[#2D1F00]', text: 'text-[#D97706] dark:text-[#FCD34D]', bar: '#D97706' },
                { label: 'Cold', value: cold, bg: 'bg-[#EEF3FF] dark:bg-[#1A2540]', text: 'text-[#2563EB] dark:text-[#4F8EF7]', bar: '#2563EB' },
              ].map(t => (
                <div key={t.label} className={`rounded-2xl p-4 text-center ${t.bg}`}>
                  <div className={`text-[30px] font-bold ${t.text}`}>{t.value}</div>
                  <div className={`text-[12px] font-semibold ${t.text} mt-1`}>{t.label}</div>
                  <div className="h-1.5 bg-white/40 dark:bg-black/20 rounded-full mt-3 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(summary.total || 0) > 0 ? Math.round(t.value / summary.total * 100) : 0}%`, background: t.bar }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TODAY'S LEADS */}
      {activeTab === 'leads' && (
        <Card title={`Leads on ${formatMedium(viewDate)}`} badge={leads.length} bc="#2563EB">
          {leads.length === 0 ? (
            <div className="py-14 text-center">
              <div className="text-[40px] mb-3">📋</div>
              <p className="text-[13px] text-[#8B92A9]">No leads for {formatMedium(viewDate)}.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leads.map((l, i) => (
                <div key={String(l._id || i)}
                  className="flex items-center gap-3 p-3.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
                  <div className="w-9 h-9 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center text-[10px] font-bold text-[#2563EB] shrink-0">
                    {(l.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[13px] font-semibold text-[#0F1117] dark:text-white">{l.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: (SOURCE_COLORS[l.source] || '#8B92A9') + '20', color: SOURCE_COLORS[l.source] || '#8B92A9' }}>
                        {l.source}
                      </span>
                      <StatusBadge status={l.status} />
                      <TempBadge quality={l.temperature} />
                      {l.remark && <span className="text-[10px] text-[#8B92A9] italic truncate max-w-[180px]">{l.remark}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-[#8B92A9]">
                      {l.date ? new Date(l.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* FOLLOW-UPS */}
      {activeTab === 'followups' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard label="Total follow-ups" value={followUps.length}                                    icon="🔔" color="#D97706" sub="Pending" />
            <StatCard label="Overdue"          value={followUps.filter(f => f.urgency === 'overdue').length} icon="⚠" color="#DC2626" sub="Past due" />
            <StatCard label="Due today"        value={followUps.filter(f => f.urgency === 'today').length}   icon="☎" color="#D97706" sub="Call now" />
          </div>
          <Card title="Pending follow-ups" badge={followUps.length} bc="#D97706">
            {followUps.length === 0 ? (
              <p className="text-[13px] text-center text-[#8B92A9] py-10">No pending follow-ups. Great work! 🎉</p>
            ) : (
              <div className="space-y-2">
                {followUps.map((f, i) => {
                  const urgent = f.urgency === 'overdue' || f.urgency === 'today';
                  return (
                    <div key={i}
                      className={`flex items-start gap-3 p-4 rounded-xl border ${urgent ? 'border-[#FDE68A] dark:border-[#78350F] bg-[#FFFBEB] dark:bg-[#2D1F00]' : 'border-[#E4E7EF] dark:border-[#262A38]'}`}>
                      <div className="w-2 h-2 rounded-full mt-2 shrink-0" style={{ background: f.dotColor }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                          <span className="text-[13px] font-semibold text-[#0F1117] dark:text-white">{f.name}</span>
                          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            f.urgency === 'overdue' ? 'bg-red-100 text-red-600' :
                            f.urgency === 'today'   ? 'bg-amber-100 text-amber-600' :
                            'bg-blue-100 text-blue-600'
                          }`}>{f.daysLabel}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] text-[#4B5168] dark:text-[#E5E7EB] italic">{f.note || 'Follow-up required'}</p>
                          <span className="text-[12px] text-[#8B92A9] shrink-0 ml-2">
                            {f.scheduledAt ? new Date(f.scheduledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* CONVERSIONS */}
      {activeTab === 'conversions' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Today's closures" value={conversions.length}          icon="🎉" color="#059669" sub={formatMedium(viewDate)} trend={summary.trendConverted} />
            <StatCard label="Conv. rate today" value={`${summary.convRate || 0}%`} icon="📈" color="#7C3AED" sub="For selected day" />
            <StatCard label="Calls made today" value={summary.callsMadeToday || 0} icon="☎" color="#2563EB" sub="Total calls" />
            <StatCard label="Total leads"      value={summary.total || 0}          icon="📋" color="#D97706" sub="For this date" />
          </div>

          <Card title={`Conversions on ${formatMedium(viewDate)}`} badge={conversions.length} bc="#059669">
            {conversions.length === 0 ? (
              <div className="py-14 text-center">
                <div className="text-[40px] mb-3">🎯</div>
                <p className="text-[14px] text-[#8B92A9]">No conversions on {formatMedium(viewDate)}.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {conversions.map((l, i) => (
                  <div key={String(l._id || i)}
                    className="flex items-center gap-3 p-4 rounded-xl bg-[#ECFDF5] dark:bg-[#052E1C] border border-[#D1FAE5] dark:border-[#065F46]">
                    <div className="w-9 h-9 rounded-full bg-[#059669] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                      {(l.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-[14px] font-semibold text-[#065F46] dark:text-[#34D399]">{l.name}</span>
                        {l.campaign && <span className="text-[12px] px-2 py-0.5 rounded-full bg-white/50 text-[#065F46] font-medium">{l.campaign}</span>}
                      </div>
                      <div className="text-[12px] text-[#059669] opacity-80">{l.source}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[12px] font-bold bg-[#059669] text-white shrink-0">Converted</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
