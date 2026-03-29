// hooks/useTwilioCall.js
import { useEffect, useRef, useState } from 'react';
import { Device } from '@twilio/voice-sdk';
import axios from 'axios';

const API_BASE = 'https://skyup-crm-backend.onrender.com/api/twilio';

export function useTwilioCall(identity = 'crm_user') {
  const deviceRef = useRef(null);
  const [callStatus, setCallStatus] = useState('idle');
  const [activeCall, setActiveCall] = useState(null);
  const [error, setError]           = useState(null);
  const [ready, setReady]           = useState(false); // ✅ track device readiness

  useEffect(() => {
    async function setup() {
      try {
        // ✅ Request mic permission BEFORE initializing the Device
        // This prevents AcquisitionFailedError (31402)
        await navigator.mediaDevices.getUserMedia({ audio: true });

        const { data } = await axios.get(`${API_BASE}/token?identity=${identity}`);

        const device = new Device(data.token, {
          logLevel: 1,
          codecPreferences: ['opus', 'pcmu'], // ✅ explicit codec order
          sounds: {},                          // ✅ disable sounds to avoid extra media constraints
        });

        device.on('registered', () => {
          console.log('Twilio Device ready ✅');
          setReady(true);
          setError(null);
        });

        device.on('error', (err) => {
          console.error('Twilio Device error:', err);
          setError(err.message);
          setReady(false);
        });

        device.on('unregistered', () => {
          setReady(false);
        });

        await device.register();
        deviceRef.current = device;
      } catch (err) {
        // ✅ Friendly message for mic permission denial
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Microphone access denied. Please allow mic permission in your browser and refresh.');
        } else if (err.name === 'NotFoundError') {
          setError('No microphone found. Please connect a microphone and refresh.');
        } else {
          setError('Failed to initialize call device. Please refresh and try again.');
        }
        console.error('Twilio setup error:', err);
      }
    }

    setup();

    return () => {
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, [identity]);

  const makeCall = async (toNumber, onCallEnd) => {
    if (!deviceRef.current) {
      setError('Call device not ready. Please refresh the page.');
      return;
    }

    // ✅ Re-check mic before every call attempt
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError('Microphone access denied. Please allow mic permission and try again.');
      return;
    }

    try {
      setError(null);
      setCallStatus('connecting');

      const call = await deviceRef.current.connect({
        params: { To: toNumber },
      });

      call.on('accept', () => setCallStatus('active'));

      call.on('disconnect', () => {
        setCallStatus('ended');
        if (onCallEnd) onCallEnd(call.parameters?.CallSid);
        setActiveCall(null);
      });

      call.on('error', (err) => {
        console.error('Call error:', err);
        setError(err.message);
        setCallStatus('idle');
        setActiveCall(null);
      });

      setActiveCall(call);
    } catch (err) {
      console.error('makeCall error:', err);
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

  return { callStatus, makeCall, hangUp, mute, error, ready };
}