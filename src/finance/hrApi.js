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
