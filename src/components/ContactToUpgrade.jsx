// src/components/ContactToUpgrade.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Shown when "Upgrade Plan" is clicked (/upgrade-plan): asks the user to
// contact their administrator or SkyUp Digital Solutions.
// Optional contact buttons come from the build env:
//   VITE_SUPPORT_EMAIL, VITE_SUPPORT_PHONE, VITE_SUPPORT_WHATSAPP (digits, e.g. 919876543210)
// ─────────────────────────────────────────────────────────────────────────────
import { useNavigate } from "react-router-dom";

const EMAIL    = import.meta.env.VITE_SUPPORT_EMAIL || "";
const PHONE    = import.meta.env.VITE_SUPPORT_PHONE || "";
const WHATSAPP = String(import.meta.env.VITE_SUPPORT_WHATSAPP || "").replace(/\D/g, "");

export default function ContactToUpgrade() {
  const navigate = useNavigate();
  const hasContact = !!(EMAIL || PHONE || WHATSAPP);

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-md bg-white dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] rounded-3xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB] dark:text-[#4F8EF7] flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>

        <h1 className="text-[20px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-2">Upgrade your plan</h1>
        <p className="text-[13px] text-[#6B7280] dark:text-[#9DA3BB] mb-6">
          To upgrade your plan, please contact your administrator or
          <span className="font-semibold text-[#0F1117] dark:text-[#DDE1F5]"> SkyUp Digital Solutions</span>.
        </p>

        {hasContact ? (
          <div className="space-y-2.5 mb-6">
            {WHATSAPP && (
              <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer"
                 className="block w-full py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-[13px] font-semibold">
                Chat on WhatsApp
              </a>
            )}
            {PHONE && (
              <a href={`tel:${PHONE}`}
                 className="block w-full py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[13px] font-semibold">
                Call {PHONE}
              </a>
            )}
            {EMAIL && (
              <a href={`mailto:${EMAIL}?subject=${encodeURIComponent("Account upgrade request")}`}
                 className="block w-full py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[13px] font-semibold text-[#2563EB] dark:text-[#4F8EF7] hover:bg-[#F8F9FC] dark:hover:bg-white/5">
                Email {EMAIL}
              </a>
            )}
          </div>
        ) : (
          <div className="mb-6" />
        )}

        <button onClick={() => navigate("/dashboard")}
                className="text-[12px] font-semibold text-[#8B92A9] hover:text-[#2563EB]">
          ← Back to dashboard
        </button>
      </div>
    </div>
  );
}
