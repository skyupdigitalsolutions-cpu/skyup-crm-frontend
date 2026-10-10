// src/marketing/mkt/useReport.js
// Fetch a v2 report with the global filters. Re-fetches when filters change or
// the user presses Refresh (refresh=1 bypasses the server cache once).
import { useCallback, useEffect, useRef, useState } from "react";
import mktApi from "../mktApi";
import { useMkt } from "./ui";

export default function useReport(path, extra, opts = {}) {
  const { params, refreshKey, forceRefresh } = useMkt();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const extraKey = JSON.stringify(extra || {});
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (opts.skip) return;
    const id = ++seq.current;
    setLoading(true); setError("");
    try {
      const q = { ...params, ...(extra || {}) };
      if (forceRefresh.current) q.refresh = "1";
      const { data: d } = await mktApi.get(path, { params: q, timeout: opts.timeout || 120000 });
      if (id === seq.current) setData(d);
    } catch (e) {
      if (id === seq.current) setError(e?.response?.data?.message || (e.code === "ECONNABORTED" ? "The report took too long — try a shorter date range." : "Couldn't load this report."));
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, JSON.stringify(params), extraKey, refreshKey, opts.skip]);

  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load };
}
