// src/finance/CredentialsPage.jsx — Finance Dashboard → Credentials.
// One place for logins: our own tools & services, client accounts we manage,
// and employee work logins. Passwords, API keys and secret notes are encrypted
// on the server, hidden here (••••••), and only shown or copied through a
// logged "Reveal". Platform support (developer) access can't reveal.
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Plus, Pencil, Trash2, X, Loader2, Search, Eye, EyeOff, Copy, KeyRound, Building2, Users, Wrench,
  ExternalLink, History, ShieldCheck, ShieldAlert, Wand2, CalendarClock,
} from "lucide-react";
import {
  listCredentials, createCredential, updateCredential, deleteCredential, revealCredential, credentialLog,
  listTools, listEmployees,
} from "./hrApi";

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-[#2A3040] dark:bg-[#141925] dark:text-slate-100";
const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";
const btnGhost = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-[13px] font-medium hover:bg-slate-50 dark:border-[#2A3040] dark:hover:bg-[#1A2030] disabled:opacity-50";
const iconBtn = "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1A2030] disabled:opacity-40";
const lbl = "mb-1 block text-[11.5px] font-semibold text-slate-600 dark:text-slate-300";
const errMsg = (e, f) => e?.response?.data?.message || f;
const fmtWhen = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");
const toDay = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const KINDS = [
  { key: "tool",     label: "Our tools & services", short: "Our tools", icon: Wrench,
    services: ["AWS", "MSG91", "MongoDB Atlas", "Cloudinary", "GoDaddy / Domain", "Hostinger / Hosting", "Google Workspace", "Meta Business", "Razorpay", "Canva", "OpenAI", "GitHub"] },
  { key: "client",   label: "Client accounts", short: "Clients", icon: Building2,
    services: ["Meta Ads", "Facebook Page", "Instagram", "Google Ads", "Google Business Profile", "Google Analytics", "Search Console", "Shopify", "WordPress", "Website hosting", "Domain"] },
  { key: "employee", label: "Employee logins", short: "Employees", icon: Users,
    services: ["Google Workspace email", "SkyUp CRM", "Canva", "Slack", "Zoho", "Laptop / device"] },
];
const kindOf = (k) => KINDS.find((x) => x.key === k) || KINDS[0];

// Strong random password (no look-alike characters).
function generatePassword(len = 18) {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%^&*-_=+"];
  const all = sets.join("");
  const rnd = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  const chars = sets.map((s) => s[rnd(s.length)]);
  while (chars.length < len) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = rnd(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}

function expiryBadge(d) {
  if (!d) return null;
  const days = Math.ceil((new Date(d) - Date.now()) / 86400000);
  if (days < 0) return <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10.5px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">Expired {fmtDay(d)}</span>;
  if (days <= 30) return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">Renews in {days}d</span>;
  return <span className="text-[11px] text-slate-500">Renews {fmtDay(d)}</span>;
}

// ── add / edit form ──────────────────────────────────────────────────────────
function CredentialForm({ initial, tools, employees, onClose, onSaved }) {
  const editing = !!initial?._id;
  const [f, setF] = useState(() => ({
    kind: initial?.kind || "tool", name: initial?.name || "", service: initial?.service || "", url: initial?.url || "",
    username: initial?.username || "", password: "", apiKey: "", secretNotes: "", notes: initial?.notes || "",
    clientName: initial?.clientName || "", employee: initial?.employee || "", employeeName: initial?.employeeName || "",
    tool: initial?.tool || "", expiresOn: toDay(initial?.expiresOn),
    clear_password: false, clear_apiKey: false, clear_secretNotes: false,
  }));
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const K = kindOf(f.kind);

  const submit = async () => {
    if (!f.name.trim()) return toast.error("Give it a name, e.g. \"AWS root\" or \"Meta Ads — GC Traders\".");
    if (f.kind === "client" && !f.clientName.trim()) return toast.error("Enter the client's name.");
    setBusy(true);
    try {
      const body = { ...f, employee: f.kind === "employee" ? f.employee || null : null, tool: f.kind === "tool" ? f.tool || null : null };
      if (f.kind === "employee" && f.employee) body.employeeName = employees.find((e) => e._id === f.employee)?.name || f.employeeName;
      for (const k of ["password", "apiKey", "secretNotes"]) if (!body[k]) delete body[k];   // blank = keep the saved one
      const r = editing ? await updateCredential(initial._id, body) : await createCredential(body);
      toast.success(editing ? "Saved" : "Added to the vault");
      onSaved(r.credential);
    } catch (e) { toast.error(errMsg(e, "Could not save.")); }
    finally { setBusy(false); }
  };

  const secretInput = (k, label, placeholder, textarea = false) => {
    const saved = editing && initial[`has_${k}`];
    return (
      <div>
        <label className={lbl}>{label}{saved && !f[`clear_${k}`] ? <span className="font-normal text-emerald-600"> · saved (encrypted) — leave blank to keep</span> : null}</label>
        {textarea ? (
          <textarea rows={3} className={`${inputCls} font-mono text-[12.5px]`} value={f[k]} disabled={f[`clear_${k}`]} placeholder={saved ? "••••••" : placeholder} onChange={(e) => set(k, e.target.value)} autoComplete="off" />
        ) : (
          <div className="flex gap-1.5">
            <input className={`${inputCls} font-mono`} type={k === "password" && !showPw ? "password" : "text"} value={f[k]} disabled={f[`clear_${k}`]}
                   placeholder={saved ? "••••••" : placeholder} onChange={(e) => set(k, e.target.value)} autoComplete="new-password" />
            {k === "password" && <>
              <button type="button" className={btnGhost} onClick={() => setShowPw((s) => !s)} title={showPw ? "Hide" : "Show what you typed"}>{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              <button type="button" className={btnGhost} onClick={() => { set("password", generatePassword()); setShowPw(true); }} title="Generate a strong password"><Wand2 className="h-4 w-4" /></button>
            </>}
          </div>
        )}
        {saved && (
          <label className="mt-1 flex items-center gap-1.5 text-[11.5px] text-slate-500">
            <input type="checkbox" checked={f[`clear_${k}`]} onChange={(e) => { set(`clear_${k}`, e.target.checked); if (e.target.checked) set(k, ""); }} /> Remove the saved {label.toLowerCase()}
          </label>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-3" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl dark:bg-[#0F141E]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-[#1F2533]">
          <KeyRound className="h-5 w-5 text-emerald-600" />
          <h3 className="flex-1 text-[15px] font-bold">{editing ? `Edit ${initial.name}` : "Add a credential"}</h3>
          <button className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A2030]" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-1.5">
            {KINDS.map((k) => (
              <button key={k.key} type="button" onClick={() => set("kind", k.key)}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[12.5px] font-semibold ${f.kind === k.key ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-slate-600 dark:border-[#2A3040] dark:text-slate-300"}`}>
                <k.icon className="h-4 w-4" />{k.short}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className={lbl}>Name *</label><input className={inputCls} value={f.name} maxLength={120} onChange={(e) => set("name", e.target.value)}
              placeholder={f.kind === "client" ? "Meta Ads — GC Traders" : f.kind === "employee" ? "Anu — Google Workspace" : "AWS root account"} /></div>
            <div><label className={lbl}>Service</label><input className={inputCls} list="cred-services" value={f.service} maxLength={80} onChange={(e) => set("service", e.target.value)} placeholder={K.services[0]} />
              <datalist id="cred-services">{K.services.map((x) => <option key={x} value={x} />)}</datalist></div>
            {f.kind === "client" && (
              <div className="sm:col-span-2"><label className={lbl}>Client *</label><input className={inputCls} value={f.clientName} maxLength={160} onChange={(e) => set("clientName", e.target.value)} placeholder="GC Traders" /></div>
            )}
            {f.kind === "employee" && (
              <div className="sm:col-span-2"><label className={lbl}>Employee</label>
                {employees.length ? (
                  <select className={inputCls} value={f.employee} onChange={(e) => set("employee", e.target.value)}>
                    <option value="">— pick an employee —</option>
                    {employees.map((e) => <option key={e._id} value={e._id}>{e.name}{e.designation ? ` · ${e.designation}` : ""}</option>)}
                  </select>
                ) : <input className={inputCls} value={f.employeeName} onChange={(e) => set("employeeName", e.target.value)} placeholder="Employee name" />}
              </div>
            )}
            {f.kind === "tool" && tools.length > 0 && (
              <div className="sm:col-span-2"><label className={lbl}>Linked subscription <span className="font-normal text-slate-500">(from Tools — optional)</span></label>
                <select className={inputCls} value={f.tool} onChange={(e) => set("tool", e.target.value)}>
                  <option value="">— none —</option>
                  {tools.map((t) => <option key={t._id} value={t._id}>{t.name}{t.category ? ` · ${t.category}` : ""}</option>)}
                </select>
              </div>
            )}
            <div className="sm:col-span-2"><label className={lbl}>Login URL</label><input className={inputCls} value={f.url} maxLength={400} onChange={(e) => set("url", e.target.value)} placeholder="console.aws.amazon.com" /></div>
            <div className="sm:col-span-2"><label className={lbl}>Username / email</label><input className={inputCls} value={f.username} maxLength={200} onChange={(e) => set("username", e.target.value)} autoComplete="off" placeholder="admin@yourcompany.com" /></div>
          </div>

          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-800 dark:text-emerald-300"><ShieldCheck className="h-4 w-4" />Encrypted — hidden in the list, shown only through a logged Reveal</div>
            {secretInput("password", "Password", "Type or generate")}
            {secretInput("apiKey", "API key / token", "Optional")}
            {secretInput("secretNotes", "Secret notes", "Optional — 2FA backup codes, recovery answers, PIN…", true)}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
            <div><label className={lbl}>Notes <span className="font-normal text-slate-500">(not secret — visible in the list)</span></label>
              <input className={inputCls} value={f.notes} maxLength={1000} onChange={(e) => set("notes", e.target.value)} placeholder="2FA on Pooja's phone · billing card ending 4321" /></div>
            <div><label className={lbl}>Renews / expires</label><input type="date" className={inputCls} value={f.expiresOn} onChange={(e) => set("expiresOn", e.target.value)} /></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-[#1F2533]">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={submit} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{editing ? "Save" : "Add to vault"}</button>
        </div>
      </div>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────
export default function CredentialsPage() {
  const [data, setData] = useState(null);
  const [tools, setTools] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);          // null | {} (new) | credential
  const [shown, setShown] = useState({});                 // `${id}:${field}` → revealed value (auto-hides)
  const [logFor, setLogFor] = useState(null);             // { credential, log }

  const load = async () => {
    try { setData(await listCredentials()); }
    catch (e) { setData({ credentials: [], encryptionReady: true, canReveal: false }); toast.error(errMsg(e, "Could not load credentials.")); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    listTools().then((d) => setTools(d.tools || [])).catch(() => {});
    listEmployees().then((d) => setEmployees(d.employees || [])).catch(() => {});
  }, []);

  const all = data?.credentials || [];
  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k.key, all.filter((c) => c.kind === k.key).length])), [all]);
  const dueSoon = all.filter((c) => c.expiresOn && (new Date(c.expiresOn) - Date.now()) / 86400000 <= 30).length;
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((c) => (!kind || c.kind === kind)
      && (!q || [c.name, c.service, c.username, c.clientName, c.employeeName, c.notes, c.url].some((v) => String(v || "").toLowerCase().includes(q))));
  }, [all, kind, search]);

  const reveal = async (c, field, { copy = false } = {}) => {
    const key = `${c._id}:${field}`;
    try {
      const value = shown[key] ?? (await revealCredential(c._id, field)).value;
      if (copy) {
        await navigator.clipboard.writeText(value);
        toast.success(`${field === "password" ? "Password" : field === "apiKey" ? "API key" : "Notes"} copied`);
      } else {
        setShown((s) => ({ ...s, [key]: value }));
        setTimeout(() => setShown((s) => { const n = { ...s }; delete n[key]; return n; }), 20000);   // hide again after 20 s
      }
    } catch (e) { toast.error(errMsg(e, "Could not reveal.")); }
  };
  const hide = (c, field) => setShown((s) => { const n = { ...s }; delete n[`${c._id}:${field}`]; return n; });
  const copyPlain = async (text, what) => { try { await navigator.clipboard.writeText(text); toast.success(`${what} copied`); } catch { toast.error("Couldn't copy."); } };

  const remove = async (c) => {
    if (!window.confirm(`Delete "${c.name}" from the vault? Its saved password and keys are erased.`)) return;
    try { await deleteCredential(c._id); toast.success("Deleted"); load(); } catch (e) { toast.error(errMsg(e, "Could not delete.")); }
  };
  const openLog = async (c) => {
    try { const d = await credentialLog(c._id); setLogFor({ credential: c, log: d.log || [], total: d.total || 0 }); }
    catch (e) { toast.error(errMsg(e, "Could not load the log.")); }
  };

  const secretCell = (c, field, label) => {
    if (!c[`has_${field}`]) return null;
    const key = `${c._id}:${field}`;
    const value = shown[key];
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-[86px] shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <code className={`min-w-0 max-w-full rounded bg-slate-100 px-2 py-0.5 text-[12.5px] dark:bg-[#141925] ${value ? "whitespace-pre-wrap break-all text-slate-900 dark:text-slate-100" : "tracking-widest text-slate-500"}`}>{value ?? "••••••••••"}</code>
        {data?.canReveal && (value
          ? <button className={iconBtn} onClick={() => hide(c, field)}><EyeOff className="h-3.5 w-3.5" />Hide</button>
          : <button className={iconBtn} onClick={() => reveal(c, field)} title="Shows it for 20 seconds — logged"><Eye className="h-3.5 w-3.5" />Reveal</button>)}
        {data?.canReveal && <button className={iconBtn} onClick={() => reveal(c, field, { copy: true })} title="Copy without showing it — logged"><Copy className="h-3.5 w-3.5" />Copy</button>}
      </div>
    );
  };

  return (
    <div>
      {data && !data.encryptionReady && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-[13px] text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div><b>The vault is locked.</b> The server has no encryption key (FIELD_ENCRYPTION_KEY), so passwords can't be stored safely and saving is blocked. Ask your developer to set it, then reload.</div>
        </div>
      )}
      {data && !data.canReveal && (
        <div className="mb-3 rounded-xl border border-slate-300 bg-slate-50 p-3 text-[12.5px] text-slate-600 dark:border-[#2A3040] dark:bg-[#141925] dark:text-slate-300">
          You're viewing as platform support: secrets can't be revealed or copied.
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {[{ key: "", label: "All", n: all.length }, ...KINDS.map((k) => ({ key: k.key, label: k.label, n: counts[k.key] }))].map((t) => (
            <button key={t.key || "all"} onClick={() => setKind(t.key)}
                    className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ${kind === t.key ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#141925] dark:text-slate-300"}`}>
              {t.label} <span className="opacity-70">{t.n}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${inputCls} w-64 pl-8`} placeholder="Search name, service, user, client…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className={btnPrimary} onClick={() => setEditing({})} disabled={data && !data.encryptionReady}><Plus className="h-4 w-4" />Add credential</button>
      </div>
      {dueSoon > 0 && <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-amber-700 dark:text-amber-300"><CalendarClock className="h-4 w-4" />{dueSoon} renew{dueSoon === 1 ? "s" : ""} or expire{dueSoon === 1 ? "s" : ""} within 30 days</p>}

      {!data ? <div className="py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        : list.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center dark:border-[#2A3040]">
            <KeyRound className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <div className="text-[14px] font-semibold">{all.length ? "Nothing matches" : "The vault is empty"}</div>
            <div className="text-[12.5px] text-slate-500">Add logins for your tools, the client accounts you manage, and employee work accounts.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {list.map((c) => {
              const K = kindOf(c.kind);
              return (
                <div key={c._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#1F2533] dark:bg-[#0F141E]">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"><K.icon className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-[14px] font-bold">{c.name}</span>
                        {c.service && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600 dark:bg-[#141925] dark:text-slate-300">{c.service}</span>}
                        {expiryBadge(c.expiresOn)}
                      </div>
                      <div className="text-[12px] text-slate-500">
                        {c.kind === "client" && c.clientName ? `Client: ${c.clientName}` : c.kind === "employee" && c.employeeName ? `Employee: ${c.employeeName}` : K.label}
                        {c.url && <> · <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-emerald-700 hover:underline dark:text-emerald-400">open login<ExternalLink className="h-3 w-3" /></a></>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <button className={iconBtn} onClick={() => openLog(c)} title="Who revealed what, and when"><History className="h-3.5 w-3.5" />{c.revealCount || 0}</button>
                      <button className={iconBtn} onClick={() => setEditing(c)} title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                      <button className={`${iconBtn} hover:!bg-red-50 dark:hover:!bg-red-950/40`} onClick={() => remove(c)} title="Delete"><Trash2 className="h-3.5 w-3.5 text-red-600" /></button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {c.username && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="w-[86px] shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Username</span>
                        <code className="rounded bg-slate-100 px-2 py-0.5 text-[12.5px] dark:bg-[#141925]">{c.username}</code>
                        <button className={iconBtn} onClick={() => copyPlain(c.username, "Username")}><Copy className="h-3.5 w-3.5" />Copy</button>
                      </div>
                    )}
                    {secretCell(c, "password", "Password")}
                    {secretCell(c, "apiKey", "API key")}
                    {secretCell(c, "secretNotes", "Secret notes")}
                    {!c.has_password && !c.has_apiKey && !c.has_secretNotes && <div className="text-[12px] italic text-slate-400">No password saved</div>}
                  </div>
                  {(c.notes || c.lastReveal || c.passwordChangedAt) && (
                    <div className="mt-2 border-t border-slate-100 pt-2 text-[11.5px] text-slate-500 dark:border-[#1F2533]">
                      {c.notes && <div className="text-slate-600 dark:text-slate-300">{c.notes}</div>}
                      <div>
                        {c.passwordChangedAt && <>Password set {fmtDay(c.passwordChangedAt)}</>}
                        {c.lastReveal && <>{c.passwordChangedAt ? " · " : ""}last revealed by {c.lastReveal.byName} {fmtWhen(c.lastReveal.at)}</>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      {editing && (
        <CredentialForm initial={editing} tools={tools} employees={employees} onClose={() => setEditing(null)}
                        onSaved={() => { setEditing(null); setShown({}); load(); }} />
      )}

      {logFor && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-3" onClick={() => setLogFor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl dark:bg-[#0F141E]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <History className="h-5 w-5 text-emerald-600" />
              <h3 className="flex-1 text-[15px] font-bold">Access log · {logFor.credential.name}</h3>
              <button className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A2030]" onClick={() => setLogFor(null)}><X className="h-4 w-4" /></button>
            </div>
            {logFor.log.length === 0 ? <p className="py-6 text-center text-[13px] text-slate-500">Nobody has revealed or copied anything yet.</p> : (
              <div className="max-h-[50vh] divide-y divide-slate-100 overflow-y-auto dark:divide-[#1F2533]">
                {logFor.log.map((l, i) => (
                  <div key={i} className="flex justify-between gap-3 py-2 text-[12.5px]">
                    <span><b>{l.byName || "Someone"}</b> · {l.field === "password" ? "password" : l.field === "apiKey" ? "API key" : "secret notes"}</span>
                    <span className="text-slate-500">{fmtWhen(l.at)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500">{logFor.total} reveal{logFor.total === 1 ? "" : "s"} in total (the last 200 are kept).</p>
          </div>
        </div>
      )}
    </div>
  );
}
