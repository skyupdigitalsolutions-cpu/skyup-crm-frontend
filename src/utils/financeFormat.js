// src/utils/financeFormat.js — NEW FILE
// Small formatting helpers shared by the Finance Dashboard screens.
// Dates are shown / entered in India time (IST) to match the backend.

export const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—");
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "");
// <input type="date"> value (YYYY-MM-DD) in IST
export const toInputDay = (d) => (d ? new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "");
export const todayInput = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
export const errMsg = (e, fallback = "Something went wrong") => e?.response?.data?.message || fallback;

