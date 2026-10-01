// src/components/RecordingAudio.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One player for every call recording in the CRM. Playback always works;
// the Download button (and the browser's own download menu) only appear when
// the company allows it for this role — Customize CRM → Permissions →
// "Call recordings" (developer panel). Relative /recordings/... URLs are
// resolved against the backend.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { getUser } from "../data/sessionStore";
import { canDownloadRecordings } from "../data/customizationStore";
import useCustomization from "../hooks/useCustomization";
import useTeamInfo from "../hooks/useTeamInfo";

const BACKEND_ROOT = String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
function resolveRecordingUrl(u) {
  if (!u) return null;
  if (/^(https?:|blob:|data:)/.test(u)) return u;
  return `${BACKEND_ROOT}${u.startsWith("/") ? "" : "/"}${u}`;
}

function fileNameFrom(url, fallback) {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    if (last && /\.[a-z0-9]{2,4}$/i.test(last)) return last;
  } catch { /* ignore */ }
  return fallback || "call-recording.mp3";
}

export default function RecordingAudio({ src, className = "w-full h-8 rounded-xl", fileName, hideOnError = true, ...rest }) {
  const { c } = useCustomization();
  const team = useTeamInfo();
  const [broken, setBroken] = useState(false);
  const [saving, setSaving] = useState(false);
  const url = resolveRecordingUrl(src);
  const allow = canDownloadRecordings(getUser()?.role, team.isTeamLead, c);
  if (!url || (broken && hideOnError)) return null;

  const download = async () => {
    setSaving(true);
    try {
      const res = await fetch(url, { credentials: "omit" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileNameFrom(url, fileName);
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    } catch {
      window.open(url, "_blank", "noopener"); // cross-origin fallback
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 min-w-0">
      <audio
        controls
        preload="none"
        src={url}
        controlsList={allow ? "noplaybackrate" : "nodownload noplaybackrate"}
        onContextMenu={allow ? undefined : (e) => e.preventDefault()}
        onError={() => setBroken(true)}
        className={`${className} accent-[#2563EB]`}
        {...rest}
      />
      {allow && (
        <button
          type="button"
          onClick={download}
          disabled={saving}
          title="Download recording"
          className="shrink-0 w-8 h-8 rounded-lg border border-[#E4E7EF] dark:border-[#262A38] flex items-center justify-center text-[#4B5168] dark:text-[#9DA3BB] hover:text-[#2563EB] hover:border-[#2563EB] transition disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${saving ? "animate-pulse" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
          </svg>
        </button>
      )}
    </div>
  );
}
