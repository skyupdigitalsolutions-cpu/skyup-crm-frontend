import { createContext, useContext, useEffect, useState } from "react";
import api from "../data/axiosConfig";

const ThemeContext = createContext();

const DEFAULT_BRANDING = {
  companyName:         "SkyUp CRM",
  logo:                "/skyup_logo1.svg",
  favicon:             "/favicon.svg",
  primaryColor:        "#2563EB",
  secondaryColor:      "#1E40AF",
  stickyHeaderEnabled: true,
};

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(
    () => localStorage.getItem("theme") === "dark"
  );

  const [branding, setBranding] = useState(() => {
    // Rehydrate persisted branding so the UI never flashes defaults on refresh
    try {
      return JSON.parse(localStorage.getItem("company_branding") || "null") || DEFAULT_BRANDING;
    } catch {
      return DEFAULT_BRANDING;
    }
  });

  // ── Apply dark/light class ─────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  // ── Apply CSS custom properties whenever branding changes ─────────────────
  useEffect(() => {
    document.documentElement.style.setProperty("--primary",   branding.primaryColor);
    document.documentElement.style.setProperty("--secondary", branding.secondaryColor);

    const favicon = document.querySelector("link[rel='icon']");
    if (favicon) favicon.href = branding.favicon || "/favicon.svg";
  }, [branding]);

  // ── Fetch branding from API for a given companyId ─────────────────────────
  const loadBranding = async (companyId) => {
    if (!companyId) return;
    try {
      const res = await api.get(`/api/company/${companyId}/branding`);
      const data = { ...DEFAULT_BRANDING, ...res.data };
      setBranding(data);
      localStorage.setItem("company_branding", JSON.stringify(data));
    } catch (e) {
      console.warn("Branding load failed, using defaults");
    }
  };

  // ── Reset to defaults (e.g. on logout) ────────────────────────────────────
  const resetBranding = () => {
    setBranding(DEFAULT_BRANDING);
    localStorage.removeItem("company_branding");
  };

  const toggle = () => setDark((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ dark, toggle, branding, loadBranding, resetBranding }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
