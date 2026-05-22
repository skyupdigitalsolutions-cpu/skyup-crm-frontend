

import { useState, useEffect, useCallback } from 'react';
import api from '../../data/axiosConfig';

// ── Plan config (mirrors backend PLANS constant) ──────────────────────────────
const PLANS = {
  basic:      { name: 'Basic',      color: '#6B7280', price: '₹999/mo',  maxUsers: 5,   maxLeads: 1000   },
  pro:        { name: 'Pro',        color: '#2563EB', price: '₹2999/mo', maxUsers: 20,  maxLeads: 10000  },
  enterprise: { name: 'Enterprise', color: '#7C3AED', price: '₹9999/mo', maxUsers: 999, maxLeads: 999999 },
};

const STATUS_STYLE = {
  active:    { bg: 'bg-[#ECFDF5] dark:bg-[#052E1C]', text: 'text-[#059669] dark:text-[#34D399]', dot: '#059669', label: 'Active'    },
  trial:     { bg: 'bg-[#EEF3FF] dark:bg-[#1A2540]', text: 'text-[#2563EB] dark:text-[#4F8EF7]', dot: '#2563EB', label: 'Trial'     },
  cancelled: { bg: 'bg-[#FEF2F2] dark:bg-[#2D0A0A]', text: 'text-[#DC2626] dark:text-[#F87171]', dot: '#DC2626', label: 'Cancelled' },
  expired:   { bg: 'bg-[#FFFBEB] dark:bg-[#2D1F00]', text: 'text-[#D97706] dark:text-[#FCD34D]', dot: '#D97706', label: 'Expired'   },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.cancelled;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-8 animate-pulse">
      <div className="h-7 w-52 bg-[#E5E7EB] dark:bg-[#262A38] rounded-xl mb-2" />
      <div className="h-4 w-72 bg-[#E5E7EB] dark:bg-[#262A38] rounded-xl mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl h-24" />
        ))}
      </div>
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E5E7EB] dark:border-[#262A38] rounded-2xl h-64" />
    </div>
  );
}

