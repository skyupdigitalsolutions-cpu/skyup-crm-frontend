import api from "../data/axiosConfig";

// ── Admin: fetch report with filters ─────────────────────────────────────────
export const fetchAttendanceReport = (params = {}) =>
  api.get("/attendance/report", { params }).then(r => r.data);

// ── Admin: fetch company users for filter dropdown ────────────────────────────
export const fetchAttendanceUsers = () =>
  api.get("/attendance/users").then(r => r.data);

// ── Admin: edit a record ──────────────────────────────────────────────────────
export const updateAttendance = (id, payload) =>
  api.put(`/attendance/${id}`, payload).then(r => r.data);

// ── Admin: delete a record ────────────────────────────────────────────────────
export const removeAttendance = (id) =>
  api.delete(`/attendance/${id}`).then(r => r.data);

// ── Admin: export data ────────────────────────────────────────────────────────
export const fetchAttendanceExport = (params = {}) =>
  api.get("/attendance/export", { params }).then(r => r.data);

// ── User: clock in / out / break ─────────────────────────────────────────────
export const clockIn    = ()              => api.post("/attendance/clock-in").then(r => r.data);
export const clockOut   = ()              => api.post("/attendance/clock-out").then(r => r.data);
export const startBreak = (reason)       => api.post("/attendance/break/start", { reason }).then(r => r.data);
export const endBreak   = ()              => api.post("/attendance/break/end").then(r => r.data);
export const pingActivity = ()            => api.post("/attendance/ping").then(r => r.data);
export const getMyToday   = ()            => api.get("/attendance/my-today").then(r => r.data);