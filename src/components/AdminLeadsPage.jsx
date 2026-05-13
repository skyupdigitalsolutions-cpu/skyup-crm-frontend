import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import api from "../data/axiosConfig";
import LeadJourneyDrawer from "./LeadJourneyDrawer";
import CRMEncryption from "../utils/CRMEncryption";
import { getRole } from "../data/dataService";
import { normalizePhone, isSamePhone } from "../utils/normalizePhone";

const crm = new CRMEncryption();

const STATUS_CONFIG = {
  "New":            { bg: "bg-blue-100 dark:bg-blue-950/40",       text: "text-blue-600 dark:text-blue-400",       dot: "#2563EB" },
  "In Progress":    { bg: "bg-amber-100 dark:bg-amber-950/40",     text: "text-amber-600 dark:text-amber-400",     dot: "#D97706" },
  "Converted":      { bg: "bg-emerald-100 dark:bg-emerald-950/40", text: "text-emerald-600 dark:text-emerald-400", dot: "#059669" },
  "Not Interested": { bg: "bg-red-100 dark:bg-red-950/40",         text: "text-red-600 dark:text-red-400",         dot: "#DC2626" },
};
const TEMP_CONFIG = {
  Hot:  { bg: "bg-red-100 dark:bg-red-950/40",    text: "text-red-600 dark:text-red-400",    icon: "" },
  Warm: { bg: "bg-amber-100 dark:bg-amber-950/40",text: "text-amber-600 dark:text-amber-400",icon: "" },
  Cold: { bg: "bg-blue-100 dark:bg-blue-950/40",  text: "text-blue-600 dark:text-blue-400",  icon: "" },
};
const ALL_SOURCES  = ["Google Ads", "Campaign", "Facebook Ads", "Web Form", "Referral", "CSV Import", "Manual"];
const ALL_STATUSES = ["New", "In Progress", "Converted", "Not Interested"];

function normalizeMobile(val) {
  return normalizePhone(val) || (val || "").replace(/\D/g, "");
}

function StatusBadge({ status }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG["New"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {status}
    </span>
  );
}
function TempBadge({ temp }) {
  if (!temp) return null;
  const s = TEMP_CONFIG[temp];
  if (!s) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      {s.icon} {temp}
    </span>
  );
}

