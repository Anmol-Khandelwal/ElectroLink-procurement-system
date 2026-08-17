import { useState } from "react";
import "./Login.css";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import loginBg from "../assets/login-bg.jpg";

import { useAuth } from "../context/useAuth";
import { homePathFor } from "../utils/navigation";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [searchParams] = useSearchParams();

  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(
    searchParams.get("session") === "expired"
      ? "Your session has expired. Please sign in again."
      : "",
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    // Basic validation
    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);

    const result = await login(email, password);

    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    // =====================================================
    // WHERE THE ACCOUNT LANDS
    //
    // An administrator goes to the control panel, a buyer
    // goes to the catalog. If the visitor was sent here from
    // a protected page, they return to it instead.
    // =====================================================

    const requestedPath = location.state?.from;

    navigate(requestedPath || homePathFor(result.user), { replace: true });
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* =================================================
            LEFT PANEL
        ================================================= */}

        <div
          className="login-hero"
          style={{
            backgroundImage: `url(${loginBg})`,
          }}
        >
          <div className="login-hero-overlay"></div>

          <div className="login-hero-content">
            <div className="login-brand">
              <span className="login-brand-icon">⚙️</span>

              <span className="login-brand-name">ElectroLink</span>
            </div>

            <p className="login-tagline">
              Advanced Procurement & Inventory Control Systems for Industrial
              Electronics.
            </p>
          </div>

          <div className="login-hero-footer">
            <div className="login-status">
              <span className="status-dot"></span>
              SYSTEM STATUS
              <br />
              <span className="status-text">All Systems Operational</span>
            </div>

            <div className="login-secure">
              🔒 Secure Connection
              <br />
              <span className="secure-text">AES-256 Encrypted</span>
            </div>
          </div>
        </div>

        {/* =================================================
            RIGHT PANEL
        ================================================= */}

        <div className="login-form-panel">
          <div className="login-form-wrapper">
            <h1 className="login-title">Client Authentication</h1>

            <p className="login-subtitle">
              Enter your credentials to access the procurement portal.
            </p>

            {/* =================================================
                ERROR MESSAGE
            ================================================= */}

            {error && (
              <div
                style={{
                  color: "#dc2626",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "6px",
                  padding: "12px",
                  marginBottom: "16px",
                  fontSize: "14px",
                }}
              >
                {error}
              </div>
            )}

            {/* =================================================
                LOGIN FORM
            ================================================= */}

            <form className="login-form" onSubmit={handleSubmit}>
              <label className="login-label">Corporate Email</label>

              <input
                className="login-input"
                type="email"
                placeholder="officer@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />

              <div className="login-label-row">
                <label className="login-label">Password</label>

                <button
  type="button"
  className="login-link"
  onClick={() => navigate("/reset-password")}
  disabled={loading}
  style={{
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
  }}
>
  Reset Password?
</button>
              </div>

              <input
                className="login-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />

              <button className="login-submit" type="submit" disabled={loading}>
                {loading ? "Authenticating..." : "AUTHENTICATE"}

                <span className="login-submit-icon">➜</span>
              </button>
            </form>

            <div className="login-divider"></div>

            <p className="login-register-prompt">New procurement entity?</p>

            <button
              type="button"
              className="login-register-btn"
              onClick={() => navigate("/register")}
              disabled={loading}
            >
              REGISTER ORGANIZATION
            </button>
          </div>

          <div className="login-footer-links">
            <button
              type="button"
              onClick={() =>
                setError("Terms of Service page is not configured yet.")
              }
            >
              Terms of Service
            </button>

            <button
              type="button"
              className="privacy-link"
              onClick={() =>
                setError("Privacy Policy page is not configured yet.")
              }
            >
              Privacy Policy
            </button>

            <button
              type="button"
              onClick={() =>
                setError("Technical Support page is not configured yet.")
              }
            >
              Technical Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
