// src/hooks/useCustomization.js
// React access to the company's customization (Customize CRM).
//
//   const { c, loaded, canEdit, statusLabel, ... } = useCustomization();
//
// Components re-render automatically when the config loads or is saved.
import { useEffect, useSyncExternalStore } from "react";
import * as store from "../data/customizationStore";

export default function useCustomization() {
  const state = useSyncExternalStore(store.subscribeCustomization, store.getCustomizationState, store.getCustomizationState);

  useEffect(() => {
    if (!state.loaded && !state.loading) store.loadCustomization();
  }, [state.loaded, state.loading]);

  const c = state.customization;
  return {
    c,
    customization: c,
    loaded: state.loaded,
    loading: state.loading,
    canEdit: state.canEdit,
    reload: () => store.loadCustomization(true),
    // helpers bound to the current config
    findStatus:        (v) => store.findStatus(v, c),
    statusLabel:       (v) => store.statusLabel(v, c),
    statusCategory:    (v) => store.statusCategory(v, c),
    statusKeysByCategory: (cats, opts) => store.statusKeysByCategory(cats, c, opts),
    defaultStatusKey:  () => store.defaultStatusKey(c),
    employeeStatuses:  () => store.employeeStatuses(c),
    activeStatuses:    () => store.activeStatuses(c),
    pipelineStatuses:  () => store.pipelineStatuses(c),
    findOutcome:       (v) => store.findOutcome(v, c),
    outcomeLabel:      (v) => store.outcomeLabel(v, c),
    activeOutcomes:    () => store.activeOutcomes(c),
    findTemperature:   (v) => store.findTemperature(v, c),
    activeTemperatures: () => store.activeTemperatures(c),
    coldTemperatureKey: () => store.coldTemperatureKey(c),
    list:              (name) => store.list(name, c),
    isModuleOn:        (k) => store.isModuleOn(k, c),
    moduleVisibleFor:  (k, role) => store.moduleVisibleFor(k, role, c),
    moduleLabel:       (k, fb) => store.moduleLabel(k, fb, c),
    can:               (perm, role) => store.can(perm, role, c),
    term:              (k, fb) => store.term(k, fb, c),
    leadField:         (k) => store.leadField(k, c),
    customFields:      (opts) => store.activeCustomFields(c, opts),
  };
}
