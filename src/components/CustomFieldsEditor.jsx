// src/components/CustomFieldsEditor.jsx
// Renders the company's custom lead fields (Customize CRM → Lead Fields) as
// form inputs, or as read-only rows. Used by the employee Update panel and the
// admin add / edit lead forms.
//
//   <CustomFieldsEditor values={lead.customFields} onChange={setCf} role="employee" />
//   <CustomFieldsEditor values={lead.customFields} readOnly />
import useCustomization from "../hooks/useCustomization";
import { formatCustomValue } from "../utils/customFields";

const INP = "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[14px] text-[#0F1117] dark:text-white placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition";

function toInputValue(field, v) {
  if (v === null || v === undefined) return "";
  if (field.type === "date") return String(v).slice(0, 10);
  if (field.type === "datetime") {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return v;
}

export default function CustomFieldsEditor({
  values = {}, onChange, role = "admin", readOnly = false, onlyForm = false, title = "Additional details", columns = 2,
}) {
  const { customFields } = useCustomization();
  const isEmployee = role === "employee" || role === "user";
  let fields = customFields({ role: isEmployee ? "employee" : "admin" });
  if (onlyForm) fields = fields.filter((f) => f.showInForm);
  if (!fields.length) return null;

  const set = (k, v) => onChange && onChange({ ...(values || {}), [k]: v });

  if (readOnly) {
    return (
      <div>
        {title && <p className="text-[12px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">{title}</p>}
        <div className={`grid grid-cols-1 ${columns === 2 ? "sm:grid-cols-2" : ""} gap-x-4 gap-y-1.5`}>
          {fields.map((f) => (
            <div key={f.key} className="min-w-0">
              <p className="text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest">{f.label}</p>
              <p className="text-[14px] font-semibold text-[#0F1117] dark:text-white break-words">{formatCustomValue(f, values?.[f.key])}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {title && <p className="text-[12px] font-bold text-[#8B92A9] uppercase tracking-widest mb-2">{title}</p>}
      <div className={`grid grid-cols-1 ${columns === 2 ? "sm:grid-cols-2" : ""} gap-3`}>
        {fields.map((f) => {
          const locked = isEmployee && !f.employeeEditable;
          const v = values?.[f.key];
          const label = (
            <label className="block text-[13px] font-semibold text-[#4B5168] dark:text-white mb-1">
              {f.label}{f.required && <span className="text-red-500"> *</span>}
            </label>
          );
          let input;
          switch (f.type) {
            case "textarea":
              input = <textarea rows={3} value={v ?? ""} disabled={locked} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} className={INP + " resize-y"} />;
              break;
            case "number":
              input = <input type="number" value={v ?? ""} disabled={locked} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value === "" ? null : e.target.value)} className={INP} />;
              break;
            case "date":
              input = <input type="date" value={toInputValue(f, v)} disabled={locked} onChange={(e) => set(f.key, e.target.value || null)} className={INP} />;
              break;
            case "datetime":
              input = <input type="datetime-local" value={toInputValue(f, v)} disabled={locked} onChange={(e) => set(f.key, e.target.value ? new Date(e.target.value).toISOString() : null)} className={INP} />;
              break;
            case "select":
              input = (
                <select value={v ?? ""} disabled={locked} onChange={(e) => set(f.key, e.target.value || null)} className={INP}>
                  <option value="">— Select —</option>
                  {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              );
              break;
            case "multiselect": {
              const arr = Array.isArray(v) ? v : [];
              input = (
                <div className="flex flex-wrap gap-1.5">
                  {f.options.map((o) => {
                    const on = arr.includes(o);
                    return (
                      <button key={o} type="button" disabled={locked}
                        onClick={() => set(f.key, on ? arr.filter((x) => x !== o) : [...arr, o])}
                        className={`px-2.5 py-1 rounded-lg border text-[12px] font-semibold transition ${on ? "border-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB]" : "border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB]"}`}>
                        {o}
                      </button>
                    );
                  })}
                </div>
              );
              break;
            }
            case "checkbox":
              input = (
                <label className="flex items-center gap-2 text-[14px] text-[#0F1117] dark:text-white">
                  <input type="checkbox" checked={!!v} disabled={locked} onChange={(e) => set(f.key, e.target.checked)} className="w-4 h-4 accent-[#2563EB]" />
                  {f.placeholder || "Yes"}
                </label>
              );
              break;
            default:
              input = <input type={f.type === "email" ? "email" : f.type === "url" ? "url" : f.type === "phone" ? "tel" : "text"} value={v ?? ""} disabled={locked} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} className={INP} />;
          }
          return (
            <div key={f.key} className={f.type === "textarea" || f.type === "multiselect" ? (columns === 2 ? "sm:col-span-2" : "") : ""}>
              {label}
              {input}
              {f.helpText && <p className="text-[11px] text-[#8B92A9] mt-1">{f.helpText}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
