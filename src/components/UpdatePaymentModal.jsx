// ─────────────────────────────────────────────────────────────────────────────
//  UpdatePaymentModal.jsx
//
//  USAGE:
//    import UpdatePaymentModal from "./UpdatePaymentModal";
//
//    <UpdatePaymentModal
//      currentMethod={subscription.paymentMethod}   // e.g. "Visa •••• 4242"
//      onSave={(method) => setSubscription(prev => ({...prev, paymentMethod: method}))}
//      onClose={() => setShowUpdatePayment(false)}
//    />
//
//  Props:
//    currentMethod  string   — displayed masked method currently on file
//    onSave         fn(str)  — called with new masked method string on success
//    onClose        fn       — called to dismiss the modal
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

// ── helpers ──────────────────────────────────────────────────────────────────
const formatCard   = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
const formatExpiry = (v) => {
  const c = v.replace(/\D/g, "").slice(0, 4);
  return c.length >= 3 ? c.slice(0, 2) + "/" + c.slice(2) : c;
};
const maskCard = (num) => {
  const d = num.replace(/\s/g, "");
  return `•••• ${d.slice(-4)}`;
};
const detectNetwork = (num) => {
  const d = num.replace(/\s/g, "");
  if (/^4/.test(d)) return "Visa";
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return "Mastercard";
  if (/^(508[5-9]|6069|607|608|6521|6522)/.test(d)) return "RuPay";
  return "Card";
};

const INPUT =
  "mt-1 w-full px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/10 transition";

