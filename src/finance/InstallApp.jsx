// src/finance/InstallApp.jsx — NEW FILE
// "Install app" button for the Finance Panel PWA. Renders nothing when the app is
// already installed or the browser can't install it.
//   Chrome / Edge / Android → opens the browser's install dialog
//   iPhone / iPad          → shows how to add it from the Share menu
import { useState } from "react";
import { Download, Share } from "lucide-react";

const STYLES = {
  login: "border border-white/15 bg-white/10 text-emerald-100 hover:bg-white/20",
  header: "border border-slate-200 text-slate-600 hover:text-slate-900 dark:border-[#1F2533] dark:text-slate-300 dark:hover:text-white",
};

export default function InstallApp({ pwa, variant = "header" }) {
  const [hint, setHint] = useState(false);
  if (pwa.installed || (!pwa.canInstall && !pwa.iosHint)) return null;

  const onClick = () => { if (pwa.canInstall) pwa.install(); else setHint((h) => !h); };
  return (
    <span className="relative inline-block">
      <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition ${STYLES[variant]}`}>
        <Download className="h-3.5 w-3.5" />Install app
      </button>
      {hint && (
        <span role="note" className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-3 text-left text-[12px] leading-snug text-slate-700 shadow-lg dark:border-[#1F2533] dark:bg-[#0F131B] dark:text-slate-200">
          To install on iPhone or iPad, tap <Share className="mx-0.5 inline h-3.5 w-3.5" /> <b>Share</b>, then <b>Add to Home Screen</b>.
        </span>
      )}
    </span>
  );
}
