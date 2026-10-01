// src/components/IndustryServicePicker.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Industry + Service(s) picker driven by the company's customization:
//   • Industry list  → Customize CRM → Lists → Industries
//     "Other"        → free-text box (Lead Fields → Industry → Allow "Other")
//   • Service list   → Customize CRM → Lists → Services
//     multi-select   → Lead Fields → Service → Allow multiple (default on)
//
//   <IndustryServicePicker industry={ind} onIndustry={setInd}
//       services={svcs} onServices={setSvcs} showIndustry showService />
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import useCustomization from "../hooks/useCustomization";

const CHIP = "px-3 py-1.5 rounded-xl border text-[13px] font-semibold transition";
const ON = "border-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7]";
const OFF = "border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#9DA3BB]";
const INPUT = "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[14px] text-[#0F1117] dark:text-white placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB]";

export default function IndustryServicePicker({
  industry = "", onIndustry, services = [], onServices,
  showIndustry = true, showService = true, disabled = false,
}) {
  const cz = useCustomization();
  const industries = cz.list("industries");
  const serviceList = cz.list("services");
  const indField = cz.leadField("industry");
  const svcField = cz.leadField("service");
  const allowOther = indField.allowOther !== false;
  const allowOtherSvc = !!svcField.allowOther;
  const multiple = svcField.multiple !== false;

  const inList = (v) => industries.some((x) => x.toLowerCase() === String(v || "").toLowerCase());
  const [otherOn, setOtherOn] = useState(!!industry && !inList(industry));
  const [otherSvc, setOtherSvc] = useState("");
  useEffect(() => { if (industry && !inList(industry)) setOtherOn(true); }, [industry]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickIndustry = (v) => { setOtherOn(false); onIndustry && onIndustry(industry === v ? "" : v); };
  const toggleService = (v) => {
    const has = services.includes(v);
    if (!multiple) return onServices && onServices(has ? [] : [v]);
    onServices && onServices(has ? services.filter((x) => x !== v) : [...services, v]);
  };
  const extraServices = services.filter((s) => !serviceList.includes(s));

  return (
    <div className="space-y-4">
      {showIndustry && (
        <div>
          <p className="text-[13px] font-semibold text-[#4B5168] dark:text-white mb-1.5">
            {indField.label || "Industry"} {!indField.required && <span className="font-normal text-[#8B92A9]">(optional)</span>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {industries.map((v) => (
              <button key={v} type="button" disabled={disabled} onClick={() => pickIndustry(v)}
                className={`${CHIP} ${!otherOn && industry === v ? ON : OFF}`}>{v}</button>
            ))}
            {allowOther && (
              <button type="button" disabled={disabled}
                onClick={() => { const next = !otherOn; setOtherOn(next); if (!next || inList(industry)) onIndustry && onIndustry(""); }}
                className={`${CHIP} ${otherOn ? ON : OFF}`}>Other</button>
            )}
          </div>
          {allowOther && otherOn && (
            <input autoFocus value={inList(industry) ? "" : industry} disabled={disabled} maxLength={80}
              onChange={(e) => onIndustry && onIndustry(e.target.value)}
              placeholder="Type the industry…" className={`${INPUT} mt-2`} />
          )}
        </div>
      )}

      {showService && (
        <div>
          <p className="text-[13px] font-semibold text-[#4B5168] dark:text-white mb-1.5">
            {svcField.label || "Service"}{multiple ? "s" : ""}{" "}
            <span className="font-normal text-[#8B92A9]">{multiple ? "(select all that apply)" : "(optional)"}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[...serviceList, ...extraServices].map((v) => (
              <button key={v} type="button" disabled={disabled} onClick={() => toggleService(v)}
                className={`${CHIP} ${services.includes(v) ? ON : OFF}`}>
                {services.includes(v) && multiple ? "✓ " : ""}{v}
              </button>
            ))}
          </div>
          {allowOtherSvc && (
            <div className="flex gap-2 mt-2">
              <input value={otherSvc} disabled={disabled} maxLength={80} onChange={(e) => setOtherSvc(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && otherSvc.trim()) { e.preventDefault(); toggleService(otherSvc.trim()); setOtherSvc(""); } }}
                placeholder="Other service…" className={INPUT} />
              <button type="button" disabled={disabled || !otherSvc.trim()} onClick={() => { toggleService(otherSvc.trim()); setOtherSvc(""); }}
                className="px-3 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold disabled:opacity-50">Add</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
