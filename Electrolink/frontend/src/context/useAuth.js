import { createContext, useContext } from "react";

/* =========================================================
   AUTH CONTEXT OBJECT AND HOOK

   These live outside AuthContext.jsx so that the provider
   file only exports a component, which is what React fast
   refresh expects.
========================================================= */

export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return context;
}
