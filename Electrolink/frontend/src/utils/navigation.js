/* =========================================================
   NAVIGATION HELPERS
========================================================= */

/* The landing page of an account depends on its role: an
   administrator starts on the control panel, a buyer starts
   on the catalog. */

export function homePathFor(user) {
  return user?.role === "admin" ? "/dashboard" : "/catalog";
}
