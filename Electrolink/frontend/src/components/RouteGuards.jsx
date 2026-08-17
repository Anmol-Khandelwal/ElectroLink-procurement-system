import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/useAuth";

import { homePathFor } from "../utils/navigation";

import "./RouteGuards.css";

/* =========================================================
   ROUTE GUARDS

   ProtectedRoute  any signed in account
   AdminRoute      administrators only
   PublicOnlyRoute login / register, hidden once signed in
========================================================= */

function SessionLoader() {
  return (
    <div className="route-loader">
      <div className="route-loader-spinner" />
      <p>Checking your session...</p>
    </div>
  );
}

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  const location = useLocation();

  if (loading) {
    return <SessionLoader />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return children;
}

export function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, loading, user } = useAuth();

  const location = useLocation();

  if (loading) {
    return <SessionLoader />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (!isAdmin) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  return children;
}

export function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <SessionLoader />;
  }

  if (isAuthenticated) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  return children;
}
