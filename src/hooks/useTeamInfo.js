// src/hooks/useTeamInfo.js — { loaded, isTeamLead, teamLead, members, reload }
import { useEffect, useSyncExternalStore } from "react";
import { subscribeTeam, getTeamState, loadTeamInfo } from "../data/teamStore";

export default function useTeamInfo() {
  const s = useSyncExternalStore(subscribeTeam, getTeamState, getTeamState);
  useEffect(() => { if (!s.loaded) loadTeamInfo(); }, [s.loaded]);
  return { ...s, reload: () => loadTeamInfo(true) };
}