// ── Activate / Change Plan Modal ──────────────────────────────────────────────
function ActivateModal({ company, onClose, onSuccess }) {
  const [plan,     setPlan]     = useState(company.plan || 'basic');
  const [billing,  setBilling]  = useState('monthly');
  const [months,   setMonths]   = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      await api.post(`/subscription/activate/${company._id}`, {
        plan, billing, durationMonths: Number(months),
      });
      onSuccess('Subscription activated successfully.');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to activate subscription.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[16px] font-bold text-[#0F1117] dark:text-white">Activate Subscription</h3>
          <button onClick={onClose} className="text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white transition">✕</button>
        </div>

        <p className="text-[13px] text-[#8B92A9] mb-5">Company: <span className="font-semibold text-[#0F1117] dark:text-white">{company.name}</span></p>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">
            <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-semibold text-[#8B92A9] uppercase tracking-wide block mb-2">Plan</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PLANS).map(([key, p]) => (
                <button key={key} onClick={() => setPlan(key)}
                  className={`py-2.5 rounded-xl text-[12px] font-semibold border transition ${
                    plan === key
                      ? 'border-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB]'
                      : 'border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB]'
                  }`}>
                  {p.name}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#8B92A9] mt-1.5">{PLANS[plan].price} · {PLANS[plan].maxUsers} users · {PLANS[plan].maxLeads.toLocaleString()} leads</p>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#8B92A9] uppercase tracking-wide block mb-2">Billing</label>
            <div className="flex gap-2">
              {['monthly', 'yearly'].map(b => (
                <button key={b} onClick={() => setBilling(b)}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-semibold border transition capitalize ${
                    billing === b
                      ? 'border-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB]'
                      : 'border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB]'
                  }`}>
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#8B92A9] uppercase tracking-wide block mb-2">Duration (months)</label>
            <input
              type="number" min={1} max={60} value={months}
              onChange={e => setMonths(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white focus:outline-none focus:border-[#2563EB]"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F8F9FC] dark:hover:bg-[#262A38] transition">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-60 transition">
            {loading ? 'Activating…' : 'Activate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Extend Trial Modal ────────────────────────────────────────────────────────
function ExtendTrialModal({ company, onClose, onSuccess }) {
  const [days,    setDays]    = useState(7);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      await api.post(`/subscription/extend-trial/${company._id}`, { days: Number(days) });
      onSuccess(`Trial extended by ${days} days.`);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to extend trial.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-bold text-[#0F1117] dark:text-white">Extend Trial</h3>
          <button onClick={onClose} className="text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-white">✕</button>
        </div>
        <p className="text-[13px] text-[#8B92A9] mb-4">Company: <span className="font-semibold text-[#0F1117] dark:text-white">{company.name}</span></p>
        {error && <p className="text-[12px] text-red-500 mb-3">{error}</p>}
        <label className="text-[12px] font-semibold text-[#8B92A9] uppercase tracking-wide block mb-2">Days to extend</label>
        <input type="number" min={1} max={90} value={days} onChange={e => setDays(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white focus:outline-none focus:border-[#2563EB] mb-5" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] hover:bg-[#F8F9FC] transition">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-60 transition">
            {loading ? 'Extending…' : 'Extend'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Calendar-accurate days remaining ─────────────────────────────────────────
// Uses UTC midnight comparison so "June 3 → July 3" = exactly 30 days,
// regardless of DST or the millisecond rounding used by the backend.
function calcDaysRemaining(expiryDateStr) {
  if (!expiryDateStr) return null;
  const now   = new Date();
  const expiry = new Date(expiryDateStr);
  // Normalise both to UTC midnight to get whole-day difference
  const nowMidnight    = Date.UTC(now.getUTCFullYear(),    now.getUTCMonth(),    now.getUTCDate());
  const expiryMidnight = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
  const diff = Math.round((expiryMidnight - nowMidnight) / 86_400_000);
  return diff > 0 ? diff : 0;
}


export default function Subscriptions() {
  const [companies, setCompanies] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [toast,     setToast]     = useState('');
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('all');

  // Modals
  const [activateTarget, setActivateTarget] = useState(null);
  const [trialTarget,    setTrialTarget]    = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/subscription/all');
      const raw = res.data?.companies || [];
      // Recompute daysRemaining on the frontend so "Jun 3 → Jul 3" = 30 days
      const companies = raw.map(c => ({
        ...c,
        daysRemaining: calcDaysRemaining(c.subscriptionExpiry || c.trialEndsAt),
      }));
      setCompanies(companies);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load subscriptions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCancel = async (company) => {
    if (!window.confirm(`Cancel subscription for ${company.name}?`)) return;
    try {
      await api.post(`/subscription/cancel/${company._id}`);
      showToast('Subscription cancelled.');
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to cancel.', true);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  // Derived stats
  const stats = {
    total:     companies.length,
    active:    companies.filter(c => c.subscriptionStatus === 'active').length,
    trial:     companies.filter(c => c.subscriptionStatus === 'trial').length,
expiring: companies.filter(c => c.daysRemaining >= 0 && c.daysRemaining <= 30 && ['active','trial'].includes(c.subscriptionStatus)).length,
  };

  const filtered = companies.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || c.subscriptionStatus === filter;
    return matchSearch && matchFilter;
  });

  if (loading) return <Skeleton />;

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-4 sm:px-6 py-8">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl bg-[#059669] text-white text-[13px] font-semibold shadow-lg">
          {toast}
        </div>
      )}

      {/* Activate modal */}
      {activateTarget && (
        <ActivateModal
          company={activateTarget}
          onClose={() => setActivateTarget(null)}
          onSuccess={msg => { showToast(msg); fetchData(); }}
        />
      )}

      {/* Extend trial modal */}
      {trialTarget && (
        <ExtendTrialModal
          company={trialTarget}
          onClose={() => setTrialTarget(null)}
          onSuccess={msg => { showToast(msg); fetchData(); }}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[22px] sm:text-[24px] font-bold text-[#0F1117] dark:text-white">Subscriptions</h1>
          <p className="text-[13px] text-[#8B92A9] mt-0.5">Manage client plans, billing, and trial extensions</p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] transition">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Companies', value: stats.total,    color: '#2563EB', icon: '🏢' },
          { label: 'Active',          value: stats.active,   color: '#059669', icon: '✅' },
          { label: 'On Trial',        value: stats.trial,    color: '#7C3AED', icon: '⏳' },
          { label: 'Expiring Soon',   value: stats.expiring, color: '#D97706', icon: '⚠' },
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
          <button onClick={fetchData} className="text-red-600 underline text-[11px]">Retry</button>
        </div>
      )}

      {/* Table card */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">

        {/* Filters */}
        <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex flex-col sm:flex-row gap-3">
          <input
            type="text" placeholder="Search by company or email…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-white placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB]"
          />
          <div className="flex items-center gap-1 bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-1">
            {['all', 'active', 'trial', 'cancelled', 'expired'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize whitespace-nowrap transition ${
                  filter === f ? 'bg-[#2563EB] text-white' : 'text-[#4B5168] dark:text-[#9DA3BB] hover:bg-white dark:hover:bg-[#1A1D27]'
                }`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#E4E7EF] dark:border-[#262A38]">
                {['Company', 'Plan', 'Status', 'Days Remaining', 'Expires / Trial End', 'Actions'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-[13px] text-[#8B92A9]">
                    {search ? 'No companies match your search.' : 'No companies found.'}
                  </td>
                </tr>
              ) : filtered.map(c => {
                const planInfo    = PLANS[c.plan] || { name: c.plan, color: '#8B92A9' };
                const expiryDate  = c.subscriptionExpiry || c.trialEndsAt;
                return (
                  <tr key={c._id} className="border-b border-[#F0F2FA] dark:border-[#1E2130] hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                          style={{ background: planInfo.color }}>
                          {(c.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-[#0F1117] dark:text-white">{c.name}</div>
                          <div className="text-[11px] text-[#8B92A9]">{c.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white" style={{ background: planInfo.color }}>
                        {planInfo.name}
                      </span>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={c.subscriptionStatus} /></td>
                    <td className="px-5 py-4">
                      {c.subscriptionStatus === 'cancelled' ? (
                        <span className="text-[13px] text-[#8B92A9]">—</span>
                      ) : c.daysRemaining === 0 ? (
                        <span className="font-bold text-[13px] text-[#DC2626]">Expired</span>
                      ) : (
                        <span className={`font-bold text-[13px] ${
                          c.daysRemaining <= 7  ? 'text-[#DC2626]' :
                          c.daysRemaining <= 30 ? 'text-[#D97706]' :
                                                  'text-[#059669]'
                        }`}>
                          {c.daysRemaining}d
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-[#4B5168] dark:text-[#9DA3BB]">
                      {expiryDate ? new Date(expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setActivateTarget(c)}
                          className="px-3 py-1.5 rounded-lg bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] text-[11px] font-semibold hover:bg-blue-100 transition">
                          {c.subscriptionStatus === 'active' ? 'Change Plan' : 'Activate'}
                        </button>
                        {c.subscriptionStatus === 'trial' && (
                          <button onClick={() => setTrialTarget(c)}
                            className="px-3 py-1.5 rounded-lg bg-[#F5F3FF] dark:bg-[#1E1040] text-[#7C3AED] text-[11px] font-semibold hover:bg-purple-100 transition">
                            Extend Trial
                          </button>
                        )}
                        {c.subscriptionStatus === 'active' && (
                          <button onClick={() => handleCancel(c)}
                            className="px-3 py-1.5 rounded-lg bg-[#FEF2F2] dark:bg-[#2D0A0A] text-[#DC2626] text-[11px] font-semibold hover:bg-red-100 transition">
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-[#E4E7EF] dark:border-[#262A38]">
          <p className="text-[12px] text-[#8B92A9]">Showing {filtered.length} of {companies.length} companies</p>
        </div>
      </div>
    </div>
  );
}
