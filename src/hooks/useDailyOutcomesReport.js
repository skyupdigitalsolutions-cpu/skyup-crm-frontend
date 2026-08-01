// frontend/src/hooks/useDailyOutcomesReport.js
// ─────────────────────────────────────────────────────────────────────────────
// Fetches the Answered / Not Answered / Busy / etc. call-outcome breakdown for
// a given IST day from /api/reports/daily-outcomes. Mirrors useDailyReport.js
// exactly (same date param shape, same auto-refresh behavior) so both hooks
// can share the same date picker in DailyReport.jsx.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../data/axiosConfig';

function toISTDateString(date) {
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const ist = new Date(date.getTime() + IST_OFFSET);
  return ist.toISOString().slice(0, 10);
}

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

/**
 * @param {object}  options
 * @param {Date}    options.date     - selected date (defaults to today)
 * @param {string}  [options.userId] - restrict to one employee
 * @param {boolean} [options.enabled=true] - skip fetching entirely when false
 *   (pass hasFeature('callOutcomesReport') here — avoids a guaranteed 403 for
 *   companies this feature hasn't been rolled out to)
 */
export function useDailyOutcomesReport({ date, userId, enabled = true } = {}) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(!!enabled);
  const [error,   setError]   = useState('');

  const timerRef = useRef(null);
  const abortRef = useRef(null);

  const today     = new Date();
  const viewDate  = date instanceof Date ? date : today;
  const isToday   = toISTDateString(viewDate) === toISTDateString(today);
  const dateParam = toISTDateString(viewDate);

  const fetchReport = useCallback(async (silent = false) => {
    if (!enabled) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ date: dateParam });
      if (userId) params.set('userId', userId);

      const res = await api.get(`/reports/daily-outcomes?${params.toString()}`, {
        signal: controller.signal,
      });

      setData(res.data);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError(err.response?.data?.message || 'Failed to load call outcomes. Please try again.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [dateParam, userId, enabled]);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    fetchReport(false);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchReport, enabled]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (enabled && isToday) {
      timerRef.current = setInterval(() => fetchReport(true), AUTO_REFRESH_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isToday, fetchReport, enabled]);

  return {
    data,
    loading,
    error,
    refresh: () => fetchReport(false),
    isToday,
    dateParam,
  };
}