// ── Add Lead Modal ────────────────────────────────────────────────────────────
function AddLeadModal({ onClose, onAdd }) {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "", mobile: "", source: "Google Ads", campaign: "",
    userId: "", status: "New", remark: "",
  });
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);

  // dupCheck.state: "idle" | "checking" | "ok" | "duplicate"
  const [dupCheck, setDupCheck] = useState({ state: "idle", lead: null });
  const dupTimerRef = useRef(null);

  // ── Debounced duplicate check (fires on each keystroke after 600ms) ─────────
  const checkDuplicate = useCallback((mobile) => {
    const norm = normalizePhone(mobile);
    if (!norm) { setDupCheck({ state: "idle", lead: null }); return; }
    setDupCheck({ state: "checking", lead: null });
    clearTimeout(dupTimerRef.current);
    dupTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/lead/admin/check-duplicate?mobile=${norm}`);
        if (res.data.duplicate) {
          setDupCheck({ state: "duplicate", lead: res.data.existingLead });
        } else {
          setDupCheck({ state: "ok", lead: null });
        }
      } catch {
        setDupCheck({ state: "idle", lead: null });
      }
    }, 600);
  }, []);

  useEffect(() => () => clearTimeout(dupTimerRef.current), []);

  // Load users for agent dropdown
  useEffect(() => {
    api.get("/admin/company/users")
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : [];
        setUsers(list);
        if (list.length > 0) setForm(f => ({ ...f, userId: list[0]._id }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: "", submit: "" }));
    if (k === "mobile") checkDuplicate(v);
  };

  // ── Synchronous duplicate check — used when user clicks submit before
  //    the debounce fires (paste + immediate click scenario) ─────────────────
  const runSyncDupCheck = async (mob) => {
    const norm = normalizePhone(mob);
    if (!norm) return false; // no number → let validate() handle it
    setDupCheck({ state: "checking", lead: null });
    try {
      const res = await api.get(`/lead/admin/check-duplicate?mobile=${norm}`);
      if (res.data.duplicate) {
        setDupCheck({ state: "duplicate", lead: res.data.existingLead });
        return true; // IS a duplicate
      }
      setDupCheck({ state: "ok", lead: null });
      return false;
    } catch {
      setDupCheck({ state: "idle", lead: null });
      return false; // network error → let server reject if needed
    }
  };

  // ── Validation (runs after duplicate state is confirmed) ─────────────────
  const validate = (currentDupState) => {
    const e = {};
    const name = form.name.trim();
    const mob  = normalizeMobile(form.mobile);

    if (!name || name.length < 2)
      e.name = "Name must be at least 2 characters.";

    if (!mob)
      e.mobile = "Mobile number is required.";
    else if (mob.length < 7 || mob.length > 15)
      e.mobile = "Enter a valid mobile number (7–15 digits).";
    else if (currentDupState === "duplicate")
      e.mobile = "This number already exists. Search for the existing lead to update it.";

    if (!form.userId)
      e.userId = "Please select an agent to assign this lead.";

    return e;
  };

  const handleSubmit = async () => {
    const mob = normalizeMobile(form.mobile);

    // ── Step 1: if debounce hasn't resolved yet, run a synchronous check ────
    let resolvedDupState = dupCheck.state;

    if (mob && dupCheck.state === "checking") {
      // Check is mid-flight — block and show message
      setErrors({ submit: "Please wait — checking for duplicate number…" });
      return;
    }

    if (mob && dupCheck.state === "idle") {
      // User pasted + clicked before debounce fired; run synchronous check now
      clearTimeout(dupTimerRef.current);
      const isDup = await runSyncDupCheck(mob);
      resolvedDupState = isDup ? "duplicate" : "ok";
      if (isDup) {
        setErrors({ mobile: "This number already exists. Search for the existing lead to update it." });
        return;
      }
    }

    // ── Step 2: validate fields (including confirmed dup state) ─────────────
    const newErrors = validate(resolvedDupState);
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    // ── Step 3: hard block — confirmed duplicate must never reach the API ───
    if (resolvedDupState === "duplicate") {
      setErrors({ mobile: "This number already exists. Search for the existing lead to update it." });
      return;
    }

    setSubmitting(true);

    const basePayload = {
      name:     form.name.trim(),
      mobile:   mob,
      source:   form.source,
      campaign: form.campaign.trim() || null,
      status:   form.status,
      remark:   form.remark.trim() || "Manually added",
      user:     form.userId,
      date:     new Date(),
    };

    let payload = basePayload;
    const keyString = crm.getLocalKey();
    if (keyString) {
      try {
        const encryptedData = await crm.encrypt(
          { name: basePayload.name, mobile: basePayload.mobile, email: "", remark: basePayload.remark },
          keyString
        );
        payload = { ...basePayload, encryptedData };
      } catch { /* send plain */ }
    }

    try {
      const role = getRole();
      const endpoint = role === "superadmin" ? "/lead/superadmin/create" : "/lead/admin/create";
      const res = await api.post(endpoint, payload);
      const saved = res.data;
      onAdd({
        ...saved,
        id:             String(saved._id),
        name:           saved.name,
        phone:          saved.mobile,
        mobile:         saved.mobile,
        source:         saved.source   || "Manual",
        campaign:       saved.campaign || "—",
        status:         saved.status,
        date:           saved.date
          ? new Date(saved.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
          : "—",
        remark:         saved.remark,
        agent:          saved.user?.name || users.find(u => u._id === form.userId)?.name || "—",
        callHistory:    saved.callHistory    || [],
        scheduledCalls: saved.scheduledCalls || [],
        previousAgents: saved.previousAgents || [],
        reassignCount:  saved.reassignCount  || 0,
        _raw_date:      saved.date,
        Quality:        saved.temperature ?? null,
        temperature:    saved.temperature ?? null,
        createdAt:      saved.createdAt,
      });
      onClose();
    } catch (err) {
      const msg   = err.response?.data?.message || "Failed to save lead.";
      const isDup = err.response?.status === 409 || err.response?.data?.duplicate;
      // If server still returns a duplicate (race condition), surface it properly
      if (isDup) {
        setDupCheck({ state: "duplicate", lead: err.response?.data?.existingLead || null });
        setErrors({ mobile: msg, submit: msg });
      } else {
        setErrors({ submit: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !submitting &&
    !loading &&
    users.length > 0 &&
    dupCheck.state !== "duplicate" &&
    dupCheck.state !== "checking";

  const inp = (key) =>
    `w-full px-3 py-2.5 rounded-xl border text-[13px] bg-white dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none transition
    ${errors[key] ? "border-red-400 dark:border-red-500 focus:border-red-500" : "border-[#E4E7EF] dark:border-[#262A38] focus:border-[#2563EB]"}`;

  const ErrMsg = ({ k }) => errors[k]
    ? <span className="text-[11px] text-red-500 flex items-center gap-1 mt-0.5">
        <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
        </svg>
        {errors[k]}
      </span>
    : null;

  // Button label logic
  const btnLabel = () => {
    if (submitting)                     return <><Spinner /> Saving…</>;
    if (dupCheck.state === "checking")  return <><Spinner /> Checking…</>;
    return "Add Lead";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Add New Lead</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {/* Name */}
          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">
              Lead Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              className={inp("name")}
            />
            <ErrMsg k="name" />
          </div>

          {/* Mobile */}
          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">
              Mobile Number <span className="text-red-500">*</span>
              <span className="ml-1 normal-case text-[10px] font-normal text-[#8B92A9]">(with or without +91 prefix)</span>
            </label>
            <input
              type="tel"
              placeholder="9876543210 or +919876543210"
              value={form.mobile}
              onChange={e => set("mobile", e.target.value)}
              className={inp("mobile")}
            />
            <ErrMsg k="mobile" />

            {/* Live duplicate indicator */}
            {dupCheck.state === "checking" && (
              <p className="text-[11px] text-[#9DA3BB] mt-1 flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 border-2 border-[#9DA3BB] border-t-transparent rounded-full animate-spin" />
                Checking for duplicates…
              </p>
            )}
            {dupCheck.state === "ok" && (
              <p className="text-[11px] text-emerald-500 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
                Number is available
              </p>
            )}
            {dupCheck.state === "duplicate" && dupCheck.lead && (
              <div className="mt-2 p-3 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600">
                <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  </svg>
                  Duplicate — this number already exists
                </p>
                <div className="text-[11px] text-amber-700 dark:text-amber-300 space-y-0.5">
                  <p><span className="font-semibold">Name:</span> {dupCheck.lead.name}</p>
                  <p><span className="font-semibold">Mobile:</span> {dupCheck.lead.mobile}</p>
                  <p><span className="font-semibold">Status:</span> {dupCheck.lead.status}</p>
                  <p><span className="font-semibold">Source:</span> {dupCheck.lead.source}</p>
                  {dupCheck.lead.createdAt && (
                    <p><span className="font-semibold">Added:</span> {new Date(dupCheck.lead.createdAt).toLocaleDateString()}</p>
                  )}
                </div>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 font-semibold border-t border-amber-200 dark:border-amber-800 pt-2">
                  This lead cannot be saved. Search for the existing lead to update it instead.
                </p>
              </div>
            )}
            {/* Edge case: duplicate confirmed but lead details not returned */}
            {dupCheck.state === "duplicate" && !dupCheck.lead && (
              <div className="mt-2 p-3 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-600">
                <p className="text-[12px] font-bold text-amber-700 dark:text-amber-400">
                  ⚠ This number is already registered as a lead.
                </p>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  This lead cannot be saved. Search for the existing lead to update it.
                </p>
              </div>
            )}
          </div>

          {/* Agent */}
          <div>
            <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">
              Assign to Agent <span className="text-red-500">*</span>
            </label>
            {loading ? (
              <div className={`${inp("userId")} flex items-center gap-2 text-[#8B92A9]`}>
                <Spinner /> Loading agents…
              </div>
            ) : users.length === 0 ? (
              <div className={`${inp("userId")} text-red-500`}>No users found. Add users first.</div>
            ) : (
              <select
                value={form.userId}
                onChange={e => set("userId", e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl border text-[13px] bg-white dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none transition
                  ${errors.userId ? "border-red-400 dark:border-red-500" : "border-[#E4E7EF] dark:border-[#262A38] focus:border-[#2563EB]"}`}
              >
                <option value="">— Select agent —</option>
                {users.map(u => (
                  <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                ))}
              </select>
            )}
            <ErrMsg k="userId" />
          </div>

          {/* Source + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Source</label>
              <select value={form.source} onChange={e => set("source", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]">
                {ALL_SOURCES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB]">
                {ALL_STATUSES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Campaign + Remark */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Campaign</label>
              <input type="text" placeholder="Campaign name" value={form.campaign}
                onChange={e => set("campaign", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB]" />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8B92A9] uppercase tracking-wide">Remark</label>
              <input type="text" placeholder="Notes" value={form.remark}
                onChange={e => set("remark", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB]" />
            </div>
          </div>
        </div>

        {/* Submit error */}
        {errors.submit && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-[12px] text-red-600 dark:text-red-400 flex items-center gap-2">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {errors.submit}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] transition">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {btnLabel()}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Import CSV Modal ──────────────────────────────────────────────────────────
function ImportCSVModal({ onClose, onImported }) {
  const importRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState(null);

const downloadTemplate = () => {
    const headers = "name,mobile,email,source,campaign,status,remark";
    const example = "Rahul Sharma,9876543210,rahul@example.com,Manual,Summer 2026,New,Interested in demo";
    const blob = new Blob([[headers, example].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob), download: "leads_import_template.csv",
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const parseCSVLine = (line) => {
    const values = []; let current = "", inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    values.push(current.trim()); return values;
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    setResult(null);

    try {
      const text  = await file.text();
      const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error("CSV must have a header row and at least one data row.");

      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

      const seenInFile    = new Set();
      const leadsToImport = [];
      const clientErrors  = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row    = {};
        headers.forEach((h, idx) => { row[h] = (values[idx] || "").trim(); });

        const rawName   = row.name || row["full name"] || row["fullname"] || "";
        const rawMobile = row.mobile || row.phone || row["phone number"] || row["mobile number"] || "";
        const normalized = normalizeMobile(rawMobile);

        if (!normalized) {
          clientErrors.push({ index: i, row: rawName || i, message: "Missing mobile number — row skipped." });
          continue;
        }

        const dupKey = normalized.replace(/^(91|1)/, "");
        if (seenInFile.has(dupKey)) {
          clientErrors.push({ index: i, row: rawName || i, message: `Duplicate in CSV: ${rawMobile} appears more than once.` });
          continue;
        }
        seenInFile.add(dupKey);

        leadsToImport.push({
          name:     rawName || "Unknown",
          mobile:   normalized,
          email:    row.email || "",
          source:   row.source || "CSV Import",
          campaign: row.campaign || "",
          status:   row.status  || "New",
          remark:   row.remark || row.notes || "Imported via CSV",
        });
      }

      if (!leadsToImport.length && clientErrors.length > 0) {
        setResult({ savedCount: 0, errorCount: clientErrors.length, errors: clientErrors, message: "No valid rows found." });
        return;
      }

      const { data } = await api.post("/lead/admin/import-csv", { leads: leadsToImport });

      const allErrors = [...clientErrors, ...(data.errors || [])];
      setResult({
        savedCount:  data.savedCount,
        errorCount:  (data.errorCount || 0) + clientErrors.length,
        errors:      allErrors,
        message:     data.message,
      });

      if (data.savedCount > 0) onImported();
    } catch (err) {
      setResult({ savedCount: 0, errorCount: 1, errors: [{ message: err.response?.data?.message || err.message }], message: "Import failed." });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Import CSV</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F1F4FF] dark:hover:bg-[#262A38] text-[#8B92A9]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {!result ? (
          <>
            <div className="bg-[#EFF6FF] dark:bg-[#1A2540] border border-blue-100 dark:border-blue-900/40 rounded-xl p-4 mb-5">
              <p className="text-[12px] font-semibold text-[#1D4ED8] dark:text-[#4F8EF7] mb-2">CSV Format</p>
              <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] mb-1">
                Required columns: <code className="font-mono bg-white dark:bg-[#0D0F14] px-1 rounded">name</code>,{" "}
                <code className="font-mono bg-white dark:bg-[#0D0F14] px-1 rounded">mobile</code>
              </p>
              <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB]">Optional: email, source, campaign, status, remark</p>
              <p className="text-[11px] text-[#8B92A9] mt-2">
                • Duplicate numbers (with or without +91) are automatically skipped<br />
                • Leads round-robin assigned to your team
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#7C3AED] dark:text-[#A78BFA] hover:bg-purple-50 dark:hover:bg-purple-950/30 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                Download Template
              </button>
              <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
              <button onClick={() => importRef.current?.click()} disabled={importing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#7C3AED] text-white text-[13px] font-semibold hover:bg-violet-700 disabled:opacity-50 transition">
                {importing
                  ? <><Spinner /> Importing…</>
                  : <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                      </svg>
                      Choose CSV File
                    </>
                }
              </button>
            </div>
          </>
        ) : (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-3 text-center">
                <p className="text-[24px] font-bold text-emerald-600 dark:text-emerald-400">{result.savedCount}</p>
                <p className="text-[12px] text-emerald-600 dark:text-emerald-400 font-semibold">Imported</p>
              </div>
              <div className={`border rounded-xl p-3 text-center ${result.errorCount > 0 ? "bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40" : "bg-gray-50 dark:bg-gray-900/20 border-gray-100 dark:border-gray-800"}`}>
                <p className={`text-[24px] font-bold ${result.errorCount > 0 ? "text-red-600 dark:text-red-400" : "text-[#8B92A9]"}`}>{result.errorCount}</p>
                <p className={`text-[12px] font-semibold ${result.errorCount > 0 ? "text-red-600 dark:text-red-400" : "text-[#8B92A9]"}`}>Skipped</p>
              </div>
            </div>

            {result.errors?.length > 0 && (
              <div className="bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-xl p-3 mb-4 max-h-48 overflow-y-auto">
                <p className="text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">Skipped rows</p>
                <div className="space-y-1.5">
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px]">
                      <span className="text-red-400 shrink-0 mt-0.5">✕</span>
                      <span className="text-[#4B5168] dark:text-[#9DA3BB]">
                        {e.row ? `Row "${e.row}": ` : ""}{e.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {result.savedCount === 0 && (
                <button onClick={() => { setResult(null); importRef.current?.click(); }}
                  className="flex-1 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#4B5168] hover:bg-[#F1F4FF] transition">
                  Try Again
                </button>
              )}
              <button onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-blue-700 transition">
                {result.savedCount > 0 ? "Done" : "Close"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared spinner ────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  );
}

// ── mapLead ───────────────────────────────────────────────────────────────────
function mapLead(l) {
  const callHistory = Array.isArray(l.callHistory) ? l.callHistory : [];
  const sortedCalls = [...callHistory].sort((a, b) => new Date(b.calledAt) - new Date(a.calledAt));
  const lastCall    = sortedCalls[0] || null;

  return {
    id:             String(l._id),
    name:           l.name           || "Unknown",
    phone:          l.mobile         || l.phone || "",
    email:          l.email          || "",
    source:         l.source         || "—",
    campaign:       l.campaign       || "—",
    agent:          l.user?.name || l.assignedTo?.name || l.agent || "Unassigned",
    status:         l.status         || "New",
    Quality:        l.temperature || l.Quality || null,
    remark:         l.remark         || "",
    date:           l.date
      ? new Date(l.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      : "—",
    createdAt:      l.createdAt      || l.date || null,
    _raw_date:      l.date           || l.createdAt || null,
    callHistory,
    scheduledCalls: Array.isArray(l.scheduledCalls) ? l.scheduledCalls : [],
    previousAgents: Array.isArray(l.previousAgents) ? l.previousAgents : [],
    reassignCount:  l.reassignCount  || 0,
    lastOutcome:    lastCall?.outcome  || null,
    lastCalledAt:   lastCall?.calledAt || null,
    lastRemark:     lastCall?.remark   || null,
  };
}

function daysSince(iso) {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1d ago";
  if (days < 30)  return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

const PER_PAGE = 15;

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminLeadsPage() {
  const [allLeads,   setAllLeads]   = useState([]);
  const [agents,     setAgents]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [selected,   setSelected]   = useState(null);
  const [showAdd,    setShowAdd]    = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [search,      setSearch]      = useState("");
  const [filterSt,    setFilterSt]    = useState("All");
  const [filterAgent, setFilterAgent] = useState("All");
  const [filterSrc,   setFilterSrc]   = useState("All");
  const [filterTemp,  setFilterTemp]  = useState("All");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [sortBy,      setSortBy]      = useState("date_desc");
  const [page,        setPage]        = useState(1);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/lead/admin/all?page=1&limit=500");
      const raw = res.data?.leads || (Array.isArray(res.data) ? res.data : []);
      setAllLeads(raw.map(mapLead));
      const agentSet = new Set();
      raw.forEach(l => {
        const n = l.user?.name || l.assignedTo?.name || l.agent;
        if (n) agentSet.add(n);
      });
      setAgents([...agentSet]);
    } catch {
      setError("Failed to load leads. Please refresh.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleAdd = useCallback((newLead) => {
    setAllLeads(prev => [mapLead({ ...newLead, _id: newLead.id || newLead._id }), ...prev]);
    setPage(1);
  }, []);

  const uniqueSources = useMemo(() =>
    [...new Set(allLeads.map(l => l.source).filter(s => s && s !== "—"))],
  [allLeads]);

  const kpi = useMemo(() => {
    const total      = allLeads.length;
    const converted  = allLeads.filter(l => l.status === "Converted").length;
    const inProgress = allLeads.filter(l => l.status === "In Progress").length;
    const notInt     = allLeads.filter(l => l.status === "Not Interested").length;
    const newLeads   = allLeads.filter(l => l.status === "New").length;
    return { total, converted, inProgress, notInt, newLeads };
  }, [allLeads]);

  const displayed = useMemo(() => {
    let res = allLeads.filter(l => {
      const q           = search.toLowerCase();
      const matchSearch = !q || l.name.toLowerCase().includes(q) || l.phone.includes(q) || (l.agent || "").toLowerCase().includes(q);
      const matchSt     = filterSt    === "All" || l.status  === filterSt;
      const matchAgent  = filterAgent === "All" || l.agent   === filterAgent;
      const matchSrc    = filterSrc   === "All" || l.source  === filterSrc;
      const matchTemp   = filterTemp  === "All" || l.Quality === filterTemp;
      let matchDate = true;
      if (dateFrom) matchDate = matchDate && new Date(l._raw_date) >= new Date(dateFrom);
      if (dateTo)   matchDate = matchDate && new Date(l._raw_date) <= new Date(dateTo + "T23:59:59");
      return matchSearch && matchSt && matchAgent && matchSrc && matchTemp && matchDate;
    });
    return res.slice().sort((a, b) => {
      if (sortBy === "date_desc") return new Date(b._raw_date || 0) - new Date(a._raw_date || 0);
      if (sortBy === "date_asc")  return new Date(a._raw_date || 0) - new Date(b._raw_date || 0);
      if (sortBy === "name_asc")  return a.name.localeCompare(b.name);
      if (sortBy === "status")    return a.status.localeCompare(b.status);
      return 0;
    });
  }, [allLeads, search, filterSt, filterAgent, filterSrc, filterTemp, dateFrom, dateTo, sortBy]);

  const totalPages = Math.ceil(displayed.length / PER_PAGE);
  const paged      = displayed.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const clearFilters = () => {
    setSearch(""); setFilterSt("All"); setFilterAgent("All"); setFilterSrc("All");
    setFilterTemp("All"); setDateFrom(""); setDateTo(""); setPage(1);
  };

  const exportToCSV = useCallback(() => {
    if (!displayed.length) return;
    const headers = ["Name","Phone","Email","Agent","Source","Campaign","Date","Status","Quality","Calls","Last Outcome","Last Called","Remark"];
    const escape  = v => { const s = String(v ?? "").replace(/"/g, '""'); return /[",\n\r]/.test(s) ? `"${s}"` : s; };
    const rows    = displayed.map(l => [
      l.name, l.phone, l.email, l.agent, l.source, l.campaign, l.date, l.status,
      l.Quality || "", l.callHistory.length, l.lastOutcome || "",
      l.lastCalledAt ? new Date(l.lastCalledAt).toLocaleDateString("en-GB") : "", l.remark,
    ].map(escape).join(","));
    const blob = new Blob([[headers.join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  }, [displayed]);

  const INP = "px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] text-[12px] text-[#0F1117] dark:text-[#F0F2FA] focus:outline-none focus:border-[#2563EB] transition";

  return (
    <div className="bg-[#F8F9FC] dark:bg-[#0D0F14] min-h-screen px-6 py-8">

      {/* Modals */}
      {showAdd    && <AddLeadModal   onClose={() => setShowAdd(false)}    onAdd={handleAdd} />}
      {showImport && <ImportCSVModal onClose={() => setShowImport(false)} onImported={fetchLeads} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-[24px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Lead Management</h1>
          <p className="text-[13px] text-[#8B92A9] dark:text-[#565C75] mt-0.5">
            Full pipeline view — click any lead to see its complete journey
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#059669] text-white text-[12px] font-semibold hover:bg-emerald-700 transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Add Lead
          </button>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#7C3AED] text-white text-[12px] font-semibold hover:bg-violet-700 transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
            </svg>
            Import CSV
          </button>
          <button onClick={exportToCSV} disabled={!displayed.length}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export CSV
            {displayed.length > 0 && (
              <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {displayed.length}
              </span>
            )}
          </button>
          <button onClick={fetchLeads}
            className="p-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] text-[#8B92A9] hover:text-[#2563EB] transition"
            title="Refresh">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
      </div>

      {/* KPI pills */}
      <div className="flex flex-wrap gap-3 mb-6">
        {[
          { label: "Total",          value: kpi.total,      color: "#2563EB", bg: "bg-blue-50 dark:bg-blue-950/30",       text: "text-blue-700 dark:text-blue-300",       filter: "All" },
          { label: "New",            value: kpi.newLeads,   color: "#2563EB", bg: "bg-blue-50 dark:bg-blue-950/30",       text: "text-blue-600 dark:text-blue-400",       filter: "New" },
          { label: "In Progress",    value: kpi.inProgress, color: "#D97706", bg: "bg-amber-50 dark:bg-amber-950/30",     text: "text-amber-600 dark:text-amber-400",     filter: "In Progress" },
          { label: "Converted",      value: kpi.converted,  color: "#059669", bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400", filter: "Converted" },
          { label: "Not Interested", value: kpi.notInt,     color: "#DC2626", bg: "bg-red-50 dark:bg-red-950/30",         text: "text-red-600 dark:text-red-400",         filter: "Not Interested" },
        ].map(s => (
          <button key={s.label}
            onClick={() => { setFilterSt(filterSt === s.filter ? "All" : s.filter); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition font-semibold text-[13px] ${s.bg} ${s.text} ${filterSt === s.filter ? "" : "border-transparent"}`}
            style={{ borderColor: filterSt === s.filter ? s.color : undefined }}>
            <span className="text-[18px] font-black">{s.value}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search name, phone, agent…" className={INP + " pl-9 w-full"} />
          </div>
          <select value={filterAgent} onChange={e => { setFilterAgent(e.target.value); setPage(1); }} className={INP}>
            <option value="All">All agents</option>
            {agents.map(a => <option key={a}>{a}</option>)}
          </select>
          <select value={filterSrc} onChange={e => { setFilterSrc(e.target.value); setPage(1); }} className={INP}>
            <option value="All">All sources</option>
            {uniqueSources.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterTemp} onChange={e => { setFilterTemp(e.target.value); setPage(1); }} className={INP}>
            <option value="All">All qualities</option>
            <option>Hot</option><option>Warm</option><option>Cold</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className={INP} title="From date" />
          <input type="date" value={dateTo}   onChange={e => { setDateTo(e.target.value);   setPage(1); }} className={INP} title="To date" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className={INP}>
            <option value="date_desc">Newest first</option>
            <option value="date_asc">Oldest first</option>
            <option value="name_asc">Name A–Z</option>
            <option value="status">By status</option>
          </select>
          {(search || filterSt !== "All" || filterAgent !== "All" || filterSrc !== "All" || filterTemp !== "All" || dateFrom || dateTo) && (
            <button onClick={clearFilters}
              className="px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-500 text-[12px] font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 transition">
              ✕ Clear
            </button>
          )}
        </div>
        <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] mt-2">
          {displayed.length} leads found{displayed.length !== allLeads.length ? ` (filtered from ${allLeads.length})` : ""}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-[12px]">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          {error}
          <button onClick={fetchLeads} className="ml-auto underline font-semibold">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#8B92A9]">
            <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            <span className="text-[13px]">Loading leads…</span>
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-[48px]"></span>
            <p className="text-[16px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
              {allLeads.length === 0 ? "No leads yet" : "No leads match your filters"}
            </p>
            {allLeads.length === 0 ? (
              <button onClick={() => setShowAdd(true)}
                className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#059669] text-white text-[13px] font-semibold hover:bg-emerald-700 transition">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
                Add first lead
              </button>
            ) : (
              <button onClick={clearFilters}
                className="mt-1 px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-blue-700 transition">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F8F9FC] dark:bg-[#13161E] border-b border-[#E4E7EF] dark:border-[#262A38]">
                    {["Lead", "Contact", "Agent", "Source / Campaign", "Date", "Status", "Quality", "Last Outcome", ""].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-[#8B92A9] dark:text-[#565C75] uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F2FA] dark:divide-[#1E2130]">
                  {paged.map(l => {
                    const sc = STATUS_CONFIG[l.status] || STATUS_CONFIG["New"];
                    return (
                      <tr key={l.id} className="hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] transition cursor-pointer group" onClick={() => setSelected(l)}>
                        {/* Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                              style={{ background: (sc.dot || "#2563EB") + "20", color: sc.dot || "#2563EB" }}>
                              {l.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-[#0F1117] dark:text-[#F0F2FA] whitespace-nowrap">{l.name}</p>
                              <p className="text-[10px] text-[#8B92A9]">{daysSince(l._raw_date) || "—"}</p>
                            </div>
                          </div>
                        </td>
                        {/* Contact */}
                        <td className="px-4 py-3">
                          <p className="font-mono text-[#4B5168] dark:text-[#9DA3BB] whitespace-nowrap">{l.phone || "—"}</p>
                          {l.email && <p className="text-[10px] text-[#8B92A9] truncate max-w-[130px]">{l.email}</p>}
                        </td>
                        {/* Agent */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-[8px] font-black text-purple-600 dark:text-purple-400 shrink-0">
                              {(l.agent || "?").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[#0F1117] dark:text-[#F0F2FA] truncate max-w-[90px]">{l.agent || "Unassigned"}</span>
                          </div>
                          {l.reassignCount > 0 && (
                            <p className="text-[9px] text-purple-400 mt-0.5"> {l.reassignCount} reassign{l.reassignCount > 1 ? "s" : ""}</p>
                          )}
                        </td>
                        {/* Source / Campaign */}
                        <td className="px-4 py-3">
                          <p className="text-[#0F1117] dark:text-[#F0F2FA] truncate max-w-[110px]">{l.source}</p>
                          {l.campaign !== "—" && <p className="text-[10px] text-[#8B92A9] truncate max-w-[110px]">{l.campaign}</p>}
                        </td>
                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap text-[#0F1117] dark:text-[#F0F2FA]">{l.date}</td>
                        {/* Status */}
                        <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                        {/* Quality */}
                        <td className="px-4 py-3"><TempBadge temp={l.Quality} /></td>
                        {/* Last Outcome */}
                        <td className="px-4 py-3">
                          {l.lastOutcome ? (
                            <div>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                                l.lastOutcome === "Interested" || l.lastOutcome === "Converted"
                                  ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                                  : l.lastOutcome === "Not Interested" || l.lastOutcome === "Not Reachable"
                                  ? "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                                  : "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                              }`}>{l.lastOutcome}</span>
                              {l.lastCalledAt && <p className="text-[9px] text-[#8B92A9] mt-0.5">{daysSince(l.lastCalledAt)}</p>}
                              {l.lastRemark && <p className="text-[9px] text-[#8B92A9] truncate max-w-[140px] italic mt-0.5">"{l.lastRemark}"</p>}
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#8B92A9]">No calls yet</span>
                          )}
                        </td>
                        {/* Open */}
                        <td className="px-4 py-3">
                          <button onClick={e => { e.stopPropagation(); setSelected(l); }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] text-[10px] font-bold opacity-0 group-hover:opacity-100 transition flex items-center gap-1 whitespace-nowrap">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-between bg-[#F8F9FC] dark:bg-[#13161E]">
                <span className="text-[11px] text-[#8B92A9]">
                  Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, displayed.length)} of {displayed.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27] disabled:opacity-40 transition">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                    </svg>
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                    return (
                      <button key={n} onClick={() => setPage(n)}
                        className={`w-7 h-7 rounded-lg text-[11px] font-semibold transition ${page === n ? "bg-[#2563EB] text-white" : "border border-[#E4E7EF] dark:border-[#262A38] text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27]"}`}>
                        {n}
                      </button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="w-7 h-7 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9] hover:bg-white dark:hover:bg-[#1A1D27] disabled:opacity-40 transition">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Journey drawer */}
      {selected && <LeadJourneyDrawer lead={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
