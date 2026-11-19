// src/finance/FinanceHome.jsx — the Finance Panel's tabbed home: Invoices (existing) + Employees, Salary, Tools, Notes.
// Keeps the working FinanceDashboard (invoices) untouched and adds the new HR pages as sibling tabs.
import { useState } from "react";
import { Receipt, Users, Wallet, Wrench, StickyNote } from "lucide-react";
import FinanceDashboard from "../components/FinanceDashboard";
import EmployeesPage from "./EmployeesPage";
import SalaryPage from "./SalaryPage";
import ToolsPage from "./ToolsPage";
import NotesPage from "./NotesPage";
import financeApi from "./financeApi";

const TABS = [
  { key: "invoices", label: "Invoices", icon: Receipt },
  { key: "employees", label: "Employees", icon: Users },
  { key: "salary", label: "Salary slips", icon: Wallet },
  { key: "tools", label: "Tools & Services", icon: Wrench },
  { key: "notes", label: "Notes", icon: StickyNote },
];

export default function FinanceHome() {
  const [tab, setTab] = useState("invoices");
  const [salaryPrefill, setSalaryPrefill] = useState(null);   // employee → open salary form
  const goSalaryFor = (emp) => { setSalaryPrefill(emp); setTab("salary"); };

  return (
    <div>
      <nav className="mb-4 flex flex-wrap gap-1.5 border-b border-slate-200 pb-2 dark:border-[#1F2533]">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${tab === key ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1A2030]"}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </nav>

      {tab === "invoices" && <FinanceDashboard embedded basePath="" client={financeApi} />}
      {tab === "employees" && <EmployeesPage onGenerateSalary={goSalaryFor} />}
      {tab === "salary" && <SalaryPage prefillEmployee={salaryPrefill} clearPrefill={() => setSalaryPrefill(null)} />}
      {tab === "tools" && <ToolsPage />}
      {tab === "notes" && <NotesPage />}
    </div>
  );
}
