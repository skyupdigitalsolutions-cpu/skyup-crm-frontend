/**
 * VoiceflowChat.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop-in Voiceflow chatbot widget for SkyUp CRM.
 *
 * HOW TO CONFIGURE  (one-time setup):
 *   1. Open the chat widget by clicking the bot icon (bottom-right corner).
 *   2. Click the ⚙️ gear icon inside the chat header.
 *   3. Enter your Voiceflow API Key and Project ID.
 *   4. Click "Save & Connect" — the bot connects immediately.
 *
 * These settings are saved to localStorage so you only do this once.
 *
 * WHERE TO GET YOUR KEYS:
 *   • API Key    → Voiceflow Dashboard → Settings → API Keys
 *   • Project ID → Voiceflow Dashboard → your project URL
 *                  e.g. https://creator.voiceflow.com/project/YOUR_PROJECT_ID/...
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ── localStorage keys ─────────────────────────────────────────────────────────
const LS_API_KEY    = 'vf_api_key';
const LS_PROJECT_ID = 'vf_project_id';
const LS_VERSION_ID = 'vf_version_id';   // optional, defaults to 'production'

// ── Voiceflow Runtime base URL ─────────────────────────────────────────────────
const VF_BASE = 'https://general-runtime.voiceflow.com';

// ── Unique session per browser tab ─────────────────────────────────────────────
const SESSION_ID = `crm_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// ─────────────────────────────────────────────────────────────────────────────
export default function VoiceflowChat() {
  // Widget open/close
  const [open, setOpen]         = useState(false);
  // Settings panel open/close
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Config state (loaded from localStorage)
  const [apiKey,    setApiKey]    = useState(() => localStorage.getItem(LS_API_KEY)    || '');
  const [projectId, setProjectId] = useState(() => localStorage.getItem(LS_PROJECT_ID) || '');
  const [versionId, setVersionId] = useState(() => localStorage.getItem(LS_VERSION_ID) || 'production');

  // Temp form state (inside settings panel)
  const [formKey,     setFormKey]     = useState('');
  const [formProject, setFormProject] = useState('');
  const [formVersion, setFormVersion] = useState('production');

  // Chat messages  { role: 'user'|'bot', text: string, timestamp: Date }
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [connected, setConnected] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // ── Scroll to bottom on new messages ────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Focus input when chat opens ─────────────────────────────────────────────
  useEffect(() => {
    if (open && !settingsOpen && connected) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, settingsOpen, connected]);

  // ── Auto-open settings if not configured ────────────────────────────────────
  useEffect(() => {
    if (open && (!apiKey || !projectId)) {
      setFormKey(apiKey);
      setFormProject(projectId);
      setFormVersion(versionId);
      setSettingsOpen(true);
    }
  }, [open]);

  // ── Launch conversation when connected ──────────────────────────────────────
  const launchSession = useCallback(async (key, pid, vid) => {
    if (!key || !pid) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${VF_BASE}/state/user/${SESSION_ID}/interact`,
        {
          method: 'POST',
          headers: {
            'Authorization': key,
            'versionID':     vid || 'production',
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            action: { type: 'launch' },
            config: { tts: false, stripSSML: true },
          }),
        }
      );
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Voiceflow error ${res.status}: ${body}`);
      }
      const traces = await res.json();
      const botMessages = extractMessages(traces);
      setMessages(botMessages.map(text => ({ role: 'bot', text, timestamp: new Date() })));
      setConnected(true);
    } catch (e) {
      setError(`Connection failed: ${e.message}`);
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Save settings ────────────────────────────────────────────────────────────
  const saveSettings = () => {
    if (!formKey.trim() || !formProject.trim()) {
      setError('API Key and Project ID are required.');
      return;
    }
    const trimKey = formKey.trim();
    const trimPid = formProject.trim();
    const trimVid = formVersion.trim() || 'production';

    localStorage.setItem(LS_API_KEY,    trimKey);
    localStorage.setItem(LS_PROJECT_ID, trimPid);
    localStorage.setItem(LS_VERSION_ID, trimVid);

    setApiKey(trimKey);
    setProjectId(trimPid);
    setVersionId(trimVid);

    setSettingsOpen(false);
    setMessages([]);
    setConnected(false);
    setError('');

    launchSession(trimKey, trimPid, trimVid);
  };

  // ── Open chat & launch if already configured ────────────────────────────────
  const handleOpen = () => {
    setOpen(true);
    if (apiKey && projectId && !connected && messages.length === 0) {
      launchSession(apiKey, projectId, versionId);
    }
  };

  // ── Send a message ───────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    if (!text.trim() || loading || !apiKey || !projectId) return;
    const userMsg = { role: 'user', text: text.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);
    setError('');

    try {
      const res = await fetch(
        `${VF_BASE}/state/user/${SESSION_ID}/interact`,
        {
          method: 'POST',
          headers: {
            'Authorization': apiKey,
            'versionID':     versionId,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            action: { type: 'text', payload: text.trim() },
            config: { tts: false, stripSSML: true },
          }),
        }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const traces = await res.json();
      const botMessages = extractMessages(traces);
      setMessages(prev => [
        ...prev,
        ...botMessages.map(t => ({ role: 'bot', text: t, timestamp: new Date() })),
      ]);
    } catch (e) {
      setError(`Failed to send: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  // ── Reset / clear chat ───────────────────────────────────────────────────────
  const clearChat = () => {
    setMessages([]);
    setConnected(false);
    setError('');
    if (apiKey && projectId) launchSession(apiKey, projectId, versionId);
  };

  const isConfigured = !!apiKey && !!projectId;

  return (
    <>
      {/* ── Floating toggle button ─────────────────────────────────────────── */}
      <button
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl
                   bg-[#2563EB] hover:bg-blue-700 text-white
                   flex items-center justify-center transition-all duration-200
                   hover:scale-110 active:scale-95"
        title="Open AI Assistant"
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
          </svg>
        )}
        {/* Pulse dot when not configured */}
        {!isConfigured && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-orange-400 border-2 border-white animate-pulse" />
        )}
      </button>

      {/* ── Chat window ───────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[600px]
                     bg-white dark:bg-[#13161E]
                     border border-[#E4E7EF] dark:border-[#262A38]
                     rounded-2xl shadow-2xl flex flex-col overflow-hidden
                     animate-in slide-in-from-bottom-4 duration-200"
          style={{ minHeight: '400px' }}
        >
          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3
                          bg-[#2563EB] text-white rounded-t-2xl flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-bold leading-tight">SkyUp Assistant</p>
                <p className="text-[10px] text-blue-200 leading-tight">
                  {connected ? '● Online' : isConfigured ? 'Connecting…' : '⚙ Setup required'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Clear chat */}
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition"
                  title="Clear chat"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                  </svg>
                </button>
              )}
              {/* Settings toggle */}
              <button
                onClick={() => {
                  setFormKey(apiKey);
                  setFormProject(projectId);
                  setFormVersion(versionId);
                  setSettingsOpen(v => !v);
                  setError('');
                }}
                className="p-1.5 rounded-lg hover:bg-white/20 transition"
                title="Settings"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0
                       012.573 1.066c1.543.94 3.31-.826 4.364.296 1.053 1.122-.207
                       2.979.206 4.565.934 1.612 2.848 1.612 2.848 0-.413 1.586
                       1.259 3.443.206 4.565-1.054 1.122-2.821-.644-4.364.296a1.724
                       1.724 0 01-2.573 1.066c-.426 1.756-2.924 1.756-3.35
                       0a1.724 1.724 0 01-2.573-1.066c-1.543-.94-3.31.826-4.364-.296-1.053-1.122.207-2.979-.206-4.565-.934-1.612-2.848-1.612-2.848
                       0 .413-1.586-1.259-3.443-.206-4.565 1.054-1.122 2.821.644
                       4.364-.296a1.724 1.724 0 012.573-1.066z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* ── Settings panel ───────────────────────────────────────────────── */}
          {settingsOpen ? (
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-[#F8F9FC] dark:bg-[#0F1117]">
              <div>
                <h3 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA] mb-1">
                  Voiceflow Configuration
                </h3>
                <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] leading-relaxed">
                  Enter your Voiceflow credentials below. These are saved locally in your browser.
                </p>
              </div>

              {/* API Key */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[#565C75] dark:text-[#8B92A9] uppercase tracking-wide">
                  API Key *
                </label>
                <input
                  type="password"
                  value={formKey}
                  onChange={e => setFormKey(e.target.value)}
                  placeholder="VF.DM.xxxxxxxx.xxxxxxxx"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
                             bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA]
                             placeholder-[#C0C4D0] focus:outline-none focus:ring-2 focus:ring-[#2563EB]
                             font-mono"
                />
                <p className="text-[10px] text-[#8B92A9]">
                  Voiceflow Dashboard → Settings → API Keys
                </p>
              </div>

              {/* Project ID */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[#565C75] dark:text-[#8B92A9] uppercase tracking-wide">
                  Project ID *
                </label>
                <input
                  type="text"
                  value={formProject}
                  onChange={e => setFormProject(e.target.value)}
                  placeholder="64xxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
                             bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA]
                             placeholder-[#C0C4D0] focus:outline-none focus:ring-2 focus:ring-[#2563EB]
                             font-mono"
                />
                <p className="text-[10px] text-[#8B92A9]">
                  Found in your Voiceflow project URL
                </p>
              </div>

              {/* Version ID */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-[#565C75] dark:text-[#8B92A9] uppercase tracking-wide">
                  Version <span className="normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formVersion}
                  onChange={e => setFormVersion(e.target.value)}
                  placeholder="production"
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
                             bg-white dark:bg-[#13161E] text-[13px] text-[#0F1117] dark:text-[#F0F2FA]
                             placeholder-[#C0C4D0] focus:outline-none focus:ring-2 focus:ring-[#2563EB]
                             font-mono"
                />
                <p className="text-[10px] text-[#8B92A9]">
                  Leave as "production" unless using a test version
                </p>
              </div>

              {error && (
                <div className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800
                                text-[11px] text-red-600 dark:text-red-400">
                  ⚠️ {error}
                </div>
              )}

              <button
                onClick={saveSettings}
                disabled={!formKey.trim() || !formProject.trim()}
                className="w-full py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700
                           disabled:opacity-40 disabled:cursor-not-allowed
                           text-white text-[13px] font-semibold transition"
              >
                Save & Connect
              </button>

              {isConfigured && (
                <button
                  onClick={() => { setSettingsOpen(false); setError(''); }}
                  className="w-full py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
                             text-[12px] text-[#8B92A9] hover:text-[#0F1117] dark:hover:text-[#F0F2FA] transition"
                >
                  Cancel
                </button>
              )}

              {/* Help callout */}
              <div className="px-3 py-3 rounded-xl bg-blue-50 dark:bg-[#1A2540] border border-blue-100 dark:border-[#1E3A6E]">
                <p className="text-[10px] text-[#2563EB] dark:text-[#4F8EF7] leading-relaxed font-medium">
                  💡 How to get your keys
                </p>
                <ol className="text-[10px] text-[#565C75] dark:text-[#8B92A9] leading-relaxed mt-1 space-y-0.5 list-decimal list-inside">
                  <li>Go to <span className="font-mono">creator.voiceflow.com</span></li>
                  <li>Open your project</li>
                  <li>Settings → API Keys → copy your key</li>
                  <li>Copy the Project ID from the URL bar</li>
                </ol>
              </div>
            </div>
          ) : (
            <>
              {/* ── Messages area ──────────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[#F8F9FC] dark:bg-[#0F1117]">
                {!isConfigured && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
                    <div className="w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                      <svg className="w-7 h-7 text-orange-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Setup Required</p>
                      <p className="text-[11px] text-[#8B92A9] mt-1">Click the ⚙ icon above to add your Voiceflow API Key.</p>
                    </div>
                    <button
                      onClick={() => { setFormKey(''); setFormProject(''); setFormVersion('production'); setSettingsOpen(true); }}
                      className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-[12px] font-semibold hover:bg-blue-700 transition"
                    >
                      Open Settings
                    </button>
                  </div>
                )}

                {isConfigured && messages.length === 0 && !loading && (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-8">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center animate-pulse">
                      <svg className="w-5 h-5 text-[#2563EB]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                      </svg>
                    </div>
                    <p className="text-[12px] text-[#8B92A9]">Connecting to your assistant…</p>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'bot' && (
                      <div className="w-6 h-6 rounded-full bg-[#2563EB] flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                        </svg>
                      </div>
                    )}
                    <div
                      className={`max-w-[78%] px-3 py-2.5 rounded-2xl text-[12px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#2563EB] text-white rounded-br-sm'
                          : 'bg-white dark:bg-[#13161E] text-[#0F1117] dark:text-[#F0F2FA] border border-[#E4E7EF] dark:border-[#262A38] rounded-bl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="w-6 h-6 rounded-full bg-[#2563EB] flex items-center justify-center mr-2 flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                      </svg>
                    </div>
                    <div className="px-3 py-2.5 rounded-2xl rounded-bl-sm bg-white dark:bg-[#13161E]
                                    border border-[#E4E7EF] dark:border-[#262A38] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8B92A9] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8B92A9] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#8B92A9] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}

                {error && !settingsOpen && (
                  <div className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800
                                  text-[11px] text-red-600 dark:text-red-400">
                    ⚠️ {error}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* ── Input bar ─────────────────────────────────────────────────── */}
              {isConfigured && (
                <div className="flex items-end gap-2 px-3 py-3 border-t border-[#E4E7EF] dark:border-[#262A38]
                                bg-white dark:bg-[#13161E] flex-shrink-0">
                  <textarea
                    ref={inputRef}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message…"
                    rows={1}
                    disabled={loading || !connected}
                    className="flex-1 resize-none px-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#262A38]
                               bg-[#F8F9FC] dark:bg-[#0F1117] text-[12px] text-[#0F1117] dark:text-[#F0F2FA]
                               placeholder-[#C0C4D0] focus:outline-none focus:ring-2 focus:ring-[#2563EB]
                               disabled:opacity-50 max-h-24 leading-relaxed"
                    style={{ scrollbarWidth: 'none' }}
                  />
                  <button
                    onClick={() => sendMessage(inputText)}
                    disabled={!inputText.trim() || loading || !connected}
                    className="w-9 h-9 rounded-xl bg-[#2563EB] hover:bg-blue-700
                               disabled:opacity-40 disabled:cursor-not-allowed
                               flex items-center justify-center transition flex-shrink-0"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

// ── Helper: extract text messages from Voiceflow trace array ─────────────────
function extractMessages(traces) {
  const messages = [];
  if (!Array.isArray(traces)) return messages;
  for (const trace of traces) {
    if (trace.type === 'text' && trace.payload?.message) {
      messages.push(trace.payload.message);
    } else if (trace.type === 'speak' && trace.payload?.message) {
      messages.push(trace.payload.message);
    } else if (trace.type === 'message' && trace.payload?.message) {
      messages.push(trace.payload.message);
    }
  }
  return messages.length ? messages : [];
}