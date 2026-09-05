// src/components/FestivalCampaigns.jsx
//
// "Festival Campaigns" — lets a company admin schedule a WhatsApp / Email
// festive-greeting template to auto-send to their leads on a specific date.
// Opened as a modal from Communications.jsx, next to the existing
// Integrations / Auto-Blast Settings buttons.

import { useState, useEffect } from "react";
import api from "../data/axiosConfig";
import { Sparkles, X, Calendar, Send, Pause, Play, Trash2, Beaker } from "lucide-react";

const FIELD_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#EA580C] transition";

const STATUS_STYLES = {
  scheduled: { label: "Scheduled", cls: "bg-[#eff6ff] dark:bg-[#0a1a33] text-[#2563EB]" },
  sending:   { label: "Sending…",  cls: "bg-[#fffbeb] dark:bg-[#1c1600] text-[#D97706]" },
  sent:      { label: "Sent",      cls: "bg-[#f0fdf4] dark:bg-[#052e1c] text-[#16A34A]" },
  failed:    { label: "Failed",    cls: "bg-[#fef2f2] dark:bg-[#2a0a0a] text-[#DC2626]" },
  cancelled: { label: "Cancelled", cls: "bg-[#F1F5F9] dark:bg-[#262A38] text-[#8B92A9]" },
};

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── New Campaign form ─────────────────────────────────────────────────────────
function NewCampaignForm({ catalog, onCreated, onCancel }) {
  const [festivalKey, setFestivalKey] = useState("");
  const [festivalName, setFestivalName] = useState("");
  const [sendDate, setSendDate] = useState("");
  const [scope, setScope] = useState("all");
  const [statuses, setStatuses] = useState("");
  const [waEnabled, setWaEnabled] = useState(true);
  const [templateName, setTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("en");
  const [emEnabled, setEmEnabled] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const applyCatalogPick = (key) => {
    setFestivalKey(key);
    const entry = catalog.find((c) => c.key === key);
    if (entry) {
      setFestivalName(entry.festivalName);
      setTemplateName(entry.templateName);
      setSendDate(entry.date);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!sendDate) return setError("Pick a send date");
    if (waEnabled && !templateName.trim()) return setError("Enter a WhatsApp template name (or disable the WhatsApp channel)");
    if (!waEnabled && !emEnabled) return setError("Enable at least one channel");

    setSaving(true);
    try {
      const res = await api.post("/festival-campaigns", {
        festivalKey,
        festivalName: festivalName || "Festival Greeting",
        sendDate,
        targetAudience: {
          scope,
          statuses: scope === "byStatus" ? statuses.split(",").map((s) => s.trim()).filter(Boolean) : [],
        },
        channels: {
          whatsapp: { enabled: waEnabled, templateName, languageCode },
          email:    { enabled: emEnabled, subject, bodyTemplate },
        },
      });
      onCreated(res.data.campaign);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to create campaign");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#FFF7ED] dark:bg-[#1c0a00] border border-[#FDBA74] dark:border-[#78350f] rounded-2xl p-4 space-y-3 mb-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-bold text-[#EA580C]">New Festival Campaign</p>
        <button onClick={onCancel} className="text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
          Pick from catalog <span className="text-[10px] font-normal text-[#8B92A9]">(pre-approved templates, optional)</span>
        </label>
        <select value={festivalKey} onChange={(e) => applyCatalogPick(e.target.value)} className={FIELD_CLS}>
          <option value="">— Custom / type your own below —</option>
          {catalog.map((c) => (
            <option key={c.key} value={c.key}>{c.festivalName} — {fmtDate(c.date)} ({c.templateName})</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Festival Name</label>
          <input type="text" value={festivalName} onChange={(e) => setFestivalName(e.target.value)} placeholder="Diwali" className={FIELD_CLS} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Send Date <span className="text-[#DC2626]">*</span></label>
          <input type="date" value={sendDate} onChange={(e) => setSendDate(e.target.value)} className={FIELD_CLS} />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Send To</label>
        <div className="flex gap-2">
          <select value={scope} onChange={(e) => setScope(e.target.value)} className={FIELD_CLS + " w-auto"}>
            <option value="all">All leads</option>
            <option value="byStatus">Leads with specific status</option>
          </select>
          {scope === "byStatus" && (
            <input
              type="text"
              value={statuses}
              onChange={(e) => setStatuses(e.target.value)}
              placeholder="e.g. New, Interested"
              className={FIELD_CLS}
            />
          )}
        </div>
      </div>

      {/* WhatsApp channel */}
      <div className="border-t border-[#FDBA74] dark:border-[#78350f] pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">WhatsApp</p>
          <button
            onClick={() => setWaEnabled((v) => !v)}
            className={`relative w-10 h-5.5 rounded-full transition-colors ${waEnabled ? "bg-[#25D366]" : "bg-[#E4E7EF] dark:bg-[#262A38]"}`}
            style={{ height: 22, width: 40 }}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${waEnabled ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>
        {waEnabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="skyup_happy_diwali" className={FIELD_CLS} />
            <select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)} className={FIELD_CLS}>
              <option value="en">English (en)</option>
              <option value="hi">Hindi (hi)</option>
              <option value="mr">Marathi (mr)</option>
              <option value="gu">Gujarati (gu)</option>
              <option value="ta">Tamil (ta)</option>
              <option value="te">Telugu (te)</option>
              <option value="kn">Kannada (kn)</option>
            </select>
          </div>
        )}
      </div>

      {/* Email channel */}
      <div className="border-t border-[#FDBA74] dark:border-[#78350f] pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">Email (optional)</p>
          <button
            onClick={() => setEmEnabled((v) => !v)}
            className={`relative rounded-full transition-colors ${emEnabled ? "bg-[#7C3AED]" : "bg-[#E4E7EF] dark:bg-[#262A38]"}`}
            style={{ height: 22, width: 40 }}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${emEnabled ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>
        {emEnabled && (
          <div className="space-y-2">
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Happy Diwali, {{name}}!" className={FIELD_CLS} />
            <textarea rows={3} value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} placeholder="<p>Hi {{name}},</p><p>Wishing you a very Happy Diwali!</p>" className={FIELD_CLS + " font-mono text-[12px] resize-y"} />
          </div>
        )}
      </div>

      {error && <p className="text-[11px] text-[#DC2626]">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-[12px] font-semibold text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA]">Cancel</button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-60 transition"
        >
          {saving ? "Scheduling…" : "Schedule Campaign"}
        </button>
      </div>
    </div>
  );
}

// ── Campaign row ──────────────────────────────────────────────────────────────
function CampaignRow({ campaign, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const st = STATUS_STYLES[campaign.status] || STATUS_STYLES.scheduled;

  const toggle = async () => {
    setBusy(true);
    try {
      const res = await api.patch(`/festival-campaigns/${campaign._id}/toggle`, {});
      onChanged(res.data.campaign);
    } catch (e) {
      alert(e.response?.data?.message || "Failed to update");
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!window.confirm(`Cancel the "${campaign.festivalName}" campaign?`)) return;
    setBusy(true);
    try {
      const res = await api.post(`/festival-campaigns/${campaign._id}/cancel`, {});
      onChanged(res.data.campaign);
    } catch (e) {
      alert(e.response?.data?.message || "Failed to cancel");
    } finally { setBusy(false); }
  };

  const del = async () => {
    if (!window.confirm(`Delete the "${campaign.festivalName}" campaign? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.delete(`/festival-campaigns/${campaign._id}`);
      onChanged(null, campaign._id);
    } catch (e) {
      alert(e.response?.data?.message || "Failed to delete");
    } finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setTestResult(null);
    try {
      const res = await api.post(`/festival-campaigns/${campaign._id}/test`, {});
      setTestResult(res.data);
    } catch (e) {
      setTestResult({ error: e.response?.data?.message || "Test failed" });
    } finally { setBusy(false); }
  };

  return (
    <div className="border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-3.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">{campaign.festivalName}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            {campaign.status === "scheduled" && !campaign.enabled && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F1F5F9] dark:bg-[#262A38] text-[#8B92A9]">Paused</span>
            )}
          </div>
          <p className="text-[11px] text-[#8B92A9] mt-0.5 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {fmtDate(campaign.sendDate)}
            {" · "}
            {campaign.targetAudience?.scope === "byStatus"
              ? `Status: ${campaign.targetAudience.statuses.join(", ") || "—"}`
              : "All leads"}
          </p>
          <p className="text-[11px] text-[#8B92A9] mt-0.5">
            {campaign.channels?.whatsapp?.enabled && <>WhatsApp: <code className="text-[#25D366]">{campaign.channels.whatsapp.templateName}</code></>}
            {campaign.channels?.whatsapp?.enabled && campaign.channels?.email?.enabled && " · "}
            {campaign.channels?.email?.enabled && <span className="text-[#7C3AED]">Email</span>}
          </p>
          {(campaign.status === "sent" || campaign.status === "sending") && (
            <p className="text-[11px] text-[#8B92A9] mt-1">
              {campaign.stats?.sent || 0} sent · {campaign.stats?.failed || 0} failed · {campaign.stats?.skipped || 0} skipped
              {" "}(of {campaign.stats?.totalLeads || 0} leads)
            </p>
          )}
          {campaign.status === "failed" && campaign.lastError && (
            <p className="text-[11px] text-[#DC2626] mt-1">{campaign.lastError}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {campaign.status === "scheduled" && (
            <>
              <button title="Send test" disabled={busy} onClick={test} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition disabled:opacity-50">
                <Beaker className="w-3.5 h-3.5" />
              </button>
              <button title={campaign.enabled ? "Pause" : "Resume"} disabled={busy} onClick={toggle} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition disabled:opacity-50">
                {campaign.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button title="Cancel" disabled={busy} onClick={cancel} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#DC2626] transition disabled:opacity-50">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button title="Delete" disabled={busy || campaign.status === "sending"} onClick={del} className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:text-[#DC2626] transition disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {testResult && (
        <div className="text-[11px] bg-[#F8F9FC] dark:bg-[#13161E] rounded-lg p-2.5 space-y-1">
          {testResult.error
            ? <p className="text-[#DC2626]">{testResult.error}</p>
            : (
              <>
                <p className="text-[#8B92A9]">Test sent to: {testResult.lead?.name} ({testResult.lead?.mobile || testResult.lead?.email})</p>
                {testResult.results?.map((r, i) => (
                  <p key={i} className={r.status === "sent" ? "text-[#16A34A]" : r.status === "failed" ? "text-[#DC2626]" : "text-[#8B92A9]"}>
                    {r.channel}: {r.status} — {r.detail}
                  </p>
                ))}
              </>
            )}
        </div>
      )}
    </div>
  );
}

// ── Auto-Blast toggle section (the "flip it on once" primary path) ──────────
function AutoBlastSection() {
  const [settings, setSettings] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [testingKey, setTestingKey] = useState("");
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    api.get("/festival-campaigns/auto-blast").then((r) => {
      setSettings(r.data.festivalAutoBlast || {});
      setCatalog(r.data.catalog || []);
    }).catch(() => setSettings({}));
  }, []);

  const update = (path, value) => {
    setSettings((prev) => {
      const next = { ...prev };
      if (path.length === 1) { next[path[0]] = value; return next; }
      next[path[0]] = { ...(prev[path[0]] || {}), [path[1]]: value };
      return next;
    });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await api.put("/festival-campaigns/auto-blast", settings);
      setSettings(res.data.festivalAutoBlast || settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to save");
    } finally { setSaving(false); }
  };

  const testFestival = async (key) => {
    setTestingKey(key); setTestResult(null);
    try {
      const res = await api.post("/festival-campaigns/auto-blast/test", { festivalKey: key });
      setTestResult(res.data);
    } catch (e) {
      setTestResult({ error: e.response?.data?.message || "Test failed" });
    } finally { setTestingKey(""); }
  };

  if (!settings) return (
    <div className="flex items-center justify-center py-6 gap-2 text-[#8B92A9]">
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
      Loading…
    </div>
  );

  const wa = settings.whatsapp || {};
  const em = settings.email || {};
  const ta = settings.targetAudience || { scope: "all", statuses: [] };

  return (
    <div className="bg-[#FFF7ED] dark:bg-[#1c0a00] border border-[#FDBA74] dark:border-[#78350f] rounded-2xl p-4 space-y-3 mb-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-bold text-[#EA580C]">Auto-Blast — turn on once, no manual work</p>
          <p className="text-[11px] text-[#8B92A9] mt-0.5">Every festival below fires automatically on its date to your leads — nothing to schedule per festival.</p>
        </div>
        <button
          onClick={() => update(["enabled"], !settings.enabled)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0 ${settings.enabled ? "bg-[#EA580C]" : "bg-[#E4E7EF] dark:bg-[#262A38]"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${settings.enabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      {settings.enabled && (
        <div className="space-y-3 pt-1 border-t border-[#FDBA74] dark:border-[#78350f]">
          {/* WhatsApp channel */}
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">WhatsApp</p>
            <button
              onClick={() => update(["whatsapp", "enabled"], wa.enabled === false)}
              className={`relative w-10 h-5.5 rounded-full transition-colors ${wa.enabled !== false ? "bg-[#25D366]" : "bg-[#E4E7EF] dark:bg-[#262A38]"}`}
              style={{ height: 22, width: 40 }}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${wa.enabled !== false ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>
          {wa.enabled !== false && (
            <select value={wa.languageCode || "en"} onChange={(e) => update(["whatsapp", "languageCode"], e.target.value)} className={FIELD_CLS}>
              <option value="en">English (en)</option>
              <option value="hi">Hindi (hi)</option>
              <option value="mr">Marathi (mr)</option>
              <option value="gu">Gujarati (gu)</option>
              <option value="ta">Tamil (ta)</option>
              <option value="te">Telugu (te)</option>
              <option value="kn">Kannada (kn)</option>
            </select>
          )}

          {/* Email channel */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">Email (optional)</p>
            <button
              onClick={() => update(["email", "enabled"], !em.enabled)}
              className={`relative rounded-full transition-colors ${em.enabled ? "bg-[#7C3AED]" : "bg-[#E4E7EF] dark:bg-[#262A38]"}`}
              style={{ height: 22, width: 40 }}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${em.enabled ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>
          {em.enabled && (
            <div className="space-y-2">
              <input type="text" value={em.subject || ""} onChange={(e) => update(["email", "subject"], e.target.value)} placeholder="Happy {{festival}}, {{name}}!" className={FIELD_CLS} />
              <textarea rows={3} value={em.bodyTemplate || ""} onChange={(e) => update(["email", "bodyTemplate"], e.target.value)} placeholder="<p>Hi {{name}},</p><p>Wishing you a very Happy {{festival}}!</p>" className={FIELD_CLS + " font-mono text-[12px] resize-y"} />
              <p className="text-[10px] text-[#8B92A9]">Merge tags: <code>{"{{name}}"}</code> <code>{"{{festival}}"}</code></p>
            </div>
          )}

          {/* Audience */}
          <div className="pt-1">
            <p className="text-[12px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] mb-1.5">Send To</p>
            <div className="flex gap-2">
              <select value={ta.scope} onChange={(e) => update(["targetAudience", "scope"], e.target.value)} className={FIELD_CLS + " w-auto"}>
                <option value="all">All leads</option>
                <option value="byStatus">Leads with specific status</option>
              </select>
              {ta.scope === "byStatus" && (
                <input
                  type="text"
                  value={(ta.statuses || []).join(", ")}
                  onChange={(e) => update(["targetAudience", "statuses"], e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                  placeholder="e.g. New, Interested"
                  className={FIELD_CLS}
                />
              )}
            </div>
          </div>

          {error && <p className="text-[11px] text-[#DC2626]">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl text-[12px] font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] disabled:opacity-60 transition">
              {saving ? "Saving…" : "Save Settings"}
            </button>
            {saved && <span className="text-[11px] text-[#16A34A] font-medium">Saved ✓</span>}
          </div>

          {/* Upcoming catalog festivals + quick test */}
          <div className="pt-2 border-t border-[#FDBA74] dark:border-[#78350f]">
            <p className="text-[11px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">Upcoming (auto-fires on these dates)</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {catalog.map((c) => (
                <div key={c.key} className="flex items-center justify-between text-[11px] text-[#8B92A9]">
                  <span>{c.festivalName} — {new Date(c.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  <button
                    onClick={() => testFestival(c.key)}
                    disabled={testingKey === c.key}
                    className="text-[10px] font-semibold text-[#EA580C] hover:underline disabled:opacity-50"
                  >
                    {testingKey === c.key ? "Sending…" : "Test"}
                  </button>
                </div>
              ))}
            </div>
            {testResult && (
              <div className="mt-2 text-[11px] bg-[#F8F9FC] dark:bg-[#13161E] rounded-lg p-2.5 space-y-1">
                {testResult.error
                  ? <p className="text-[#DC2626]">{testResult.error}</p>
                  : (
                    <>
                      <p className="text-[#8B92A9]">Test sent to: {testResult.lead?.name} ({testResult.lead?.mobile || testResult.lead?.email})</p>
                      {testResult.results?.map((r, i) => (
                        <p key={i} className={r.status === "sent" ? "text-[#16A34A]" : r.status === "failed" ? "text-[#DC2626]" : "text-[#8B92A9]"}>
                          {r.channel}: {r.status} — {r.detail}
                        </p>
                      ))}
                    </>
                  )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function FestivalCampaignsModal({ onClose }) {
  const [campaigns, setCampaigns] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    api.get("/festival-campaigns").then((r) => setCampaigns(r.data.campaigns || [])).catch(() => setCampaigns([]));
  };

  useEffect(() => {
    load();
    api.get("/festival-campaigns/catalog").then((r) => setCatalog(r.data.catalog || [])).catch(() => setCatalog([]));
  }, []);

  const handleChanged = (updated, deletedId) => {
    setCampaigns((prev) => {
      if (deletedId) return prev.filter((c) => c._id !== deletedId);
      return prev.map((c) => (c._id === updated._id ? updated : c));
    });
  };

  const handleCreated = (campaign) => {
    setCampaigns((prev) => [...prev, campaign].sort((a, b) => new Date(a.sendDate) - new Date(b.sendDate)));
    setShowForm(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#1A1D27] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between shrink-0 bg-[#FFF7ED] dark:bg-[#1c0a00]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFF7ED] dark:bg-[#1c0a00] border border-[#EA580C] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-[#EA580C]" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Festival Campaigns</h2>
              <p className="text-[11px] text-[#8B92A9] mt-0.5">Schedule festive WhatsApp/Email templates to send on a specific date</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-[#262A38] text-[#8B92A9] transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          <AutoBlastSection />

          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full mb-3 flex items-center justify-between px-1 text-[11px] font-semibold text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"
          >
            <span>Advanced: custom one-off campaigns (for festivals not in the catalog)</span>
            <span>{showAdvanced ? "▲" : "▼"}</span>
          </button>

          {showAdvanced && (
            <>
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#EA580C] text-[#EA580C] text-[12px] font-semibold hover:bg-[#FFF7ED] dark:hover:bg-[#1c0a00] transition"
                >
                  <Send className="w-3.5 h-3.5" /> New Custom Campaign
                </button>
              )}

              {showForm && (
                <NewCampaignForm catalog={catalog} onCreated={handleCreated} onCancel={() => setShowForm(false)} />
              )}

              {error && <p className="text-[11px] text-[#DC2626] mb-2">{error}</p>}

              {campaigns === null ? (
                <div className="flex items-center justify-center py-8 gap-2 text-[#8B92A9]">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  Loading…
                </div>
              ) : campaigns.length === 0 ? (
                <p className="text-[12px] text-[#8B92A9] text-center py-8">No custom campaigns scheduled.</p>
              ) : (
                <div className="space-y-2.5">
                  {campaigns.map((c) => (
                    <CampaignRow key={c._id} campaign={c} onChanged={handleChanged} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
