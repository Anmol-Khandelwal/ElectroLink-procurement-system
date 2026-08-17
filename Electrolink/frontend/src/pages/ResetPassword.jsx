import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./ResetPassword.css";

const API_URL = "http://localhost:5000";

export default function ResetPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    if (!email.trim() || !newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.put(
        `${API_URL}/api/reset-password`,
        {
          email: email.trim().toLowerCase(),
          newPassword,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      setMessage(
        response.data?.message || "Password reset successfully."
      );

      setEmail("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      console.error("Reset password error:", err);

      if (err.response) {
        setError(
          err.response.data?.message ||
            "Unable to reset password."
        );
      } else if (err.request) {
        setError(
          "Cannot connect to the ElectroLink backend."
        );
      } else {
        setError("Password reset failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-page">
      <div className="reset-card">

        <div className="reset-header">
          <div className="reset-brand">
            <span className="reset-brand-icon">⚙️</span>
            <span>ElectroLink</span>
          </div>

          <h1>Reset Password</h1>

          <p>
            Enter your registered email and create a new password.
          </p>
        </div>

        {error && (
          <div className="reset-error">
            {error}
          </div>
        )}

        {message && (
          <div className="reset-success">
            {message}
          </div>
        )}

        <form onSubmit={handleReset}>

          <label>Corporate Email</label>

          <input
            type="email"
            placeholder="officer@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />

          <label>New Password</label>

          <input
            type="password"
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
            required
          />

          <label>Confirm New Password</label>

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(e.target.value)
            }
            disabled={loading}
            required
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading ? "RESETTING..." : "RESET PASSWORD"}
          </button>

        </form>

        <button
          type="button"
          className="back-login"
          onClick={() => navigate("/")}
          disabled={loading}
        >
          ← Back to Login
        </button>

      </div>
    </div>
  );
}