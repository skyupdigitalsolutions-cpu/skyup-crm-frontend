// src/data/teamStore.js
// ─────────────────────────────────────────────────────────────────────────────
// Team Lead info for the signed-in employee (GET /team/me), shared by the
// sidebar, routes and the My Team page. Refreshes on login change and when the
// server pushes `team_updated` (admin changed teams).
// ─────────────────────────────────────────────────────────────────────────────
import api from "./axiosConfig";
import { getUser } from "./sessionStore";

let _state = { loaded: false, isTeamLead: false, teamLead: null, members: [] };
const _subs = new Set();
let _inflight = null;

function setState(patch) {
  _state = { ..._state, ...patch };
  for (const fn of _subs) { try { fn(); } catch { /* ignore */ } }
}

export function subscribeTeam(fn) { _subs.add(fn); return () => _subs.delete(fn); }
export function getTeamState() { return _state; }

export async function loadTeamInfo(force = false) {
  const u = getUser();
  if (!u || u.role !== "user") {
    if (_state.loaded || _state.isTeamLead) setState({ loaded: true, isTeamLead: false, teamLead: null, members: [] });
    return _state;
  }
  if (!force && _state.loaded) return _state;
  if (_inflight) return _inflight;
  // Optimistic: login response already says whether this is a Team Lead.
  if (!_state.loaded && u.isTeamLead) setState({ isTeamLead: true });
  _inflight = api.get("/team/me")
    .then(({ data }) => {
      setState({ loaded: true, isTeamLead: !!data?.isTeamLead, teamLead: data?.teamLead || null, members: data?.members || [] });
      return _state;
    })
    .catch(() => { setState({ loaded: true }); return _state; })
    .finally(() => { _inflight = null; });
  return _inflight;
}

if (typeof window !== "undefined") {
  window.addEventListener("team_updated", () => { loadTeamInfo(true); });
  window.addEventListener("user_changed", () => {
    _state = { loaded: false, isTeamLead: false, teamLead: null, members: [] };
    for (const fn of _subs) { try { fn(); } catch { /* ignore */ } }
  });
}
