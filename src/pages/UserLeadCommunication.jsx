// src/pages/UserLeadCommunication.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Communication page for the USER (employee) role.
// Users can ONLY chat with their own assigned leads via WhatsApp.
// They cannot see other users' conversations or send blasts.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import api from "../data/axiosConfig";

const API_URL = import.meta.env.VITE_API_URL || "https://skyup-crm-backend.onrender.com/api";
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, "") : "https://skyup-crm-backend.onrender.com");

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ name, size = "md" }) {
  const initials = (name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["#059669", "#2563EB", "#7C3AED", "#D97706", "#DC2626"];
  const color  = colors[(name?.charCodeAt(0) || 0) % colors.length];
  const sz = size === "sm" ? "w-8 h-8 text-[11px]" : "w-10 h-10 text-[12px]";
  return (
    <div className={`${sz} rounded-full flex items-center justify-center font-bold text-white shrink-0`} style={{ background: color }}>
      {initials}
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────
function Bubble({ msg, isOwn }) {
  return (
    <div className={`flex mb-2 ${isOwn ? "justify-end" : "justify-start"} px-3`}>
      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-[13px] shadow-sm ${
        isOwn
          ? "bg-[#DCF8C6] dark:bg-[#005C4B] text-[#111B21] dark:text-[#E9EDEF] rounded-br-none"
          : "bg-white dark:bg-[#202C33] text-[#111B21] dark:text-[#E9EDEF] rounded-bl-none border border-[#E4E7EF] dark:border-transparent"
      }`}>
        <p className="break-words leading-relaxed">{msg.text || msg.message}</p>
        <p className="text-[10px] opacity-50 text-right mt-0.5">{fmtTime(msg.createdAt || msg.timestamp)}</p>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyPane({ onSelectLead }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#F0F4FF] dark:bg-[#0B141A]">
      <div className="w-20 h-20 rounded-full bg-[#2563EB]/10 flex items-center justify-center">
        <svg className="w-10 h-10 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
      <h3 className="text-[15px] font-bold text-[#4B5168] dark:text-[#8B92A9]">Select a Lead to Chat</h3>
      <p className="text-[12px] text-[#8B92A9] text-center max-w-xs">
        You can only message your assigned leads. Select one from the left panel to start a WhatsApp conversation.
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function UserLeadCommunication() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const [leads,        setLeads]        = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [loadingMsgs,  setLoadingMsgs]  = useState(false);
  const [msgText,      setMsgText]      = useState("");
  const [sending,      setSending]      = useState(false);
  const [search,       setSearch]       = useState("");
  const socketRef  = useRef(null);
  const bottomRef  = useRef(null);

  // ── Fetch assigned leads ───────────────────────────────────────────────────
  useEffect(() => {
    api.get("/lead/my")
      .then((res) => setLeads(Array.isArray(res.data) ? res.data : res.data?.data || []))
      .catch(() => {})
      .finally(() => setLoadingLeads(false));
  }, []);

  // ── Socket for real-time messages ─────────────────────────────────────────
  useEffect(() => {
    const socket = io(SOCKET_URL, { withCredentials: true });
    socketRef.current = socket;
    socket.emit("wa_agent_join", { agentId: user?._id });
    socket.on("new_wa_message", (msg) => {
      if (selected && msg.conversationId === selected.conversationId) {
        setMessages(prev => [...prev, msg]);
      }
    });
    return () => socket.disconnect();
  }, [selected]);

  // ── Load messages for selected lead ───────────────────────────────────────
  useEffect(() => {
    if (!selected?.conversationId) return;
    setLoadingMsgs(true);
    axios.get(`${API_URL}/whatsapp/conversations/${selected.conversationId}/messages`, authHeaders)
      .then((res) => setMessages(res.data || []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = msgText.trim();
    if (!text || !selected?.conversationId || sending) return;
    setSending(true);
    try {
      const { data } = await axios.post(
        `${API_URL}/whatsapp/send`,
        { conversationId: selected.conversationId, text },
        authHeaders,
      );
      setMessages(prev => [...prev, data]);
      setMsgText("");
    } catch (e) {
      alert(e.response?.data?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }, [msgText, selected, sending]);

  const filteredLeads = leads.filter(l =>
    (l.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (l.mobile || l.phone || "").includes(search)
  );

  return (
    <div className="flex h-full bg-white dark:bg-[#111B21]">

      {/* ── Left panel: leads list ────────────────────────────────────────── */}
      <div className="w-80 shrink-0 flex flex-col border-r border-[#E4E7EF] dark:border-[#2A3942] bg-white dark:bg-[#111B21]">
        {/* Header */}
        <div className="px-4 pt-5 pb-3 border-b border-[#E4E7EF] dark:border-[#2A3942]">
          <h2 className="text-[15px] font-bold text-[#0F1117] dark:text-[#E9EDEF] mb-3">My Lead Chats</h2>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/></svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#E4E7EF] dark:border-[#2A3942] bg-[#F0F2F5] dark:bg-[#202C33] text-[13px] text-[#0F1117] dark:text-[#E9EDEF] placeholder:text-[#8B92A9] focus:outline-none"
            />
          </div>
        </div>

        {/* Leads */}
        <div className="flex-1 overflow-y-auto">
          {loadingLeads ? (
            <div className="flex justify-center items-center h-32">
              <svg className="w-5 h-5 animate-spin text-[#25D366]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-12 text-[12px] text-[#8B92A9]">
              {search ? "No leads match your search" : "No leads assigned to you yet"}
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const isActive = selected?._id === lead._id;
              return (
                <button
                  key={lead._id}
                  onClick={() => setSelected(lead)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-b border-[#F0F2F5] dark:border-[#2A3942] ${
                    isActive ? "bg-[#EEF3FF] dark:bg-[#2A3942]" : "hover:bg-[#F8F9FC] dark:hover:bg-[#202C33]"
                  }`}
                >
                  <Avatar name={lead.name} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#E9EDEF] truncate">{lead.name}</p>
                    <p className="text-[11px] text-[#8B92A9] truncate">{lead.mobile || lead.phone}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    lead.status === "Converted" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
                    lead.status === "In Progress" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                    "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  }`}>
                    {lead.status || "New"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right panel: chat ─────────────────────────────────────────────── */}
      {!selected ? (
        <EmptyPane />
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat header */}
          <div className="bg-[#075E54] dark:bg-[#202C33] px-4 py-3 flex items-center gap-3 shrink-0">
            <Avatar name={selected.name} size="sm" />
            <div className="flex-1 min-w-0">
              <h3 className="text-[14px] font-semibold text-white leading-none truncate">{selected.name}</h3>
              <p className="text-[11px] text-[#8FB8A8] mt-0.5">{selected.mobile || selected.phone}</p>
            </div>
            <span className="text-[10px] bg-white/10 text-white px-2 py-0.5 rounded-full font-semibold">
              {selected.status || "New"}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-3 bg-[#EFEAE2] dark:bg-[#0B141A]">
            {loadingMsgs ? (
              <div className="flex justify-center items-center h-full">
                <svg className="w-6 h-6 animate-spin text-[#25D366]" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
                <svg className="w-12 h-12 text-[#8B92A9]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                <p className="text-[12px] text-[#8B92A9]">No messages yet — start the conversation</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <Bubble key={msg._id || i} msg={msg} isOwn={msg.direction === "outbound" || msg.from === "admin"} />
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="bg-[#F0F2F5] dark:bg-[#202C33] px-3 py-2.5 flex items-end gap-2 shrink-0">
            <div className="flex-1 bg-white dark:bg-[#2A3942] rounded-2xl px-4 py-2 min-h-[42px] flex items-center">
              <textarea
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                rows={1}
                placeholder="Type a message…"
                className="w-full bg-transparent text-[13px] text-[#111B21] dark:text-[#E9EDEF] placeholder:text-[#8B92A9] resize-none focus:outline-none leading-relaxed"
                style={{ maxHeight: "100px", overflowY: "auto" }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={sending || !msgText.trim()}
              className="w-11 h-11 rounded-full bg-[#25D366] hover:bg-[#20B858] disabled:opacity-40 flex items-center justify-center transition shadow-md shrink-0"
            >
              {sending
                ? <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                : <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
