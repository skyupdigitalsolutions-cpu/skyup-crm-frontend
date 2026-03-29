// components/CallButton.jsx
import React, { useState } from 'react';
import { useTwilioCall } from '../hooks/useTwilioCall';
import { maskPhone } from '../utils/maskPhone';

export default function CallButton({ contactId, contactName, contactNumber, onCallEnd }) {
  const { callStatus, makeCall, hangUp, mute, error } = useTwilioCall('crm_user');
  const [isMuted, setIsMuted] = useState(false);

  const handleMute   = () => { mute(!isMuted); setIsMuted(p => !p); };
  const handleHangUp = () => { hangUp(); onCallEnd?.(); };

  // ✅ Send real phone number as To (E.164) + contactId for backend logging
  const handleCall = () => makeCall(contactNumber, contactId, onCallEnd);

  return (
    <div className="bg-white dark:bg-[#1A1D27] border border-[#E4E7EF] dark:border-[#262A38] rounded-2xl p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-bold text-[#0F1117] dark:text-[#F0F2FA]">Call Contact</h2>
        {callStatus === 'active' && (
          <span className="flex items-center gap-1.5 text-[10px] text-[#059669] dark:text-[#34D399]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse inline-block" />
            Live
          </span>
        )}
        {callStatus === 'connecting' && (
          <span className="flex items-center gap-1.5 text-[10px] text-[#D97706]">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Connecting
          </span>
        )}
      </div>

      {/* Contact info — masked number */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-[#F8F9FC] dark:bg-[#13161E] border border-[#E4E7EF] dark:border-[#262A38]">
        <div className="w-9 h-9 rounded-full bg-[#EEF3FF] dark:bg-[#1A2540] flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-[#2563EB] dark:text-[#4F8EF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#0F1117] dark:text-[#F0F2FA] truncate">
            {contactName || 'Unknown Contact'}
          </p>
          <p className="text-[11px] text-[#8B92A9] dark:text-[#565C75] truncate font-mono tracking-wide">
            {maskPhone(contactNumber)}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
          callStatus === 'active'     ? 'bg-[#DCFCE7] dark:bg-[#052E16] text-[#059669] dark:text-[#34D399]' :
          callStatus === 'connecting' ? 'bg-[#FEF3C7] dark:bg-[#1C1007] text-[#D97706] dark:text-[#FBBF24]' :
                                        'bg-[#F1F4FF] dark:bg-[#21253A] text-[#8B92A9] dark:text-[#565C75]'
        }`}>
          {callStatus === 'active' ? 'On Call' : callStatus === 'connecting' ? 'Dialing' : callStatus === 'ended' ? 'Ended' : 'Ready'}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-xl bg-[#FEF2F2] dark:bg-[#2D0A0A] border border-[#FECACA] dark:border-[#7F1D1D]">
          <p className="text-[11px] font-semibold text-[#991B1B] dark:text-[#F87171]">{error}</p>
        </div>
      )}

      {/* Idle / Ended */}
      {(callStatus === 'idle' || callStatus === 'ended') && (
        <button onClick={handleCall} disabled={!contactNumber}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition
            ${!contactNumber
              ? 'bg-[#F1F4FF] dark:bg-[#262A38] text-[#8B92A9] cursor-not-allowed'
              : 'bg-[#059669] hover:bg-emerald-700 active:scale-[0.98] text-white cursor-pointer'}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 8V5z"/>
          </svg>
          {callStatus === 'ended' ? 'Call Again' : `Call ${contactName || 'Contact'}`}
        </button>
      )}

      {/* Connecting */}
      {callStatus === 'connecting' && (
        <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FEF3C7] dark:bg-[#1C1007] border border-[#FDE68A] dark:border-[#78350F]">
          <svg className="w-4 h-4 animate-spin text-[#D97706]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <span className="text-[13px] font-semibold text-[#D97706]">Connecting...</span>
        </div>
      )}

      {/* Active */}
      {callStatus === 'active' && (
        <div className="flex gap-2">
          <button onClick={handleMute}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold border transition active:scale-[0.98] cursor-pointer
              ${isMuted
                ? 'bg-[#FEF3C7] dark:bg-[#1C1007] border-[#FDE68A] dark:border-[#78350F] text-[#D97706]'
                : 'bg-[#F8F9FC] dark:bg-[#13161E] border-[#E4E7EF] dark:border-[#262A38] text-[#4B5168] dark:text-[#9DA3BB]'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isMuted
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/>
                : <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>}
            </svg>
            {isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button onClick={handleHangUp}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#DC2626] hover:bg-red-700 active:scale-[0.98] text-white text-[13px] font-semibold transition cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"/>
            </svg>
            Hang Up
          </button>
        </div>
      )}
    </div>
  );
}