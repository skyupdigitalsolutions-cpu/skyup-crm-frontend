// src/finance/hrApi.js — Finance Dashboard HR features (Employees, Salary, Tools, Notes).
// Uses the shared finance axios client, so it inherits the finance login and the /api/finance-panel base.
// The backend mounts these under /hr (see routes/financeHrRoutes.js).
import financeApi from "./financeApi";

const unwrap = (p) => p.then((r) => r.data);

// Employees
export const listEmployees   = () => unwrap(financeApi.get("/hr/employees"));
export const getEmployee     = (id) => unwrap(financeApi.get(`/hr/employees/${id}`));
export const createEmployee  = (body) => unwrap(financeApi.post("/hr/employees", body));
export const updateEmployee  = (id, body) => unwrap(financeApi.put(`/hr/employees/${id}`, body));
export const deleteEmployee  = (id) => unwrap(financeApi.delete(`/hr/employees/${id}`));

// Salary slips
export const listSalary      = (params) => unwrap(financeApi.get("/hr/salary", { params }));
export const getSalary       = (id) => unwrap(financeApi.get(`/hr/salary/${id}`));
export const createSalary    = (body) => unwrap(financeApi.post("/hr/salary", body));
export const updateSalary    = (id, body) => unwrap(financeApi.put(`/hr/salary/${id}`, body));
export const markSalaryEmailed = (id) => unwrap(financeApi.post(`/hr/salary/${id}/emailed`));

// Tools & Services
export const listTools       = () => unwrap(financeApi.get("/hr/tools"));
export const createTool      = (body) => unwrap(financeApi.post("/hr/tools", body));
export const updateTool      = (id, body) => unwrap(financeApi.put(`/hr/tools/${id}`, body));
export const deleteTool      = (id) => unwrap(financeApi.delete(`/hr/tools/${id}`));

// Notes
export const listNotes       = () => unwrap(financeApi.get("/hr/notes"));
export const createNote      = (body) => unwrap(financeApi.post("/hr/notes", body));
export const updateNote      = (id, body) => unwrap(financeApi.put(`/hr/notes/${id}`, body));
export const deleteNote      = (id) => unwrap(financeApi.delete(`/hr/notes/${id}`));

// Payment vouchers
export const listVouchers   = (params) => unwrap(financeApi.get("/hr/vouchers", { params }));
export const getVoucher     = (id) => unwrap(financeApi.get(`/hr/vouchers/${id}`));
export const createVoucher  = (body) => unwrap(financeApi.post("/hr/vouchers", body));
export const updateVoucher  = (id, body) => unwrap(financeApi.put(`/hr/vouchers/${id}`, body));
export const cancelVoucher  = (id, reason) => unwrap(financeApi.post(`/hr/vouchers/${id}/cancel`, { reason }));
// Company header (name, logo, address, GSTIN) — same "from" block as invoices
export const getCompanyDetails = () => unwrap(financeApi.get("/settings")).then((d) => d.preview || {});

// Credentials vault (secrets are encrypted server-side; reveal is logged)
export const listCredentials  = (params) => unwrap(financeApi.get("/hr/credentials", { params }));
export const createCredential = (body) => unwrap(financeApi.post("/hr/credentials", body));
export const updateCredential = (id, body) => unwrap(financeApi.put(`/hr/credentials/${id}`, body));
export const deleteCredential = (id) => unwrap(financeApi.delete(`/hr/credentials/${id}`));
export const revealCredential = (id, field) => unwrap(financeApi.post(`/hr/credentials/${id}/reveal`, { field }));
export const credentialLog    = (id) => unwrap(financeApi.get(`/hr/credentials/${id}/log`));
