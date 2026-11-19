// src/finance/SalaryPage.jsx — Finance Dashboard → Salary slips. Create a slip for an employee, net auto-calculated,
// print/save as PDF (browser-side). `prefill` lets the Employees page open this with an employee selected.
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Plus, X, Loader2, Printer, Receipt } from "lucide-react";
import { listEmployees, listSalary, createSalary } from "./hrApi";

const inputCls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-emerald-500 dark:border-[#2A3040] dark:bg-[#141925] dark:text-slate-100";
const btnPrimary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50";
const btnGhost = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-[13px] font-medium hover:bg-slate-50 dark:border-[#2A3040] dark:hover:bg-[#1A2030]";
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const monthLabel = (m) => { if (!m) return ""; const [y, mo] = m.split("-"); return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }); };
function Field({ label, children }) { return <label className="block"><span className="mb-1 block text-[12px] font-medium text-slate-600 dark:text-slate-300">{label}</span>{children}</label>; }

function Slip({ s, companyName }) {
  const E = (s.basicSalary || 0) + (s.incentivePay || 0) + (s.travelAllowance || 0) + (s.otherEarnings || 0);
  const D = (s.lossOfPay || 0) + (s.professionalTax || 0) + (s.otherDeductions || 0);
  return (
    <div id="salary-slip-print" className="rounded-lg border border-slate-300 bg-white text-slate-900">
      <div className="flex items-center justify-between bg-[#0b2b4a] px-5 py-4 text-white"><div className="text-[17px] font-extrabold">{companyName || "Company"}</div><div className="text-right text-[12px]">Salary Slip<div className="text-[14px] font-bold">{monthLabel(s.payMonth)}</div></div></div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 border-b-2 border-slate-200 px-5 py-3 text-[12.5px]">
        {[["Employee", s.employeeName], ["Designation", s.designation || "—"], ["Department", s.department || "—"], ["Bank A/C", s.bankAcNo || "—"], ["Pay Days", s.payDays ?? "—"], ["LOP Days", s.lopDays ?? 0]].map(([k, v]) => <div key={k} className="flex justify-between border-b border-dashed border-slate-200 py-1"><span className="text-slate-500">{k}</span><span className="font-semibold">{v}</span></div>)}
      </div>
      <div className="grid grid-cols-2">
        <div className="border-r border-slate-200"><h4 className="bg-slate-50 px-5 py-2 text-[12px] font-semibold uppercase tracking-wide">Earnings</h4><div className="px-5 py-2 text-[13px]">
          <Row k="Basic Salary" v={inr(s.basicSalary)} /><Row k="Incentive Pay" v={inr(s.incentivePay)} /><Row k="Travel Allowance" v={inr(s.travelAllowance)} />{s.otherEarnings ? <Row k="Other Earnings" v={inr(s.otherEarnings)} /> : null}<Row k="Total Earnings" v={inr(E)} total /></div></div>
        <div><h4 className="bg-slate-50 px-5 py-2 text-[12px] font-semibold uppercase tracking-wide">Deductions</h4><div className="px-5 py-2 text-[13px]">
          <Row k="Loss of Pay" v={inr(s.lossOfPay)} /><Row k="Professional Tax" v={inr(s.professionalTax)} />{s.otherDeductions ? <Row k="Other Deductions" v={inr(s.otherDeductions)} /> : null}<Row k="Total Deductions" v={inr(D)} total /></div></div>
      </div>
      <div className="flex items-center justify-between border-t-2 border-emerald-500 bg-emerald-50 px-5 py-3"><span className="text-[13px] text-emerald-800">Net Salary Payable</span><span className="text-[22px] font-extrabold text-emerald-800">{inr(E - D)}</span></div>
      <div className="px-5 py-3 text-[11px] text-slate-400">This is a computer-generated slip and needs no signature.</div>
    </div>
  );
}
function Row({ k, v, total }) { return <div className={`flex justify-between py-1.5 ${total ? "mt-1 border-t-2 border-slate-800 pt-2 font-bold" : "border-b border-dashed border-slate-200"}`}><span>{k}</span><span>{v}</span></div>; }

