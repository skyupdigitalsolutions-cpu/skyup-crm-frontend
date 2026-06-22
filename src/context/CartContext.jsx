// src/context/CartContext.jsx
// Global cart state for the Plan + Add-ons checkout flow.
//
// Cart items:
//   { type: "plan",  planId, planName, billing, price }
//   { type: "addon", addonType, addonName, quantity, autoRenew,
//                    billingPeriod, price, category, renewalMode }
//
// Only ONE plan item allowed at a time (replacing on re-add).
// Multiple addon types allowed; incrementing qty updates the existing row.

import { createContext, useContext, useReducer, useCallback } from "react";

const CartContext = createContext(null);

function cartReducer(state, action) {
  switch (action.type) {

    case "SET_PLAN": {
      // Remove any existing plan, then add the new one
      const withoutPlan = state.filter(i => i.type !== "plan");
      if (!action.item) return withoutPlan;   // SET_PLAN(null) = clear plan
      return [action.item, ...withoutPlan];
    }

    case "ADD_ADDON": {
      const existing = state.find(
        i => i.type === "addon" && i.addonType === action.item.addonType
      );
      if (existing) {
        // Update qty + autoRenew on existing row
        return state.map(i =>
          i.type === "addon" && i.addonType === action.item.addonType
            ? { ...i, quantity: action.item.quantity, autoRenew: action.item.autoRenew, price: action.item.price }
            : i
        );
      }
      return [...state, action.item];
    }

    case "REMOVE_ADDON":
      return state.filter(i => !(i.type === "addon" && i.addonType === action.addonType));

    case "UPDATE_ADDON_QTY": {
      return state.map(i =>
        i.type === "addon" && i.addonType === action.addonType
          ? { ...i, quantity: action.quantity, price: action.unitPrice * action.quantity }
          : i
      );
    }

    case "CLEAR":
      return [];

    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, []);

  const setPlan = useCallback((item) => dispatch({ type: "SET_PLAN", item }), []);
  const clearPlan = useCallback(() => dispatch({ type: "SET_PLAN", item: null }), []);

  const addAddon = useCallback((item) => dispatch({ type: "ADD_ADDON", item }), []);
  const removeAddon = useCallback((addonType) => dispatch({ type: "REMOVE_ADDON", addonType }), []);
  const updateAddonQty = useCallback((addonType, quantity, unitPrice) =>
    dispatch({ type: "UPDATE_ADDON_QTY", addonType, quantity, unitPrice }), []);

  const clearCart = useCallback(() => dispatch({ type: "CLEAR" }), []);

  const planItem   = items.find(i => i.type === "plan")   || null;
  const addonItems = items.filter(i => i.type === "addon");
  const totalItems = items.length;
  const totalPrice = items.reduce((s, i) => s + (i.price || 0), 0);

  return (
    <CartContext.Provider value={{
      items, planItem, addonItems, totalItems, totalPrice,
      setPlan, clearPlan,
      addAddon, removeAddon, updateAddonQty,
      clearCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
