import { useState, useEffect, useMemo, useCallback } from "react";
import api from "../data/axiosConfig";
import { fetchAll, getRole } from "../data/dataService";
import { STATUS_CONFIG } from "../utils/statusConfig";
import { LayoutGrid, RefreshCw, AlertTriangle, Clock, GripVertical } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline / Bottleneck Board  (pain points #34 real-time pipeline, #44 bottlenecks)
//
// Kanban board of leads by stage. Drag a card to another column to change its
// status (persists via the existing PUT /lead/(admin|superadmin)/:id endpoint).
// Each card shows AGE IN STAGE (days since last update) with a colour that turns
// amber/red as a lead stalls — so bottlenecks are visible at a glance.
//
// Frontend-only: no new backend. Uses native HTML5 drag-and-drop (no new deps).
// ─────────────────────────────────────────────────────────────────────────────

// Active pipeline stages shown as columns (terminal states handled separately).
const STAGES = ["New", "In Progress", "Verification", "Converted"];

// Lead-aging thresholds (days in current stage) → colour signal for bottlenecks.
const AGE_OK = 2;    // ≤2 days: fine
const AGE_WARN = 5;  // 3-5 days: amber; >5: red

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d)) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function ageColor(days) {
  if (days > AGE_WARN) return { dot: "#DC2626", text: "text-rose-600", label: "stalled" };
  if (days > AGE_OK)   return { dot: "#D97706", text: "text-amber-600", label: "aging" };
  return { dot: "#059669", text: "text-emerald-600", label: "fresh" };
}

export default function PipelineBoard() {
  const role = getRole();
  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [dragId, setDragId]   = useState(null);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const all = await fetchAll();
      const list = Array.isArray(all) ? all : (all?.leads || []);
      // Only active leads (exclude merged/closed terminal records)
      setLeads(list.filter((l) => !l.mergedInto && !l.isClosed));
    } catch (e) {
      setError(e?.response?.data?.message || "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group leads by stage.
  const byStage = useMemo(() => {
    const g = Object.fromEntries(STAGES.map((s) => [s, []]));
    for (const l of leads) {
      const s = STAGES.includes(l.status) ? l.status : "New";
      g[s].push(l);
    }
    // Sort each column oldest-first so stalled leads surface at the top.
    for (const s of STAGES) {
      g[s].sort((a, b) => daysSince(b.updatedAt || b.date) - daysSince(a.updatedAt || a.date));
    }
    return g;
  }, [leads]);

  // Drag handlers
  const onDragStart = (id) => setDragId(id);
  const onDragEnd   = () => setDragId(null);

  const onDrop = async (stage) => {
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const lead = leads.find((l) => (l._id || l.id) === id);
    if (!lead || lead.status === stage) return;

    // Optimistic update
    const prev = lead.status;
    setLeads((ls) => ls.map((l) => ((l._id || l.id) === id ? { ...l, status: stage, updatedAt: new Date().toISOString() } : l)));
    setSavingId(id);
    try {
      if (role === "superadmin") {
        await api.put(`/lead/superadmin/${id}`, { status: stage });
      } else if (role === "admin") {
        await api.put(`/lead/admin/${id}`, { status: stage });
      } else {
        // PATCH /lead/:id accepts a status-only update
        await api.patch(`/lead/${id}`, { status: stage });
      }
    } catch (e) {
      // Revert on failure
      setLeads((ls) => ls.map((l) => ((l._id || l.id) === id ? { ...l, status: prev } : l)));
      setError("Could not move lead — change reverted.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-[#6366F1]" />
          <h1 className="text-xl font-bold text-[#0F1117] dark:text-[#F0F2FA]">Pipeline Board</h1>
        </div>
        <button onClick={load} disabled={loading}
          className="px-3 py-2 rounded-lg border border-[#E2E8F0] dark:border-[#1E2130] text-sm flex items-center gap-2 text-[#64748B]">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>
      <p className="text-sm text-[#64748B] mb-4">
        Drag a lead to change its stage. Card colour shows how long it has been stuck — amber = aging, red = stalled.
      </p>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 text-sm">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {STAGES.map((stage) => {
          const cfg = STATUS_CONFIG[stage] || STATUS_CONFIG.New;
          const items = byStage[stage] || [];
          const stalled = items.filter((l) => daysSince(l.updatedAt || l.date) > AGE_WARN).length;
          return (
            <div
              key={stage}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(stage)}
              className="rounded-xl bg-[#F8FAFC] dark:bg-[#0D0F14] border border-[#E2E8F0] dark:border-[#1E2130] p-2 min-h-[200px]"
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-2 py-2 mb-2 sticky top-0">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.dot }} />
                  <span className="text-sm font-bold text-[#0F1117] dark:text-[#F0F2FA]">{stage}</span>
                  <span className="text-xs text-[#64748B]">({items.length})</span>
                </div>
                {stalled > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 font-semibold">
                    {stalled} stalled
                  </span>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {items.map((l) => {
                  const id = l._id || l.id;
                  const age = daysSince(l.updatedAt || l.date);
                  const ac = ageColor(age);
                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={() => onDragStart(id)}
                      onDragEnd={onDragEnd}
                      className={`group rounded-lg bg-white dark:bg-[#12141C] border border-[#E2E8F0] dark:border-[#1E2130] p-3 cursor-grab active:cursor-grabbing shadow-sm ${dragId === id ? "opacity-50" : ""} ${savingId === id ? "ring-2 ring-[#6366F1]" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-4 h-4 text-[#CBD5E1] dark:text-[#334155] mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">{l.name || "Unknown"}</div>
                          <div className="text-xs text-[#64748B] truncate">{l.campaign || l.source || "—"}</div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Clock className="w-3 h-3" style={{ color: ac.dot }} />
                            <span className={`text-[11px] font-semibold ${ac.text}`}>
                              {age === 0 ? "today" : `${age}d in stage`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="text-center text-xs text-[#94A3B8] py-6">No leads</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
