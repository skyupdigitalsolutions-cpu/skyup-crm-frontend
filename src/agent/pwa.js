// src/agent/pwa.js
// ─────────────────────────────────────────────────────────────────────────────
// Makes the Agent app (/agent) an installable Progressive Web App — same
// approach as src/finance/pwa.js. The manifest, theme colour and service worker
// are added only while an /agent page is on screen, and the worker is scoped to
// /agent. Files in /public: agent-manifest.json · agent-sw.js ·
// agent-offline.html · agent-icons/*
//
// The service worker stores only static files. API calls always go to the
// network; nothing is cached or queued offline.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';

const SW_URL = '/agent-sw.js';
const SW_SCOPE = '/agent';
const MARK = 'data-agent-pwa';

const TAGS = [
  ['link', { rel: 'manifest', href: '/agent-manifest.json' }],
  ['link', { rel: 'apple-touch-icon', href: '/agent-icons/apple-touch-180.png' }],
  ['link', { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/agent-icons/icon-192.png' }],
  ['meta', { name: 'theme-color', content: '#2563EB' }],
  ['meta', { name: 'mobile-web-app-capable', content: 'yes' }],
  ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
  ['meta', { name: 'apple-mobile-web-app-title', content: 'SkyUp CRM' }],
  ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }],
];

function addTags() {
  for (const [tag, attrs] of TAGS) {
    const key = attrs.rel || attrs.name;
    if (document.head.querySelector(`${tag}[${MARK}="${key}"]`)) continue;
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.setAttribute(MARK, key);
    document.head.appendChild(el);
  }
  // Full-screen layout on notched phones (content is kept clear with safe-area padding).
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp && !vp.dataset.agentOrig) {
    vp.dataset.agentOrig = vp.getAttribute('content') || '';
    vp.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
  }
}

function removeTags() {
  document.head.querySelectorAll(`[${MARK}]`).forEach((el) => el.remove());
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp && vp.dataset.agentOrig !== undefined) {
    vp.setAttribute('content', vp.dataset.agentOrig);
    delete vp.dataset.agentOrig;
  }
}

let deferredPrompt = null;
let installed = false;
let wired = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

function wireInstallEvents() {
  if (wired) return;
  wired = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    if (!window.location.pathname.startsWith('/agent')) return;
    e.preventDefault(); deferredPrompt = e; emit();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; installed = true; emit(); });
}

function registerWorker() {
  // Production builds only — in dev a cached shell would fight hot reloading.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE }).catch(() => { /* optional */ });
}

export const isStandalone = () =>
  (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches) ||
  window.navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

async function install() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  emit();
  return outcome;
}

/** Enables the PWA while mounted. Returns { canInstall, iosHint, installed, install }. */
export function useAgentPwa() {
  const [, rerender] = useState(0);
  useEffect(() => {
    wireInstallEvents();
    addTags();
    registerWorker();
    const update = () => rerender((n) => n + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
      setTimeout(() => { if (!window.location.pathname.startsWith('/agent')) removeTags(); }, 0);
    };
  }, []);
  const done = installed || isStandalone();
  return { installed: done, canInstall: !!deferredPrompt && !done, iosHint: isIOS() && !done, install };
}
