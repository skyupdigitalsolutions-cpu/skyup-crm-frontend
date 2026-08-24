// components/WhatsAppScreenshotUploader.jsx
// ─────────────────────────────────────────────────────────────────────────────
// localStorage persistence: extracted result is saved to localStorage keyed by
// leadId. On mount it restores the previous extract so a page refresh doesn't
// lose the data. Cleared automatically on import success or explicit reset.
//
// Storage key: "wa_screenshot_extract_<leadId>"
// Stored: { result, previewDataUrl, step }  — imageFile is NOT stored (binary)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, X, Loader2, Check, AlertTriangle, Image as ImageIcon,
  MessageSquare, ChevronDown, ChevronUp, Sparkles,
  Download, RefreshCw, Eye, EyeOff,
} from "lucide-react";
import api from "../data/axiosConfig";

// ── localStorage helpers ───────────────────────────────────────────────────────
const LS_PREFIX = "wa_screenshot_extract_";

function lsSave(leadId, data) {
  if (!leadId) return;
  try {
    localStorage.setItem(LS_PREFIX + leadId, JSON.stringify(data));
  } catch (e) {
    // storage full or private mode — fail silently
    console.warn("[ScreenshotUploader] localStorage save failed:", e.message);
  }
}

function lsLoad(leadId) {
  if (!leadId) return null;
  try {
    const raw = localStorage.getItem(LS_PREFIX + leadId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsClear(leadId) {
  if (!leadId) return;
  try {
    localStorage.removeItem(LS_PREFIX + leadId);
  } catch { /* ignore */ }
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  label: "text-[11px] font-bold text-[#8B92A9] uppercase tracking-widest",
};

const SENTIMENT = {
  POSITIVE: { bg: "bg-[#ECFDF5] dark:bg-[#052E1C]", text: "text-[#065F46] dark:text-[#34D399]", label: "Positive" },
  NEGATIVE: { bg: "bg-[#FEF2F2] dark:bg-[#2D0A0A]", text: "text-[#991B1B] dark:text-[#F87171]", label: "Negative" },
  NEUTRAL:  { bg: "bg-[#F8F9FC] dark:bg-[#13161E]",  text: "text-[#8B92A9]",                    label: "Neutral"  },
};

// ── Extracted message bubble ──────────────────────────────────────────────────
function ExtractedBubble({ msg }) {
  const isOut = msg.direction === "outbound";
  return (
    <div className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[72%] px-3 py-2 rounded-2xl shadow-sm text-[13px] ${
        isOut
          ? "bg-[#dcfce7] dark:bg-[#064e3b] text-[#111827] dark:text-[#d1fae5] rounded-br-sm"
          : "bg-white dark:bg-[#1E2133] text-[#111827] dark:text-[#F0F2FA] border border-[#E4E7EF] dark:border-[#262A38] rounded-bl-sm"
      }`}>
        <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.text || "[media]"}</p>
        <div className="flex items-center justify-end gap-1 mt-1">
          {msg.date && <span className="text-[10px] text-[#6b7280] mr-1">{msg.date}</span>}
          {msg.time && <span className="text-[10px] text-[#6b7280]">{msg.time}</span>}
          {isOut && (
            <span className={`text-[10px] ${msg.isRead ? "text-[#2563eb]" : "text-[#9ca3af]"}`}>
              {msg.isRead ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Drop zone ─────────────────────────────────────────────────────────────────
function DropZone({ onFile, disabled }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition cursor-pointer ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${
        dragging
          ? "border-[#2563EB] bg-[#EEF3FF] dark:bg-[#1A2540]"
          : "border-[#C4C9DA] dark:border-[#262A38] hover:border-[#2563EB] dark:hover:border-[#2563EB] hover:bg-[#F8FAFF] dark:hover:bg-[#13161E]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); }}
        disabled={disabled}
      />
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-2xl bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center">
          <ImageIcon size={22} className="text-[#2563EB]" />
        </div>
        <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
          Drop a WhatsApp screenshot here
        </p>
        <p className="text-[12px] text-[#8B92A9]">
          or click to browse · PNG, JPG, WEBP · max 10 MB
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function WhatsAppScreenshotUploader({
  leadId,
  leadName,
  onImported,
  onClose,
  mode = "panel",
}) {
  const [file,     setFile]     = useState(null);
  const [preview,  setPreview]  = useState(null);  // data URL (stored in LS)
  const [step,     setStep]     = useState("idle"); // idle | extracting | review | importing | done | error
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);
  const [imported, setImported] = useState(null);
  const [showAll,  setShowAll]  = useState(false);
  const [showImg,  setShowImg]  = useState(false);

  // ── Restore from localStorage on mount ───────────────────────────────────────
  useEffect(() => {
    const saved = lsLoad(leadId);
    if (saved?.result && saved?.step === "review") {
      setResult(saved.result);
      setPreview(saved.previewDataUrl || null);
      setStep("review");
    }
  }, [leadId]);

  // ── Persist to localStorage whenever result changes ───────────────────────────
  useEffect(() => {
    if (result && step === "review") {
      lsSave(leadId, {
        result,
        previewDataUrl: preview,
        step: "review",
        savedAt: Date.now(),
      });
    }
  }, [result, step, preview, leadId]);

  // ── Convert File to data URL so it can be stored ─────────────────────────────
  const fileToDataUrl = (f) =>
    new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload  = () => res(reader.result);
      reader.onerror = rej;
      reader.readAsDataURL(f);
    });

  // ── Reset + clear localStorage ────────────────────────────────────────────────
  const reset = useCallback(() => {
    lsClear(leadId);
    setFile(null);
    setPreview(null);
    setStep("idle");
    setResult(null);
    setError(null);
    setImported(null);
    setShowAll(false);
    setShowImg(false);
  }, [leadId]);

  // ── Handle file selection ─────────────────────────────────────────────────────
  const handleFile = useCallback(async (f) => {
    setFile(f);
    setStep("extracting");
    setError(null);
    setResult(null);

    // Convert to data URL immediately so we can store it
    let dataUrl = null;
    try {
      dataUrl = await fileToDataUrl(f);
      setPreview(dataUrl);
    } catch { /* preview optional */ }

    try {
      const form = new FormData();
      form.append("screenshot", f);

      const res = await api.post("/whatsapp/screenshot/extract", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!res.data.success) throw new Error(res.data.message || "Extraction failed");

      setResult(res.data);
      setStep("review");
      // localStorage saved via the useEffect above
    } catch (err) {
      lsClear(leadId); // don't save error state
      setError(err.response?.data?.message || err.message || "Extraction failed");
      setStep("error");
    }
  }, [leadId]);

  // ── Import into conversation ───────────────────────────────────────────────────
  const handleImport = async () => {
    if (!leadId || !file) {
      // file is null after page refresh — re-upload needed
      setError("Please re-upload the screenshot to import (file not stored locally for privacy).");
      return;
    }

    setStep("importing");
    setError(null);

    try {
      const form = new FormData();
      form.append("screenshot", file);
      form.append("leadId", leadId);

      const res = await api.post("/whatsapp/screenshot/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (!res.data.success) throw new Error(res.data.message || "Import failed");

      lsClear(leadId); // clear after successful import
      setImported(res.data.imported);
      setStep("done");

      if (onImported) {
        onImported({
          imported:       res.data.imported,
          conversationId: res.data.conversationId,
          summary:        res.data.summary,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Import failed");
      setStep("review"); // back to review, not error — data still usable
    }
  };

  const visibleMessages = result?.messages
    ? showAll ? result.messages : result.messages.slice(0, 6)
    : [];
  const hiddenCount = (result?.messages?.length || 0) - 6;
  const sentiment = SENTIMENT[result?.customerSentiment] || SENTIMENT.NEUTRAL;

  // ── Whether we're showing restored (no file object) state ─────────────────────
  const isRestored = step === "review" && !file;

  // ── Content ──────────────────────────────────────────────────────────────────
  const content = (
    <div className="flex flex-col gap-4">

      {/* Restored banner */}
      {isRestored && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FFFBEB] dark:bg-[#2D1F00] border border-[#FCD34D]/40 text-[12px] text-[#92400E] dark:text-[#FCD34D]">
          <span className="text-base">💾</span>
          <span>
            Restored from last session.
            <button onClick={reset} className="ml-1.5 underline font-semibold hover:no-underline">Clear</button>
            {" or re-upload screenshot to enable import."}
          </span>
        </div>
      )}

      {/* Drop zone */}
      {step === "idle" && (
        <DropZone onFile={handleFile} disabled={false} />
      )}

      {/* Extracting */}
      {step === "extracting" && (
        <div className="flex flex-col items-center gap-3 py-10">
          <div className="w-12 h-12 rounded-2xl bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center">
            <Loader2 size={22} className="text-[#2563EB] animate-spin" />
          </div>
          <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
            Reading screenshot with AI…
          </p>
          <p className="text-[12px] text-[#8B92A9]">Extracting messages, sentiment, and context</p>
          {preview && (
            <img src={preview} alt="Screenshot" className="w-32 rounded-xl opacity-40 border border-[#E4E7EF]" />
          )}
        </div>
      )}

      {/* Error */}
      {step === "error" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="w-12 h-12 rounded-2xl bg-[#FEF2F2] flex items-center justify-center">
            <AlertTriangle size={20} className="text-[#DC2626]" />
          </div>
          <p className="text-[13px] font-semibold text-[#DC2626] text-center px-4">{error}</p>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] transition"
          >
            <RefreshCw size={12} /> Try again
          </button>
        </div>
      )}

      {/* Done */}
      {step === "done" && (
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="w-12 h-12 rounded-2xl bg-[#ECFDF5] flex items-center justify-center">
            <Check size={22} className="text-[#059669]" />
          </div>
          <p className="text-[14px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">
            {imported} message{imported !== 1 ? "s" : ""} imported
          </p>
          <p className="text-[12px] text-[#8B92A9]">
            Visible in the WhatsApp chat for{" "}
            <span className="font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{leadName}</span>
          </p>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] transition"
          >
            <Upload size={12} /> Upload another
          </button>
        </div>
      )}

      {/* Review */}
      {(step === "review" || step === "importing") && result && (
        <>
          {/* AI summary */}
          <div className="rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-2">
              <Sparkles size={13} className="text-[#7C3AED]" />
              <span className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">AI Extract Summary</span>
              {preview && (
                <button
                  onClick={() => setShowImg(v => !v)}
                  className="ml-auto flex items-center gap-1 text-[11px] text-[#8B92A9] hover:text-[#2563EB] transition"
                >
                  {showImg ? <EyeOff size={11} /> : <Eye size={11} />}
                  {showImg ? "Hide" : "View"} screenshot
                </button>
              )}
            </div>

            {showImg && preview && (
              <div className="p-3 border-b border-[#E4E7EF] dark:border-[#262A38] bg-[#F8F9FC] dark:bg-[#13161E]">
                <img src={preview} alt="Screenshot" className="max-h-48 mx-auto rounded-xl border border-[#E4E7EF] shadow" />
              </div>
            )}

            <div className="p-4 grid grid-cols-2 gap-3">
              {result.contactName && (
                <div>
                  <p className={T.label}>Contact</p>
                  <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{result.contactName}</p>
                </div>
              )}
              {result.phoneNumber && (
                <div>
                  <p className={T.label}>Phone</p>
                  <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA]">{result.phoneNumber}</p>
                </div>
              )}
              <div>
                <p className={T.label}>Messages found</p>
                <p className="text-[22px] font-bold text-[#2563EB]">{result.messageCount}</p>
              </div>
              <div>
                <p className={T.label}>Sentiment</p>
                <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${sentiment.bg} ${sentiment.text}`}>
                  {sentiment.label}
                </span>
              </div>
              {result.hasUnreplied && (
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#FFF7ED] dark:bg-[#2D1300] text-[#9A3412]">
                    ⚠ Unread message from customer — needs reply
                  </span>
                </div>
              )}
              {result.summary && (
                <div className="col-span-2">
                  <p className={T.label}>Summary</p>
                  <p className="text-[12px] text-[#4B5168] dark:text-[#9DA3BB] leading-relaxed">{result.summary}</p>
                </div>
              )}
              {(result.keyTopics || []).length > 0 && (
                <div className="col-span-2">
                  <p className={T.label}>Key Topics</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {result.keyTopics.map((t, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF3FF] dark:bg-[#1A2540] text-[#2563EB]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Messages preview */}
          {result.messageCount > 0 && (
            <div className="rounded-2xl border border-[#E4E7EF] dark:border-[#262A38] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare size={13} className="text-[#25D366]" />
                  <span className="text-[12px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Extracted Messages</span>
                </div>
                <span className="text-[11px] text-[#8B92A9]">{result.messageCount} total</span>
              </div>
              <div
                className="p-4 flex flex-col gap-2 max-h-72 overflow-y-auto"
                style={{ background: "linear-gradient(to bottom, #f0fdf4 0%, #fafffe 100%)" }}
              >
                {visibleMessages.map((msg, i) => (
                  <ExtractedBubble key={i} msg={msg} />
                ))}
              </div>
              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowAll(v => !v)}
                  className="w-full py-2.5 text-[12px] font-semibold text-[#2563EB] hover:bg-[#EEF3FF] dark:hover:bg-[#1A2540] transition flex items-center justify-center gap-1 border-t border-[#E4E7EF] dark:border-[#262A38] bg-white dark:bg-[#1A1D27]"
                >
                  {showAll
                    ? <><ChevronUp size={13} /> Show less</>
                    : <><ChevronDown size={13} /> Show {hiddenCount} more messages</>
                  }
                </button>
              )}
            </div>
          )}

          {/* Import error inline */}
          {error && step === "review" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FEF2F2] border border-red-200 text-[12px] text-[#DC2626]">
              <AlertTriangle size={13} />
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {leadId && (
              <button
                onClick={handleImport}
                disabled={step === "importing"}
                title={isRestored ? "Re-upload the screenshot to enable import" : ""}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-[13px] font-bold transition disabled:opacity-60 ${
                  isRestored
                    ? "bg-[#9ca3af] cursor-not-allowed"
                    : "bg-[#25D366] hover:bg-[#128C7E]"
                }`}
              >
                {step === "importing"
                  ? <><Loader2 size={14} className="animate-spin" /> Importing…</>
                  : isRestored
                  ? <><AlertTriangle size={14} /> Re-upload to import</>
                  : <><Download size={14} /> Import {result.messageCount} messages into conversation</>
                }
              </button>
            )}
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38] text-[12px] font-semibold text-[#4B5168] dark:text-[#9DA3BB] hover:border-[#2563EB] transition"
            >
              <RefreshCw size={12} />
              {isRestored ? "Clear & upload new" : "Upload different screenshot"}
            </button>
          </div>
        </>
      )}
    </div>
  );

  // ── Drawer mode ────────────────────────────────────────────────────────────────
  if (mode === "drawer") {
    return (
      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/40" onClick={onClose} />
        <div className="w-full max-w-md bg-white dark:bg-[#1A1D27] shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E7EF] dark:border-[#262A38]">
            <div className="flex items-center gap-2">
              <ImageIcon size={16} className="text-[#25D366]" />
              <span className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">
                Import WhatsApp Screenshot
              </span>
            </div>
            {leadName && (
              <span className="text-[11px] text-[#8B92A9] bg-[#F8F9FC] dark:bg-[#13161E] px-2 py-0.5 rounded-full max-w-32 truncate">
                {leadName}
              </span>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F8F9FC] dark:hover:bg-[#13161E] text-[#8B92A9] ml-2">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{content}</div>
        </div>
      </div>
    );
  }

  // ── Panel mode ────────────────────────────────────────────────────────────────
  return <div className="w-full">{content}</div>;
}
