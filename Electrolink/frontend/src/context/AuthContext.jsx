import { useCallback, useEffect, useMemo, useState } from "react";

import api, {
  TOKEN_KEY,
  USER_KEY,
  getErrorMessage,
} from "../services/api";

import { AuthContext } from "./useAuth";

/* =========================================================
   AUTHENTICATION CONTEXT

   Holds the signed in account for the whole application and
   exposes the single source of truth for the role, so that
   pages never have to read localStorage themselves.
========================================================= */

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);

    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  const [token, setToken] = useState(() =>
    localStorage.getItem(TOKEN_KEY),
  );

  /* "loading" stays true until the saved token has been
     checked against the backend, so a protected page never
     redirects before the session is known. */

  const [loading, setLoading] = useState(true);

  const saveSession = useCallback((nextToken, nextUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));

    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    setToken(null);
    setUser(null);
  }, []);

  /* -------------------------------------------------------
     VERIFY THE SAVED SESSION ON STARTUP
  ------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY);

      if (!savedToken) {
        if (!cancelled) {
          setLoading(false);
        }

        return;
      }

      try {
        const { data } = await api.get("/me");

        if (!cancelled && data?.user) {
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          setUser(data.user);
          setToken(savedToken);
        }
      } catch {
        if (!cancelled) {
          clearSession();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    verify();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  /* -------------------------------------------------------
     LOGIN
  ------------------------------------------------------- */

  const login = useCallback(
    async (email, password) => {
      try {
        const { data } = await api.post("/login", {
          email: String(email).trim().toLowerCase(),
          password,
        });

        if (!data?.token) {
          return {
            success: false,
            message:
              "Login succeeded but no authentication token was returned.",
          };
        }

        saveSession(data.token, data.user || null);

        return {
          success: true,
          user: data.user,
        };
      } catch (error) {
        return {
          success: false,
          message: getErrorMessage(error, "Invalid email or password."),
        };
      }
    },
    [saveSession],
  );

  /* -------------------------------------------------------
     REGISTER
  ------------------------------------------------------- */

  const register = useCallback(
    async (payload) => {
      try {
        const { data } = await api.post("/register", payload);

        if (!data?.token) {
          return {
            success: false,
            message:
              "Registration succeeded but no authentication token was returned.",
          };
        }

        saveSession(data.token, data.user || null);

        return {
          success: true,
          user: data.user,
        };
      } catch (error) {
        return {
          success: false,
          message: getErrorMessage(error, "Registration failed."),
        };
      }
    },
    [saveSession],
  );

  /* -------------------------------------------------------
     LOGOUT
  ------------------------------------------------------- */

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  /* -------------------------------------------------------
     REFRESH

     Used after the profile is edited in Settings so the name
     in the navbar updates straight away.
  ------------------------------------------------------- */

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get("/me");

      if (data?.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setUser(data.user);
      }
    } catch {
      /* A failed refresh must never sign the user out on its
         own: the response interceptor already handles a real
         session problem. */
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,

      isAuthenticated: Boolean(token && user),
      isAdmin: user?.role === "admin",

      login,
      register,
      logout,
      refreshUser,
    }),
    [user, token, loading, login, register, logout, refreshUser],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

