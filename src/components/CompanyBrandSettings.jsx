// src/components/CompanyBrandSettings.jsx
// ─────────────────────────────────────────────────────────────────────────────
// SuperAdmin panel: set company name + logo that appear in the Sidebar navbar
// across ALL interfaces.
//
// Backend expected:
//   GET  /admin/company/brand         → { name, logoUrl }
//   PUT  /admin/company/brand         → body: FormData (name, logo file)
//   DELETE /admin/company/brand/logo  → removes the logo
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from "react";
import api from "../data/axiosConfig";

const FIELD_CLS =
  "w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA] placeholder:text-[#8B92A9] focus:outline-none focus:border-[#2563EB] transition";

export default function CompanyBrandSettings() {
  const [brand,      setBrand]      = useState({ name: "", logoUrl: "" });
  const [nameInput,  setNameInput]  = useState("");
  const [preview,    setPreview]    = useState(null);
  const [file,       setFile]       = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [error,      setError]      = useState("");
  const fileRef = useRef();

  useEffect(() => {
    api.get("/admin/company/brand")
      .then((res) => {
        setBrand(res.data || {});
        setNameInput(res.data?.name || "");
      })
      .catch(() => {});
  }, []);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setError("Please upload an image file (PNG, JPG, SVG)"); return; }
    if (f.size > 2 * 1024 * 1024) { setError("Logo must be under 2 MB"); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const form = new FormData();
      form.append("name", nameInput.trim());
      if (file) form.append("logo", file);
      // Do NOT set Content-Type manually — axios must auto-generate it with the
      // correct multipart boundary. Setting it manually drops the boundary and
      // the server cannot parse the uploaded file.
      const res = await api.put("/admin/company/brand", form);
      // Stamp a timestamp so the header img cache-busts on every save
      const brandWithTs = { ...res.data, _ts: Date.now() };
      setBrand(brandWithTs);
      localStorage.setItem("company_brand", JSON.stringify(brandWithTs));
      // Notify header bar to re-render with new logo
      window.dispatchEvent(new Event("company_brand_updated"));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to save branding");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!window.confirm("Remove the company logo?")) return;
    try {
      await api.delete("/admin/company/brand/logo");
      const updatedBrand = { ...brand, logoUrl: "", _ts: Date.now() };
      setBrand(updatedBrand);
      setPreview(null);
      setFile(null);
      localStorage.setItem("company_brand", JSON.stringify(updatedBrand));
      window.dispatchEvent(new Event("company_brand_updated"));
    } catch {
      setError("Failed to remove logo");
    }
  };

  const currentLogo = preview || brand.logoUrl;

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-6 max-w-lg">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
          <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Company Branding</h3>
          <p className="text-[11px] text-[#8B92A9] mt-0.5">Logo and name shown in the navbar across all interfaces</p>
        </div>
      </div>

      {/* Company Name */}
      <div className="mb-4">
        <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
          Company Name
        </label>
        <input
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="e.g. Acme Corp"
          className={FIELD_CLS}
          maxLength={40}
        />
        <p className="text-[10px] text-[#8B92A9] mt-1">Displayed next to the logo in the sidebar header</p>
      </div>

      {/* Logo Upload */}
      <div className="mb-5">
        <label className="block text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] mb-1.5">
          Company Logo
        </label>
        <div className="flex items-center gap-4">
          {currentLogo ? (
            <div className="relative">
              <img src={currentLogo} alt="logo preview" className="h-14 w-auto max-w-[120px] object-contain rounded-lg border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#13161E] p-1" />
              <button
                onClick={handleRemoveLogo}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition"
                title="Remove logo"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          ) : (
            <div className="h-14 w-14 rounded-lg border-2 border-dashed border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#8B92A9]">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </div>
          )}
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] hover:text-[#2563EB] transition"
            >
              {currentLogo ? "Change Logo" : "Upload Logo"}
            </button>
            <p className="text-[10px] text-[#8B92A9] mt-1">PNG, JPG or SVG · max 2 MB</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-[12px] text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-[12px] text-emerald-600 dark:text-emerald-400">
          ✓ Branding saved! The sidebar will update immediately.
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-60 text-white text-[13px] font-semibold transition flex items-center justify-center gap-2"
      >
        {saving && <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>}
        {saving ? "Saving…" : "Save Branding"}
      </button>
    </div>
  );
}
