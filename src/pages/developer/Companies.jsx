import { useEffect, useState } from "react";
import api from "../../data/axiosConfig";

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", plan: "basic" });
  const [saForm, setSaForm] = useState({ name: "", email: "", password: "" });
  const [selectedCompany, setSelectedCompany] = useState(null);

  useEffect(() => {
    api.get("/api/developer/companies").then(r => setCompanies(r.data));
  }, []);

  const createCompany = async () => {
    const res = await api.post("/api/developer/companies", form);
    setCompanies(prev => [...prev, res.data]);
    setShowCreate(false);
    setForm({ name: "", email: "", phone: "", plan: "basic" });
  };

  const createSuperAdmin = async (companyId) => {
    await api.post(`/api/developer/companies/${companyId}/super-admin`, saForm);
    setSaForm({ name: "", email: "", password: "" });
    setSelectedCompany(null);
    alert("Super Admin created successfully");
  };

  const toggleStatus = async (id) => {
    await api.put(`/api/developer/companies/${id}/toggle`);
    setCompanies(prev =>
      prev.map(c => c._id === id ? { ...c, isActive: !c.isActive } : c)
    );
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Companies</h1>
        <button onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          + Create Company
        </button>
      </div>

      {/* Companies Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left">Company</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c._id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3 capitalize">{c.plan}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${c.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {c.isActive ? "Active" : "Suspended"}
                  </span>
                </td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => toggleStatus(c._id)}
                    className="text-xs border px-2 py-1 rounded hover:bg-gray-50">
                    {c.isActive ? "Suspend" : "Activate"}
                  </button>
                  <button onClick={() => setSelectedCompany(c._id)}
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">
                    + Super Admin
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
