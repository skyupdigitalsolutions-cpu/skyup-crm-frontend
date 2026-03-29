// hooks/useTwilioCall.js
import { useEffect, useRef, useState } from 'react';
import { Device } from '@twilio/voice-sdk';
import axios from 'axios';

const API_BASE = 'https://skyup-crm-backend.onrender.com/api/twilio';

export function useTwilioCall(identity = 'crm_user') {
  const deviceRef = useRef(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [activeCall, setActiveCall] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function setup() {
      try {
        const { data } = await axios.get(`${API_BASE}/token?identity=${identity}`);
        const device = new Device(data.token, { logLevel: 1 });

        device.on('registered', () => console.log('Twilio Device ready'));
        device.on('error', (err) => setError(err.message));

        await device.register();
        deviceRef.current = device;
      } catch (err) {
        setError('Failed to initialize Twilio device');
        console.error(err);
      }
    }
    setup();

    return () => deviceRef.current?.destroy();
  }, [identity]);

  // makeCall now accepts: phoneNumber (E.164) + leadId (for backend logging)
  const makeCall = async (phoneNumber, leadId, onCallEnd) => {
    if (!deviceRef.current) return;
    try {
      setCallStatus('connecting');
      setError(null);

      // Ensure E.164 format — Twilio REQUIRES this or it sends HANGUP 31005
      const e164 = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

      const call = await deviceRef.current.connect({
        params: {
          To:     e164,    // ✅ must be a real E.164 phone number — not a MongoDB ID
          LeadId: leadId,  // passed to /voice for server-side logging only
        },
      });

      call.on('accept',     () => setCallStatus('active'));
      call.on('disconnect', () => {
        setCallStatus('ended');
        if (onCallEnd) onCallEnd(call.parameters.CallSid);
        setActiveCall(null);
      });
      call.on('error', (err) => {
        setError(err.message);
        setCallStatus('idle');
      });

      setActiveCall(call);
    } catch (err) {
      setError(err.message);
      setCallStatus('idle');
    }
  };

  const hangUp = () => {
    activeCall?.disconnect();
    setCallStatus('idle');
    setActiveCall(null);
  };

  const mute = (muted) => activeCall?.mute(muted);

  return { callStatus, makeCall, hangUp, mute, error };
}