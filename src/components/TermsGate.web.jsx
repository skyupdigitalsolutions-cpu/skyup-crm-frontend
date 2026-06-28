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

  // ── Detect scroll-to-bottom ────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // 4px tolerance for sub-pixel rounding / zoom.
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 4;
    if (atBottom) setScrolledToBottom(true);
  }, []);

  // If the content is short enough that there's nothing to scroll, treat it as
  // already "scrolled to bottom" so the user isn't permanently blocked.
  useEffect(() => {
    if (!state.mustAccept) return;
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 4) setScrolledToBottom(true);
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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6">
      <div className="flex w-full max-w-3xl max-h-[90vh] flex-col rounded-2xl bg-white dark:bg-[#13161E] shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-7 pt-5 pb-4 border-b border-gray-100 dark:border-white/5">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-50">
            {t.title || "Terms & Conditions"}
          </h2>
          {t.effectiveDate ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Effective Date: {t.effectiveDate}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Please scroll to the bottom and read the full terms to continue.
          </p>
        </div>

        {/* Scrollable terms body */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-5 sm:px-7 py-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300 space-y-4"
        >
          {t.intro ? <p>{t.intro}</p> : null}
          {(t.sections || []).map((sec, i) => (
            <p key={i}>
              {sec.heading ? sec.heading + " " : ""}{sec.body || ""}
            </p>
          ))}
          <div className="pt-2 text-center text-[11px] text-gray-400 dark:text-gray-500">
            — End of Terms & Conditions —
          </div>
        </div>

        {/* Footer: checkbox + accept */}
        <div className="px-5 sm:px-7 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02]">
          {!scrolledToBottom ? (
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span className="inline-block animate-bounce">↓</span>
              Scroll down to read all the terms before you can accept.
            </p>
          ) : null}

          <label
            className={`flex items-start gap-2.5 select-none ${
              scrolledToBottom ? "cursor-pointer" : "cursor-not-allowed opacity-60"
            }`}
          >
            <input
              type="checkbox"
              disabled={!scrolledToBottom}
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              I have read, understood and agree to the Terms &amp; Conditions.
            </span>
          </label>

          <button
            type="button"
            onClick={handleAccept}
            disabled={!checked || !scrolledToBottom || submitting}
            className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Accept & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