// ─────────────────────────────────────────────────────────────────────────────
export default function UpdatePaymentModal({ currentMethod, onSave, onClose }) {
  const [tab, setTab] = useState("card");
  const [step, setStep] = useState("form"); // "form" | "saving" | "success"

  // card
  const [name, setName]         = useState("");
  const [cardNum, setCardNum]   = useState("");
  const [expiry, setExpiry]     = useState("");
  const [cvv, setCvv]           = useState("");

  // upi
  const [upiId, setUpiId]       = useState("");
  const [upiVerified, setUpiVerified] = useState(null);

  // bank
  const [accName, setAccName]   = useState("");
  const [accNum, setAccNum]     = useState("");
  const [ifsc, setIfsc]         = useState("");
  const [bankName, setBankName] = useState("");

  const [error, setError] = useState("");
  const [savedMethod, setSavedMethod] = useState("");

  // ── validation + submit ────────────────────────────────────────────────
  function handleSave() {
    setError("");
    let methodLabel = "";

    if (tab === "card") {
      if (!name.trim())                              return setError("Enter cardholder name.");
      if (cardNum.replace(/\s/g, "").length < 16)   return setError("Enter a valid 16-digit card number.");
      if (expiry.length < 5)                         return setError("Enter expiry in MM/YY format.");
      if (cvv.length < 3)                            return setError("Enter a valid CVV.");
      const network = detectNetwork(cardNum);
      methodLabel = `${network} ${maskCard(cardNum)}`;
    } else if (tab === "upi") {
      if (!upiId.trim())   return setError("Enter your UPI ID.");
      if (!upiVerified)    return setError("Please verify the UPI ID first.");
      methodLabel = `UPI – ${upiId.trim()}`;
    } else {
      if (!accName.trim())   return setError("Enter account holder name.");
      if (accNum.length < 8) return setError("Enter a valid account number.");
      if (ifsc.length < 11)  return setError("Enter a valid 11-character IFSC code.");
      if (!bankName.trim())  return setError("Enter bank name.");
      methodLabel = `${bankName} ••${accNum.slice(-4)}`;
    }

    setSavedMethod(methodLabel);
    setStep("saving");
    setTimeout(() => {
      setStep("success");
      onSave?.(methodLabel);
    }, 1800);
  }

  const handleVerifyUPI = () => {
    const ok = /^[\w.\-]+@[\w]+$/.test(upiId.trim());
    setUpiVerified(ok);
    setError(ok ? "" : "Invalid UPI ID format (e.g. name@okaxis, name@upi).");
  };

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
      >
        {/* ── header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F9]">
          <div>
            <h2 className="text-[15px] font-bold text-[#0F172A]">Update Payment Method</h2>
            {currentMethod && (
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Current: <span className="font-semibold text-[#475569]">{currentMethod}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── saving ── */}
        {step === "saving" && (
          <div className="flex flex-col items-center gap-4 py-16">
            <svg className="animate-spin w-10 h-10 text-[#2563EB]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="text-[13px] font-semibold text-[#0F172A]">Saving your payment method…</p>
            <p className="text-[11px] text-[#94A3B8]">Please wait</p>
          </div>
        )}

        {/* ── success ── */}
        {step === "success" && (
          <div className="flex flex-col items-center gap-4 py-12 px-6">
            <div className="w-14 h-14 rounded-full bg-[#ECFDF5] flex items-center justify-center">
              <svg className="w-7 h-7 text-[#059669]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-[15px] font-bold text-[#0F172A]">Payment method updated!</h3>
              <p className="text-[12px] text-[#64748B] mt-1">Your new method is now on file</p>
            </div>
            <div className="w-full px-4 py-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-center">
              <p className="text-[10px] text-[#94A3B8] uppercase tracking-wide mb-0.5">Active Payment Method</p>
              <p className="text-[13px] font-bold text-[#0F172A]">{savedMethod}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-[#1D4ED8] transition"
            >
              Done
            </button>
          </div>
        )}

        {/* ── form ── */}
        {step === "form" && (
          <>
            {/* tabs */}
            <div className="flex border-b border-[#F1F5F9] bg-[#F8FAFC]">
              {[
                { id: "card", label: "Card" },
                { id: "upi",  label: "UPI" },
                { id: "bank", label: "Bank Transfer" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setError(""); }}
                  className="flex-1 py-3 text-[12px] font-semibold transition"
                  style={{
                    borderBottom: tab === t.id ? "2px solid #2563EB" : "2px solid transparent",
                    color: tab === t.id ? "#2563EB" : "#94A3B8",
                    background: tab === t.id ? "white" : "transparent",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-[11px] text-red-600">{error}</p>
                </div>
              )}

              {/* ── CARD ── */}
              {tab === "card" && (
                <div className="space-y-3">
                  <Field label="Cardholder Name">
                    <input
                      type="text" value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name on card" className={INPUT}
                    />
                  </Field>
                  <Field label="Card Number">
                    <div className="relative">
                      <input
                        type="text" value={cardNum}
                        onChange={(e) => setCardNum(formatCard(e.target.value))}
                        placeholder="1234 5678 9012 3456" maxLength={19}
                        className={INPUT + " font-mono pr-16"}
                      />
                      {cardNum.replace(/\s/g,"").length >= 1 && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#94A3B8]">
                          {detectNetwork(cardNum)}
                        </span>
                      )}
                    </div>
                  </Field>
                  <div className="flex gap-3">
                    <Field label="Expiry" className="flex-1">
                      <input
                        type="text" value={expiry}
                        onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                        placeholder="MM/YY" maxLength={5} className={INPUT + " font-mono"}
                      />
                    </Field>
                    <Field label="CVV" className="flex-1">
                      <input
                        type="password" value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                        placeholder="•••" maxLength={3} className={INPUT + " font-mono"}
                      />
                    </Field>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {["VISA", "MC", "RuPay", "Amex"].map((c) => (
                      <span key={c} className="px-2 py-0.5 rounded border border-[#E2E8F0] text-[9px] font-bold text-[#94A3B8]">{c}</span>
                    ))}
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-[#94A3B8]">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      256-bit SSL
                    </span>
                  </div>
                </div>
              )}

              {/* ── UPI ── */}
              {tab === "upi" && (
                <div className="space-y-3">
                  <p className="text-[12px] text-[#64748B]">
                    Enter the UPI ID you want to use for future renewals.
                  </p>
                  <Field label="UPI ID">
                    <div className="flex gap-2">
                      <input
                        type="text" value={upiId}
                        onChange={(e) => { setUpiId(e.target.value); setUpiVerified(null); }}
                        placeholder="yourname@okaxis" className={INPUT}
                      />
                      <button
                        onClick={handleVerifyUPI}
                        className="px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[12px] font-semibold text-[#2563EB] hover:bg-[#EFF6FF] transition whitespace-nowrap"
                      >
                        Verify
                      </button>
                    </div>
                  </Field>
                  {upiVerified === true && (
                    <div className="flex items-center gap-2 text-[#059669] text-[11px] font-semibold">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      UPI ID verified successfully
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    {[
                      { label: "GPay",  bg: "#00B9F1" },
                      { label: "PhPe",  bg: "#5F259F" },
                      { label: "Paytm", bg: "#002970" },
                      { label: "BHIM",  bg: "#EF7F1A" },
                    ].map((a) => (
                      <div key={a.label} className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[8px] font-bold text-white" style={{ background: a.bg }}>
                          {a.label}
                        </div>
                        <span className="text-[8px] text-[#94A3B8]">{a.label}</span>
                      </div>
                    ))}
                    <span className="text-[10px] text-[#94A3B8] ml-1">& more</span>
                  </div>
                </div>
              )}

              {/* ── BANK ── */}
              {tab === "bank" && (
                <div className="space-y-3">
                  <div className="px-3 py-2.5 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE]">
                    <p className="text-[11px] text-[#2563EB] font-semibold">NEFT / IMPS / RTGS</p>
                    <p className="text-[10px] text-[#3B82F6] mt-0.5">
                      Add your bank account for auto-debit on renewal dates.
                    </p>
                  </div>
                  <Field label="Account Holder Name">
                    <input
                      type="text" value={accName}
                      onChange={(e) => setAccName(e.target.value)}
                      placeholder="As per bank records" className={INPUT}
                    />
                  </Field>
                  <Field label="Bank Name">
                    <input
                      type="text" value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank" className={INPUT}
                    />
                  </Field>
                  <Field label="Account Number">
                    <input
                      type="text" value={accNum}
                      onChange={(e) => setAccNum(e.target.value.replace(/\D/g, "").slice(0, 18))}
                      placeholder="Enter account number" className={INPUT + " font-mono"}
                    />
                  </Field>
                  <Field label="IFSC Code">
                    <input
                      type="text" value={ifsc}
                      onChange={(e) => setIfsc(e.target.value.toUpperCase().slice(0, 11))}
                      placeholder="e.g. HDFC0001234" className={INPUT + " font-mono uppercase"}
                    />
                  </Field>
                </div>
              )}

              {/* ── actions ── */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 py-2.5 rounded-xl bg-[#2563EB] text-white text-[13px] font-semibold hover:bg-[#1D4ED8] transition"
                >
                  Save Method
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── tiny layout helper ────────────────────────────────────────────────────────
function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest">
        {label}
      </label>
      {children}
    </div>
  );
}