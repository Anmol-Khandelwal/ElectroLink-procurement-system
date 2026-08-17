import axios from "axios";

/* =========================================================
   API CLIENT

   One axios instance for the whole application. It attaches
   the saved token to every request and signs the user out
   when the backend reports that the session is no longer
   valid.
========================================================= */

export const API_ORIGIN =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

export const TOKEN_KEY = "token";

export const USER_KEY = "user";

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

/* =========================================================
   REQUEST: ATTACH THE TOKEN
========================================================= */

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/* =========================================================
   RESPONSE: HANDLE EXPIRED SESSIONS

   A 401 means the token is gone or expired, so the local
   session is cleared and the user is sent back to the login
   page. A 403 is a role problem and is left to the page.
========================================================= */

api.interceptors.response.use(
  (response) => response,

  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);

      const path = window.location.pathname;

      const isPublicPage =
        path === "/" ||
        path === "/login" ||
        path === "/register" ||
        path === "/reset-password";

      if (!isPublicPage) {
        window.location.assign("/login?session=expired");
      }
    }

    return Promise.reject(error);
  },
);

/* =========================================================
   ERROR MESSAGE

   Turns any axios failure into a sentence that can be shown
   directly in the interface.
========================================================= */

export function getErrorMessage(error, fallback = "Something went wrong.") {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.request) {
    return "Cannot reach the ElectroLink backend. Make sure the server is running on port 5000.";
  }

  return error?.message || fallback;
}

/* =========================================================
   CURRENCY

   Every price in the application is shown in Indian rupees.
========================================================= */

export function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* =========================================================
   DATE
========================================================= */

export function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default api;
