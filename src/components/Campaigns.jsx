import { useState, useEffect, useCallback, useRef } from "react";
import api from "../data/axiosConfig";
import VoiceBotPanel from "./VoiceBotPanel";
import { io as socketIO } from "socket.io-client";

// ── Channel / status style maps ───────────────────────────────────────────────
const CHANNEL_STYLE = {
  SMS: { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#2563EB] dark:text-[#4F8EF7]" },
  WhatsApp: { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]", text: "text-[#059669] dark:text-[#34D399]" },
  Email: { bg: "bg-[#F5F3FF] dark:bg-[#1E1040]", text: "text-[#7C3AED] dark:text-[#A78BFA]" },
  Meta: { bg: "bg-[#FFF0F3] dark:bg-[#2D0A14]", text: "text-[#E1306C] dark:text-[#F77FAD]" },
  Google: { bg: "bg-[#FFF8F0] dark:bg-[#2D1A00]", text: "text-[#EA4335] dark:text-[#FF6B5B]" },
  Website: { bg: "bg-[#F0FDF4] dark:bg-[#052E1C]", text: "text-[#16A34A] dark:text-[#4ADE80]" },
};

const STATUS_STYLE = {
  Active: { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]", text: "text-[#059669] dark:text-[#34D399]", dot: "#059669" },
  Completed: { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#2563EB] dark:text-[#4F8EF7]", dot: "#2563EB" },
  Paused: { bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]", text: "text-[#D97706] dark:text-[#FCD34D]", dot: "#D97706" },
  Draft: { bg: "bg-[#F1F5F9] dark:bg-[#1A1D27]", text: "text-[#8B92A9] dark:text-[#565C75]", dot: "#8B92A9" },
};

const LEAD_STATUS_STYLE = {
  Converted: { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]", text: "text-[#059669] dark:text-[#34D399]" },
  "In Progress": { bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]", text: "text-[#D97706] dark:text-[#FCD34D]" },
  "Not Interested": { bg: "bg-[#FEF2F2] dark:bg-[#2D0A0A]", text: "text-[#DC2626] dark:text-[#F87171]" },
  New: { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#2563EB] dark:text-[#4F8EF7]" },
};

const LEAD_TEMP_STYLE = {
  Hot: { bg: "bg-[#FEF2F2] dark:bg-[#2D0A0A]", text: "text-[#DC2626] dark:text-[#F87171]", icon: "" },
  Warm: { bg: "bg-[#FFFBEB] dark:bg-[#2D1F00]", text: "text-[#D97706] dark:text-[#FCD34D]", icon: "" },
  Cold: { bg: "bg-[#EEF3FF] dark:bg-[#1A2540]", text: "text-[#2563EB] dark:text-[#4F8EF7]", icon: "" },
};

const META_COLORS = ["#E1306C", "#2563EB", "#7C3AED", "#059669", "#D97706", "#0891B2"];
const GOOGLE_COLORS = ["#EA4335", "#FBBC05", "#34A853", "#4285F4", "#FF6D00", "#46BDC6"];
const WEBSITE_COLORS = ["#16A34A", "#0891B2", "#7C3AED", "#D97706", "#059669", "#2563EB"];

const FIELD_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => (n != null && n > 0 ? Number(n).toLocaleString() : "—");
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

// ── Eye icons ─────────────────────────────────────────────────────────────────
const EyeOn = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24
