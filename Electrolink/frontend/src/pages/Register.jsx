import { useState } from "react";
import "./Register.css";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { homePathFor } from "../utils/navigation";

function Register() {

  const navigate = useNavigate();

  const { register } = useAuth();

  // =====================================================
  // FORM DATA
  // =====================================================

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    company: "",
  });

  // =====================================================
  // UI STATES
  // =====================================================

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // =====================================================
  // HANDLE INPUT
  // =====================================================

  const handleChange = (e) => {

    const {
      name,
      value,
    } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    // Clear old messages while user is typing
    if (error) {
      setError("");
    }

    if (success) {
      setSuccess("");
    }
  };

  // =====================================================
  // HANDLE REGISTER
  // =====================================================

  const handleSubmit = async (e) => {

    e.preventDefault();

    setError("");
    setSuccess("");

    // ===================================================
    // FRONTEND VALIDATION
    // ===================================================

    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;
    const company = formData.company.trim();

    if (!name) {
      setError("Name is required.");
      return;
    }

    if (!email) {
      setError("Email is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    // ===================================================
    // START REQUEST
    // ===================================================

    setLoading(true);

    // ===================================================
    // CREATE THE ACCOUNT
    //
    // Everyone who signs up here is created as a buyer.
    // Administrator access is granted from the Manage Users
    // screen by an existing administrator.
    // ===================================================

    const result = await register({
      name,
      email,
      password,
      company,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setSuccess(
      "Account created successfully! Redirecting..."
    );

    setTimeout(() => {
      navigate(homePathFor(result.user), { replace: true });
    }, 700);
  };

  // =====================================================
  // UI
  // =====================================================

  return (

    <div className="register-page">

      <div className="register-card">

        <h1>
          Create Account
        </h1>

        <p className="register-subtitle">
          Create your account to get started
        </p>

        {/* =================================================
            ERROR
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
            SUCCESS
        ================================================= */}

        {success && (

          <div
            style={{
              color: "#15803d",
              backgroundColor: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "6px",
              padding: "12px",
              marginBottom: "16px",
              fontSize: "14px",
            }}
          >
            {success}
          </div>

        )}

        {/* =================================================
            REGISTER FORM
        ================================================= */}

        <form
          onSubmit={handleSubmit}
        >

          {/* NAME */}

          <div className="form-group">

            <label>
              Name
            </label>

            <input
              type="text"
              name="name"
              placeholder="Enter your name"
              value={formData.name}
              onChange={handleChange}
              disabled={loading}
              required
            />

          </div>

          {/* EMAIL */}

          <div className="form-group">

            <label>
              Email
            </label>

            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
              required
            />

          </div>

          {/* PASSWORD */}

          <div className="form-group">

            <label>
              Password
            </label>

            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              minLength={6}
              required
            />

          </div>

          {/* COMPANY */}

          <div className="form-group">

            <label>
              Company
            </label>

            <input
              type="text"
              name="company"
              placeholder="Enter your company"
              value={formData.company}
              onChange={handleChange}
              disabled={loading}
            />

          </div>

          {/* REGISTER BUTTON */}

          <button
            type="submit"
            disabled={loading}
          >

            {loading
              ? "Creating Account..."
              : "Register"}

          </button>

        </form>

        {/* =================================================
            LOGIN
        ================================================= */}

        <p className="login-text">

          Already have an account?

          <button
            type="button"
            onClick={() =>
              navigate("/login")
            }
            disabled={loading}
            style={{
              border: "none",
              background: "none",
              padding: 0,
              marginLeft: "5px",
              color: "#0066cc",
              cursor: "pointer",
              fontSize: "inherit",
            }}
          >
            Login
          </button>

        </p>

      </div>

    </div>

  );
}

export default Register;