// src/components/TermsGate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Blocks the app after login until the user accepts the current Terms &
// Conditions version. Re-appears automatically whenever a NEW version is
// published (the backend reports mustAccept:true for any version the user
// hasn't accepted yet).
//
// RULES (per product decision):
//   • Developer panel is EXEMPT — this component renders children immediately
//     for developers and never calls the API.
//   • The Accept checkbox stays DISABLED until the user scrolls to the very
//     bottom of the terms. Only then can they tick it; only then can they
//     accept.
//
// Usage: wrap the authenticated content, e.g. inside AppLayout:
//   <TermsGate>{children}</TermsGate>
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState, useCallback } from "react";
import { FileText, ChevronDown, CheckCircle2, Loader2 } from "lucide-react";
import api from "../data/axiosConfig";

function getRole() {
  try {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    return u?.role || null;
  } catch {
    return null;
  }
}

export default function TermsGate({ children }) {
  const role = getRole();
  const isDeveloper = role === "developer";

  const [state, setState] = useState({
    loading: !isDeveloper, // developers skip loading entirely
    mustAccept: false,
    terms: null,
    version: null,
    error: null,
  });

  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [progress, setProgress] = useState(0);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef(null);

  // ── Fetch current terms + acceptance status ────────────────────────────────
  const fetchTerms = useCallback(async () => {
    if (isDeveloper) return; // exempt
    try {
      const { data } = await api.get("/terms/current");
      setState({
        loading: false,
        mustAccept: !!data?.mustAccept,
        terms: data?.terms || null,
        version: data?.version ?? null,
        error: null,
      });
    } catch (err) {
      // Fail OPEN: if the terms endpoint errors, don't trap the user out of the
      // whole app. Log it and let them through; they'll be re-checked next load.
      setState({ loading: false, mustAccept: false, terms: null, version: null, error: err });
    }
  }, [isDeveloper]);

  useEffect(() => { fetchTerms(); }, [fetchTerms]);

  // ── Detect scroll-to-bottom + track read progress ──────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100));
    setProgress(pct);
    // 4px tolerance for sub-pixel rounding / zoom.
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 4;
    if (atBottom) setScrolledToBottom(true);
  }, []);

  // If the content is short enough that there's nothing to scroll, treat it as
  // already "scrolled to bottom" so the user isn't permanently blocked.
  useEffect(() => {
    if (!state.mustAccept) return;
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 4) {
      setScrolledToBottom(true);
      setProgress(100);
    }
  }, [state.mustAccept, state.terms]);

  const handleAccept = async () => {
    if (!checked || !scrolledToBottom || submitting) return;
    setSubmitting(true);
    try {
      await api.post("/terms/accept", { version: state.version });
      setState((s) => ({ ...s, mustAccept: false }));
    } catch (err) {
      // Version mismatch → terms changed under us; re-fetch the latest.
      if (err?.response?.data?.code === "TERMS_VERSION_MISMATCH") {
        setChecked(false);
        setScrolledToBottom(false);
        setProgress(0);
        await fetchTerms();
      } else {
        alert(err?.response?.data?.message || "Could not record acceptance. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Developers, or while loading the first check, or once accepted → show app.
  if (isDeveloper || state.loading || !state.mustAccept || !state.terms) {
    return children;
  }

  const t = state.terms;

  // ── Blocking overlay ────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6">
      <div className="flex w-full max-w-2xl max-h-[88vh] flex-col rounded-xl bg-white dark:bg-[#13161E] shadow-xl ring-1 ring-slate-900/10 dark:ring-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-5 pb-4 border-b border-slate-100 dark:border-white/5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <FileText className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-tight text-slate-900 dark:text-slate-50">
              {t.title || "Terms & Conditions"}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {t.effectiveDate ? `Effective ${t.effectiveDate} · ` : ""}
              Please review the full terms before continuing.
            </p>
          </div>
        </div>

        {/* Read-progress bar */}
        <div className="h-0.5 w-full bg-slate-100 dark:bg-white/5">
          <div
            className="h-full bg-blue-600 transition-[width] duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Scrollable terms body */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-5 text-[13px] leading-6 text-slate-600 dark:text-slate-300 space-y-3.5"
        >
          {t.intro ? <p>{t.intro}</p> : null}
          {(t.sections || []).map((sec, i) => (
            <div key={i}>
              {sec.heading ? (
                <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                  {sec.heading}
                </h3>
              ) : null}
              {sec.body ? <p>{sec.body}</p> : null}
            </div>
          ))}
          <div className="pt-3 text-center text-[11px] font-medium text-slate-400 dark:text-slate-500">
            — End of Terms &amp; Conditions —
          </div>
        </div>

        {/* Footer: checkbox + accept */}
        <div className="border-t border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-white/[0.02] px-6 py-4">
          {!scrolledToBottom ? (
            <p className="mb-3 flex items-center gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
              <ChevronDown className="h-3.5 w-3.5 animate-bounce" strokeWidth={2.5} />
              Scroll to the end to enable acceptance.
            </p>
          ) : (
            <p className="mb-3 flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.5} />
              You've reached the end of the terms.
            </p>
          )}

          <label
            className={`flex items-start gap-2.5 select-none ${
              scrolledToBottom ? "cursor-pointer" : "cursor-not-allowed opacity-50"
            }`}
          >
            <input
              type="checkbox"
              disabled={!scrolledToBottom}
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 dark:border-white/20 dark:bg-white/5"
            />
            <span className="text-[12.5px] leading-5 text-slate-700 dark:text-slate-300">
              I have read, understood and agree to the Terms &amp; Conditions.
            </span>
          </label>

          <button
            type="button"
            onClick={handleAccept}
            disabled={!checked || !scrolledToBottom || submitting}
            className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} />
                Submitting…
              </>
            ) : (
              "Accept & Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