function SalaryForm({ employees, prefill, onClose, onSaved }) {
  const [f, setF] = useState(() => ({ employee: prefill?._id || "", payMonth: new Date().toISOString().slice(0, 7), payDays: 30, lopDays: 0, basicSalary: "", incentivePay: "", travelAllowance: "", otherEarnings: "", lossOfPay: "", professionalTax: "", otherDeductions: "", transactionId: "" }));
  const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(null);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const emp = useMemo(() => employees.find((e) => e._id === f.employee), [employees, f.employee]);
  const preview = { ...f, employeeName: emp?.name || "—", designation: emp?.designation, department: emp?.department, bankAcNo: emp?.bankAcNo,
    basicSalary: +f.basicSalary || 0, incentivePay: +f.incentivePay || 0, travelAllowance: +f.travelAllowance || 0, otherEarnings: +f.otherEarnings || 0, lossOfPay: +f.lossOfPay || 0, professionalTax: +f.professionalTax || 0, otherDeductions: +f.otherDeductions || 0 };
  const save = async () => {
    if (!f.employee) { toast.error("Select an employee."); return; }
    setBusy(true);
    try { const body = { ...f, payDays: +f.payDays || 0, lopDays: +f.lopDays || 0, basicSalary: +f.basicSalary || 0, incentivePay: +f.incentivePay || 0, travelAllowance: +f.travelAllowance || 0, otherEarnings: +f.otherEarnings || 0, lossOfPay: +f.lossOfPay || 0, professionalTax: +f.professionalTax || 0, otherDeductions: +f.otherDeductions || 0 };
      const res = await createSalary(body); setSaved(res.salary); toast.success("Salary slip created"); onSaved?.();
    } catch (e) { toast.error(e?.response?.data?.message || "Could not create."); } finally { setBusy(false); }
  };
  const nums = [["basicSalary", "Basic Salary"], ["incentivePay", "Incentive Pay"], ["travelAllowance", "Travel Allowance"], ["otherEarnings", "Other Earnings"], ["lossOfPay", "Loss of Pay"], ["professionalTax", "Professional Tax"], ["otherDeductions", "Other Deductions"]];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl dark:bg-[#0F141E]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-[15px] font-semibold">Generate salary slip</h3><button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-[#1A2030]"><X className="h-4 w-4" /></button></div>
        {!saved ? (<>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Employee *"><select className={inputCls} value={f.employee} onChange={(e) => set("employee", e.target.value)}><option value="">Select…</option>{employees.map((e) => <option key={e._id} value={e._id}>{e.name}</option>)}</select></Field>
            <Field label="Pay month *"><input type="month" className={inputCls} value={f.payMonth} onChange={(e) => set("payMonth", e.target.value)} /></Field>
            <Field label="Pay days"><input type="number" className={inputCls} value={f.payDays} onChange={(e) => set("payDays", e.target.value)} /></Field>
            {nums.map(([k, label]) => <Field key={k} label={label}><input type="number" className={inputCls} value={f[k]} onChange={(e) => set(k, e.target.value)} /></Field>)}
            <Field label="Transaction ID"><input className={inputCls} value={f.transactionId} onChange={(e) => set("transactionId", e.target.value)} /></Field>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 p-2 dark:border-[#2A3040]"><p className="mb-1 px-1 text-[11px] text-slate-400">Live preview</p><Slip s={preview} companyName={emp ? "" : ""} /></div>
          <div className="mt-4 flex justify-end gap-2"><button className={btnGhost} onClick={onClose}>Cancel</button><button className={btnPrimary} disabled={busy} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}Create slip</button></div>
        </>) : (<>
          <Slip s={saved} companyName="" />
          <div className="mt-4 flex justify-end gap-2"><button className={btnGhost} onClick={onClose}>Close</button><button className={btnPrimary} onClick={() => window.print()}><Printer className="h-4 w-4" />Print / Save as PDF</button></div>
        </>)}
      </div>
    </div>
  );
}

export default function SalaryPage({ prefillEmployee, clearPrefill }) {
  const [employees, setEmployees] = useState([]);
  const [slips, setSlips] = useState(null);
  const [form, setForm] = useState(prefillEmployee || null);
  const load = async () => { try { const [e, s] = await Promise.all([listEmployees(), listSalary()]); setEmployees(e.employees || []); setSlips(s.salaries || []); } catch { setSlips([]); toast.error("Could not load."); } };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (prefillEmployee) setForm(prefillEmployee); }, [prefillEmployee]);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between"><h3 className="text-[14px] font-semibold">Salary slips</h3><button className={btnPrimary} onClick={() => setForm({})}><Plus className="h-4 w-4" />Generate slip</button></div>
      {slips === null ? <div className="py-10 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        : slips.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-[13px] text-slate-500 dark:border-[#2A3040]">No salary slips yet.</div>
        : (<div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#1F2533]"><table className="w-full text-[13px]"><thead className="bg-slate-50 text-left text-[12px] text-slate-500 dark:bg-[#141925]"><tr><th className="px-3 py-2">Employee</th><th className="px-3 py-2">Month</th><th className="px-3 py-2">Net</th><th className="px-3 py-2">Emailed</th></tr></thead><tbody>
          {slips.map((s) => <tr key={s._id} className="border-t border-slate-100 dark:border-[#1A2030]"><td className="px-3 py-2 font-semibold">{s.employeeName}</td><td className="px-3 py-2">{monthLabel(s.payMonth)}</td><td className="px-3 py-2 font-semibold">{inr(s.netSalary)}</td><td className="px-3 py-2">{s.emailSent ? "Yes" : "—"}</td></tr>)}
        </tbody></table></div>)}
      {form !== null && <SalaryForm employees={employees} prefill={form} onClose={() => { setForm(null); clearPrefill?.(); }} onSaved={load} />}
    </div>
  );
}
