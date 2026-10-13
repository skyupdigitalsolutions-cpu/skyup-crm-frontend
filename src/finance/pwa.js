// src/finance/pwa.js — NEW FILE
// ─────────────────────────────────────────────────────────────────────────────
// Makes the Finance Panel (/finance) an installable Progressive Web App.
//
// The CRM itself is NOT a PWA: the manifest, theme colour and service worker are
// added only while a Finance page is on screen, and the service worker is scoped
// to /finance. Files involved (all in /public):
//   finance-manifest.json · finance-sw.js · finance-offline.html · finance-icons/*
//
// The service worker only stores static files (page shell, JS, CSS, icons). API
// calls and anything financial always go to the network and are never cached, and
// nothing is queued while offline.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";

const SW_URL = "/finance-sw.js";
const SW_SCOPE = "/finance";
const MARK = "data-finance-pwa";

// ── <head> tags (added only on Finance pages) ────────────────────────────────
const TAGS = [
  ["link", { rel: "manifest", href: "/finance-manifest.json" }],
  ["link", { rel: "apple-touch-icon", href: "/finance-icons/skyup-finance-apple-touch-180.png" }],
  ["link", { rel: "icon", type: "image/png", sizes: "192x192", href: "/finance-icons/skyup-finance-192.png" }],
  ["meta", { name: "theme-color", content: "#059669" }],
  ["meta", { name: "mobile-web-app-capable", content: "yes" }],
  ["meta", { name: "apple-mobile-web-app-capable", content: "yes" }],
  ["meta", { name: "apple-mobile-web-app-title", content: "Finance" }],
  ["meta", { name: "apple-mobile-web-app-status-bar-style", content: "default" }],
];

function addTags() {
  for (const [tag, attrs] of TAGS) {
    const key = attrs.rel || attrs.name;
    if (document.head.querySelector(`${tag}[${MARK}="${key}"]`)) continue;   // already there
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.setAttribute(MARK, key);
    document.head.appendChild(el);
  }
}

function removeTags() {
  document.head.querySelectorAll(`[${MARK}]`).forEach((el) => el.remove());
}

// ── install prompt state (shared, because the browser fires the event once) ──
let deferredPrompt = null;
let installed = false;
let wired = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

function wireInstallEvents() {
  if (wired) return;
  wired = true;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; emit(); });
  window.addEventListener("appinstalled", () => { deferredPrompt = null; installed = true; emit(); });
}

function registerWorker() {
  // Production builds only — in dev a cached shell would fight hot reloading.
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE }).catch(() => { /* PWA is optional; the panel works without it */ });
}

/** Turn the PWA on for the current Finance page. Safe to call repeatedly. */
export function enableFinancePwa() {
  wireInstallEvents();
  addTags();
  registerWorker();
}

const isStandalone = () =>
  (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent || "") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

async function install() {
  if (!deferredPrompt) return "unavailable";
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  emit();
  return outcome;                                   // "accepted" | "dismissed"
}

/**
 * Used by the Finance sign-in page and the panel.
 *   online      – false while the device has no connection
 *   canInstall  – the browser is ready to show its install dialog (Chrome / Edge / Android)
 *   iosHint     – iPhone / iPad: installing is manual (Share → Add to Home Screen)
 *   installed   – already running as an installed app
 */
export function useFinancePwa() {
  const [, rerender] = useState(0);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));

  useEffect(() => {
    enableFinancePwa();
    const update = () => rerender((n) => n + 1);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    listeners.add(update);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      listeners.delete(update);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      // Moving on to the CRM in this same tab? Then it must not look like the Finance app.
      setTimeout(() => { if (!window.location.pathname.startsWith("/finance")) removeTags(); }, 0);
    };
  }, []);

  const standalone = isStandalone();
  const done = installed || standalone;
  return { online, installed: done, canInstall: !!deferredPrompt && !done, iosHint: isIOS() && !done, install };
}
