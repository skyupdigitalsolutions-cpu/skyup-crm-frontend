// frontend/src/hooks/useDailyReport.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralized hook for fetching daily report data from the backend.
// All report pages (admin DailyReport, user UserDailyReport) MUST use
// this hook so they share identical data — no more front-end aggregation.
//
// Features:
//   - loading / error state
//   - IST-aligned date filter (passed as ?date=YYYY-MM-DD)
//   - auto-refresh every 5 minutes when viewing today
//   - manual refresh via refresh()
//   - optional userId filter (user dashboard passes own id)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../data/axiosConfig';

// Convert a JS Date to an IST YYYY-MM-DD string for the query param
function toISTDateString(date) {
  const IST_OFFSET = 5.5 * 60 * 60 * 1000;
  const ist = new Date(date.getTime() + IST_OFFSET);
  return ist.toISOString().slice(0, 10);
}

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

/**
 * @param {object}  options
 * @param {Date}    options.date       - selected date (defaults to today)
 * @param {string}  [options.userId]   - restrict to one employee (user dashboard)
 * @param {string}  [options.campaign] - optional campaign filter
 * @param {string}  [options.status]   - optional status filter
 */
export function useDailyReport({ date, userId, campaign, status } = {}) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const timerRef  = useRef(null);
  const abortRef  = useRef(null);

  // Determine if user is viewing today (IST)
  const today       = new Date();
  const viewDate    = date instanceof Date ? date : today;
  const isToday     = toISTDateString(viewDate) === toISTDateString(today);
  const dateParam   = toISTDateString(viewDate);

  const fetchReport = useCallback(async (silent = false) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller  = new AbortController();
    abortRef.current  = controller;

    if (!silent) setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ date: dateParam });
      if (userId)   params.set('userId',   userId);
      if (campaign) params.set('campaign', campaign);
      if (status)   params.set('status',   status);

      const res = await api.get(`/reports/daily?${params.toString()}`, {
        signal: controller.signal,
      });

      setData(res.data);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError(err.response?.data?.message || 'Failed to load report. Please try again.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [dateParam, userId, campaign, status]);

  // Initial fetch + date / filter changes
  useEffect(() => {
    fetchReport(false);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchReport]);

  // Auto-refresh when viewing today
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isToday) {
      timerRef.current = setInterval(() => fetchReport(true), AUTO_REFRESH_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isToday, fetchReport]);

  return {
    data,
    loading,
    error,
    refresh: () => fetchReport(false),
    isToday,
    dateParam,
  };
}
