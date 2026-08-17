import { createContext, useContext } from "react";

/* =========================================================
   CART CONTEXT OBJECT AND HOOK

   Kept apart from CartContext.jsx for the same reason as the
   auth context: the provider file exports a component only.
========================================================= */

export const CartContext = createContext(null);

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside a CartProvider");
  }

  return context;
}
