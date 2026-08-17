import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import Header from "../components/Header";
import Footer from "../components/Footer";

import {
  Package,
  FileText,
  UserCircle,
  Building2,
  Bell,
  Shield,
  Lock,
  Save,
  Mail,
  Phone,
  MapPin,
  ChevronDown,
  LogOut,
  ShoppingBag,
  Users as UsersIcon,
  BarChart3,
  Settings as SettingsIcon,
} from "lucide-react";

import { useAuth } from "../context/useAuth";

import "./Settings.css";

const API_URL = "http://localhost:5000";

const TABS = ["profile", "company", "notifications", "security"];

export default function Settings() {
  const photoInputRef = useRef(null);

  const navigate = useNavigate();

  const [searchParams, setSearchParams] = useSearchParams();

  const { isAdmin, logout, refreshUser } = useAuth();

  /* The account menu in the navbar can open a specific tab
     through ?tab=company. */

  const [activeTab, setActiveTab] = useState(() => {
    const requested = searchParams.get("tab");

    return TABS.includes(requested) ? requested : "profile";
  });

  const [profilePhoto, setProfilePhoto] = useState(() => {
    try {
      return localStorage.getItem("electrolink_profile_photo") || "";
    } catch {
      return "";
    }
  });

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  // =====================================================
  // PROFILE
  // =====================================================

  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "",
  });

  // =====================================================
  // COMPANY
  // =====================================================

  const [company, setCompany] = useState({
    companyName: "",
    industry: "Electronics",
    companySize: "201-500",
    businessAddress: "",
    city: "",
    country: "India",
  });

  // =====================================================
  // NOTIFICATIONS
  // =====================================================

  const [notifications, setNotifications] = useState({
    email: true,
    order: true,
    stock: true,
    rfq: false,
  });

  // =====================================================
  // PASSWORD
  // =====================================================

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // =====================================================
  // TOKEN
  // =====================================================

  const getToken = () => {
    return localStorage.getItem("token");
  };

  // =====================================================
  // COMMON API FUNCTION
  // =====================================================

  const apiRequest = async (endpoint, options = {}) => {
    const token = getToken();

    if (!token) {
      throw new Error("You are not logged in. Please login again.");
    }

    let response;

    try {
      response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
    } catch (networkError) {
      console.error("Network error:", networkError);
      throw new Error(
        "Cannot connect to the backend. Make sure the ElectroLink server is running on http://localhost:5000.",
        { cause: networkError }
      );
    }

    const text = await response.text();

    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      throw new Error(
        "Backend returned an invalid response. Check that the backend is running on port 5000.",
        { cause: parseError }
      );
    }

    if (response.status === 401) {
      localStorage.removeItem("token");
      throw new Error("Your session has expired. Please login again.");
    }

    if (!response.ok) {
      throw new Error(
        data.message || `Request failed with status ${response.status}`
      );
    }

    return data;
  };

  // =====================================================
  // LOAD PROFILE
  // =====================================================

  const fetchProfile = async () => {
    try {
      setError("");

      try {
        const data = await apiRequest("/api/settings/profile");
        if (data.profile) {
          setProfile({
            firstName: data.profile.firstName || "",
            lastName: data.profile.lastName || "",
            email: data.profile.email || "",
            phone: data.profile.phone || "",
            role: data.profile.role || "user",
          });
          return;
        }
      } catch (profileError) {
        console.warn("Profile endpoint failed; trying /api/me", profileError);
      }

      const data = await apiRequest("/api/me");
      const user = data.user || {};
      const parts = String(user.name || "User").trim().split(/\s+/);

      setProfile({
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" ") || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.role || "user",
      });
    } catch (error) {
      console.error("Profile API error:", error);
      setError(error.message || "Failed to fetch profile");
    }
  };

  // =====================================================
  // LOAD COMPANY
  // =====================================================

  const fetchCompany = async () => {
    try {
      setError("");

      const data = await apiRequest(
        "/api/settings/company"
      );

      if (data.company) {
        setCompany({
          companyName:
            data.company.companyName || "",

          industry:
            data.company.industry ||
            "Electronics",

          companySize:
            data.company.companySize ||
            "201-500",

          businessAddress:
            data.company.businessAddress || "",

          city:
            data.company.city || "",

          country:
            data.company.country || "India",
        });
      }
    } catch (error) {
      console.error(
        "Company API error:",
        error
      );

      setError(
        error.message ||
          "Failed to fetch company information"
      );
    }
  };

  // =====================================================
  // LOAD NOTIFICATIONS
  // =====================================================

  const fetchNotifications = async () => {
    try {
      setError("");

      const data = await apiRequest(
        "/api/settings/notifications"
      );

      if (data.notifications) {
        setNotifications({
          email:
            Boolean(data.notifications.email),

          order:
            Boolean(data.notifications.order),

          stock:
            Boolean(data.notifications.stock),

          rfq:
            Boolean(data.notifications.rfq),
        });
      }
    } catch (error) {
      console.error(
        "Notification API error:",
        error
      );

      setError(
        error.message ||
          "Failed to fetch notification settings"
      );
    }
  };

  // =====================================================
  // LOAD DATA WHEN TAB CHANGES
  // =====================================================

  useEffect(() => {
    if (!getToken()) {
      setError(
        "You are not logged in. Please login again."
      );

      return;
    }

    if (activeTab === "profile") {
      fetchProfile();
    }

    if (activeTab === "company") {
      fetchCompany();
    }

    if (activeTab === "notifications") {
      fetchNotifications();
    }

    if (activeTab === "security") {
      setError("");
    }
  }, [activeTab]);

  // =====================================================
  // PROFILE INPUT
  // =====================================================

  const handleProfileChange = (e) => {
    const { name, value } = e.target;

    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =====================================================
  // COMPANY INPUT
  // =====================================================

  const handleCompanyChange = (e) => {
    const { name, value } = e.target;

    setCompany((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =====================================================
  // PASSWORD INPUT
  // =====================================================

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;

    setPasswords((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =====================================================
  // SAVE PROFILE
  // =====================================================

  const saveProfile = async () => {
    setError("");
    setSuccess("");

    if (!profile.firstName.trim() || !profile.lastName.trim() || !profile.email.trim()) {
      setError("First name, last name and email are required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) {
      setError("Please enter a valid email address");
      return;
    }

    try {
      setLoading(true);

      const data = await apiRequest(
        "/api/settings/profile",
        {
          method: "PUT",

          body: JSON.stringify({
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            phone: profile.phone,
          }),
        }
      );

      const updatedProfile = data.profile || profile;
      setProfile((current) => ({
        ...current,
        firstName: updatedProfile.firstName ?? current.firstName,
        lastName: updatedProfile.lastName ?? current.lastName,
        email: updatedProfile.email ?? current.email,
        phone: updatedProfile.phone ?? current.phone,
        role: updatedProfile.role ?? current.role,
      }));

      /* Refresh the signed in account so the navbar shows
         the new name straight away. */

      await refreshUser();

      setSuccess(
        data.message ||
          "Profile updated successfully"
      );
    } catch (error) {
      console.error(
        "Save profile error:",
        error
      );

      setError(
        error.message ||
          "Failed to update profile"
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // SAVE COMPANY
  // =====================================================

  const saveCompany = async () => {
    try {
      setLoading(true);

      setError("");
      setSuccess("");

      if (!company.companyName.trim()) {
        setError("Company name is required");
        return;
      }

      const data = await apiRequest(
        "/api/settings/company",
        {
          method: "PUT",

          body: JSON.stringify(company),
        }
      );

      if (data.company) {
        setCompany({
          companyName: data.company.companyName ?? company.companyName,
          industry: data.company.industry ?? company.industry,
          companySize: data.company.companySize ?? company.companySize,
          businessAddress: data.company.businessAddress ?? company.businessAddress,
          city: data.company.city ?? company.city,
          country: data.company.country ?? company.country,
        });
      }

      setSuccess(
        data.message ||
          "Company information updated successfully"
      );
    } catch (error) {
      console.error(
        "Save company error:",
        error
      );

      setError(
        error.message ||
          "Failed to update company information"
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // SAVE NOTIFICATIONS
  // =====================================================

  const saveNotifications = async () => {
    try {
      setLoading(true);

      setError("");
      setSuccess("");

      const data = await apiRequest(
        "/api/settings/notifications",
        {
          method: "PUT",

          body: JSON.stringify(
            notifications
          ),
        }
      );

      if (data.notifications) {
        setNotifications({
          email: Boolean(data.notifications.email),
          order: Boolean(data.notifications.order),
          stock: Boolean(data.notifications.stock),
          rfq: Boolean(data.notifications.rfq),
        });
      }

      setSuccess(
        data.message ||
          "Notification settings updated successfully"
      );
    } catch (error) {
      console.error(
        "Save notifications error:",
        error
      );

      setError(
        error.message ||
          "Failed to update notification settings"
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // UPDATE PASSWORD
  // =====================================================

  const updatePassword = async () => {
    try {
      setLoading(true);

      setError("");
      setSuccess("");

      if (
        !passwords.currentPassword ||
        !passwords.newPassword ||
        !passwords.confirmPassword
      ) {
        setError(
          "Please fill all password fields"
        );

        return;
      }

      if (passwords.newPassword.length < 6) {
        setError("New password must contain at least 6 characters");
        return;
      }

      if (
        passwords.newPassword !==
        passwords.confirmPassword
      ) {
        setError(
          "New passwords do not match"
        );

        return;
      }

      const data = await apiRequest(
        "/api/settings/password",
        {
          method: "PUT",

          body: JSON.stringify(
            passwords
          ),
        }
      );

      setSuccess(
        data.message ||
          "Password updated successfully"
      );

      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error(
        "Password update error:",
        error
      );

      setError(
        error.message ||
          "Failed to update password"
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // TOGGLE NOTIFICATION
  // =====================================================

  const toggleNotification = (name) => {
    setNotifications((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  // =====================================================
  // CLEAR MESSAGES
  // =====================================================

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Profile photo must be smaller than 2 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setProfilePhoto(result);
      try {
        localStorage.setItem("electrolink_profile_photo", result);
      } catch (storageError) {
        console.warn("Could not persist profile photo", storageError);
      }
      setSuccess("Profile photo updated");
      setError("");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const changeTab = (tab) => {
    setActiveTab(tab);
    setError("");
    setSuccess("");

    const next = new URLSearchParams(searchParams);

    if (tab === "profile") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }

    setSearchParams(next, { replace: true });
  };

  return (
    <div className="settings-page">

      <Header />

      <div className="el-body">

        {/* The control panel sidebar belongs to the
            administrator area only. */}

        {isAdmin && (
        <aside className="el-sidebar">
          <div className="el-sidebar-header">
            <h2>Admin Dashboard</h2>
            <p>Procurement Control</p>
          </div>
          <nav className="el-sidebar-nav">
            <Link to="/dashboard" className="el-sidebar-link"><BarChart3 size={18} /><span>Analytics</span></Link>
            <Link to="/products" className="el-sidebar-link"><Package size={18} /><span>Products</span></Link>
            <Link to="/orders" className="el-sidebar-link"><ShoppingBag size={18} /><span>Orders</span></Link>
            <Link to="/requests" className="el-sidebar-link"><FileText size={18} /><span>Requests</span></Link>
            <Link to="/users" className="el-sidebar-link"><UsersIcon size={18} /><span>Users</span></Link>
            <Link to="/settings" className="el-sidebar-link el-sidebar-link--active"><SettingsIcon size={18} /><span>Settings</span></Link>
          </nav>
        </aside>
        )}

        <main className="settings-main">

      {/* =================================================
          PAGE HEADER
      ================================================= */}

      <div className="settings-heading">

        <div>

          <h1>
            Settings
          </h1>

          <p>
            Manage your account, company and
            notification preferences.
          </p>

        </div>

        <button
          type="button"
          className="settings-logout-btn"
          onClick={handleLogout}
        >
          <LogOut size={15} />
          Logout
        </button>

      </div>

      {/* =================================================
          ERROR
      ================================================= */}

      {error && (
        <div className="settings-error">
          {error}
        </div>
      )}

      {/* =================================================
          SUCCESS
      ================================================= */}

      {success && (
        <div className="settings-success">
          {success}
        </div>
      )}

      {/* =================================================
          SETTINGS LAYOUT
      ================================================= */}

      <div className="settings-layout">

        {/* =================================================
            SETTINGS MENU
        ================================================= */}

        <aside className="settings-menu">

          <button
            type="button"
            className={`settings-menu-item ${
              activeTab === "profile"
                ? "settings-menu-item--active"
                : ""
            }`}
            onClick={() =>
              changeTab("profile")
            }
          >

            <UserCircle size={17} />

            <div>

              <strong>
                Profile
              </strong>

              <span>
                Personal information
              </span>

            </div>

          </button>

          <button
            type="button"
            className={`settings-menu-item ${
              activeTab === "company"
                ? "settings-menu-item--active"
                : ""
            }`}
            onClick={() =>
              changeTab("company")
            }
          >

            <Building2 size={17} />

            <div>

              <strong>
                Company
              </strong>

              <span>
                Company information
              </span>

            </div>

          </button>

          <button
            type="button"
            className={`settings-menu-item ${
              activeTab === "notifications"
                ? "settings-menu-item--active"
                : ""
            }`}
            onClick={() =>
              changeTab("notifications")
            }
          >

            <Bell size={17} />

            <div>

              <strong>
                Notifications
              </strong>

              <span>
                Email preferences
              </span>

            </div>

          </button>

          <button
            type="button"
            className={`settings-menu-item ${
              activeTab === "security"
                ? "settings-menu-item--active"
                : ""
            }`}
            onClick={() =>
              changeTab("security")
            }
          >

            <Shield size={17} />

            <div>

              <strong>
                Security
              </strong>

              <span>
                Password & security
              </span>

            </div>

          </button>

        </aside>

        {/* =================================================
            SETTINGS CONTENT
        ================================================= */}

        <section className="settings-content">

          {/* =================================================
              PROFILE
          ================================================= */}

          {activeTab === "profile" && (

            <div className="settings-card">

              <div className="settings-card-header">

                <div>

                  <h2>
                    Profile Information
                  </h2>

                  <p>
                    Update your personal account
                    information.
                  </p>

                </div>

              </div>

              <div className="profile-section">

                <div className="profile-avatar">

                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt="Profile"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: "50%",
                      }}
                    />
                  ) : (
                    <UserCircle size={42} />
                  )}

                </div>

                <div>

                  <h3>
                    {profile.firstName ||
                      "User"}{" "}
                    {profile.lastName}
                  </h3>

                  <p>
                    {profile.role ||
                      "Procurement Administrator"}
                  </p>

                  <button
                    className="change-photo-btn"
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    Change photo
                  </button>

                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    style={{ display: "none" }}
                  />

                </div>

              </div>

              <div className="settings-form">

                <div className="settings-form-row">

                  <div className="settings-field">

                    <label>
                      FIRST NAME
                    </label>

                    <input
                      type="text"
                      name="firstName"
                      value={
                        profile.firstName
                      }
                      onChange={
                        handleProfileChange
                      }
                    />

                  </div>

                  <div className="settings-field">

                    <label>
                      LAST NAME
                    </label>

                    <input
                      type="text"
                      name="lastName"
                      value={
                        profile.lastName
                      }
                      onChange={
                        handleProfileChange
                      }
                    />

                  </div>

                </div>

                <div className="settings-field">

                  <label>
                    EMAIL ADDRESS
                  </label>

                  <div className="settings-input-icon">

                    <Mail size={15} />

                    <input
                      type="email"
                      name="email"
                      value={
                        profile.email
                      }
                      onChange={
                        handleProfileChange
                      }
                    />

                  </div>

                </div>

                <div className="settings-field">

                  <label>
                    PHONE NUMBER
                  </label>

                  <div className="settings-input-icon">

                    <Phone size={15} />

                    <input
                      type="text"
                      name="phone"
                      value={
                        profile.phone
                      }
                      onChange={
                        handleProfileChange
                      }
                    />

                  </div>

                </div>

                <div className="settings-field">

                  <label>
                    ROLE
                  </label>

                  <div className="settings-input-icon">

                    <UserCircle size={15} />

                    <input
                      type="text"
                      value={
                        profile.role ||
                        "Procurement Administrator"
                      }
                      readOnly
                    />

                  </div>

                </div>

              </div>

              <div className="settings-card-footer">

                <button
                  type="button"
                  className="save-settings-btn"
                  onClick={saveProfile}
                  disabled={loading}
                >

                  <Save size={15} />

                  {loading
                    ? "Saving..."
                    : "Save Changes"}

                </button>

              </div>

            </div>
          )}

          {/* =================================================
              COMPANY
          ================================================= */}

          {activeTab === "company" && (

            <div className="settings-card">

              <div className="settings-card-header">

                <div>

                  <h2>
                    Company Information
                  </h2>

                  <p>
                    Manage your organization
                    details.
                  </p>

                </div>

              </div>

              <div className="settings-form">

                <div className="settings-field">

                  <label>
                    COMPANY NAME
                  </label>

                  <div className="settings-input-icon">

                    <Building2 size={15} />

                    <input
                      type="text"
                      name="companyName"
                      value={
                        company.companyName
                      }
                      onChange={
                        handleCompanyChange
                      }
                    />

                  </div>

                </div>

                <div className="settings-form-row">

                  <div className="settings-field">

                    <label>
                      INDUSTRY
                    </label>

                    <div className="settings-select">

                      <select
                        name="industry"
                        value={
                          company.industry
                        }
                        onChange={
                          handleCompanyChange
                        }
                      >

                        <option>
                          Manufacturing
                        </option>

                        <option>
                          Electronics
                        </option>

                        <option>
                          Automotive
                        </option>

                        <option>
                          Industrial
                        </option>

                        <option>
                          Technology
                        </option>

                      </select>

                      <ChevronDown size={15} />

                    </div>

                  </div>

                  <div className="settings-field">

                    <label>
                      COMPANY SIZE
                    </label>

                    <div className="settings-select">

                      <select
                        name="companySize"
                        value={
                          company.companySize
                        }
                        onChange={
                          handleCompanyChange
                        }
                      >

                        <option>
                          1-50
                        </option>

                        <option>
                          51-200
                        </option>

                        <option>
                          201-500
                        </option>

                        <option>
                          501-1000
                        </option>

                        <option>
                          1000+
                        </option>

                      </select>

                      <ChevronDown size={15} />

                    </div>

                  </div>

                </div>

                <div className="settings-field">

                  <label>
                    BUSINESS ADDRESS
                  </label>

                  <div className="settings-input-icon">

                    <MapPin size={15} />

                    <input
                      type="text"
                      name="businessAddress"
                      value={
                        company.businessAddress
                      }
                      onChange={
                        handleCompanyChange
                      }
                    />

                  </div>

                </div>

                <div className="settings-form-row">

                  <div className="settings-field">

                    <label>
                      CITY
                    </label>

                    <input
                      type="text"
                      name="city"
                      value={
                        company.city
                      }
                      onChange={
                        handleCompanyChange
                      }
                    />

                  </div>

                  <div className="settings-field">

                    <label>
                      COUNTRY
                    </label>

                    <div className="settings-select">

                      <select
                        name="country"
                        value={
                          company.country
                        }
                        onChange={
                          handleCompanyChange
                        }
                      >

                        <option>
                          India
                        </option>

                        <option>
                          United States
                        </option>

                        <option>
                          United Kingdom
                        </option>

                        <option>
                          Germany
                        </option>

                      </select>

                      <ChevronDown size={15} />

                    </div>

                  </div>

                </div>

              </div>

              <div className="settings-card-footer">

                <button
                  type="button"
                  className="save-settings-btn"
                  onClick={saveCompany}
                  disabled={loading}
                >

                  <Save size={15} />

                  {loading
                    ? "Saving..."
                    : "Save Changes"}

                </button>

              </div>

            </div>
          )}

          {/* =================================================
              NOTIFICATIONS
          ================================================= */}

          {activeTab === "notifications" && (

            <div className="settings-card">

              <div className="settings-card-header">

                <div>

                  <h2>
                    Notification Preferences
                  </h2>

                  <p>
                    Choose what notifications you
                    want to receive.
                  </p>

                </div>

              </div>

              <div className="notification-list">

                <div className="notification-item">

                  <div className="notification-icon">

                    <Mail size={17} />

                  </div>

                  <div className="notification-info">

                    <strong>
                      Email Notifications
                    </strong>

                    <span>
                      Receive important updates
                      through email.
                    </span>

                  </div>

                  <label className="toggle">

                    <input
                      type="checkbox"
                      checked={
                        notifications.email
                      }
                      onChange={() =>
                        toggleNotification(
                          "email"
                        )
                      }
                    />

                    <span className="toggle-slider"></span>

                  </label>

                </div>

                <div className="notification-item">

                  <div className="notification-icon">

                    <Package size={17} />

                  </div>

                  <div className="notification-info">

                    <strong>
                      Order Updates
                    </strong>

                    <span>
                      Get notified about order
                      status changes.
                    </span>

                  </div>

                  <label className="toggle">

                    <input
                      type="checkbox"
                      checked={
                        notifications.order
                      }
                      onChange={() =>
                        toggleNotification(
                          "order"
                        )
                      }
                    />

                    <span className="toggle-slider"></span>

                  </label>

                </div>

                <div className="notification-item">

                  <div className="notification-icon">

                    <Package size={17} />

                  </div>

                  <div className="notification-info">

                    <strong>
                      Low Stock Alerts
                    </strong>

                    <span>
                      Receive alerts when products
                      reach low stock.
                    </span>

                  </div>

                  <label className="toggle">

                    <input
                      type="checkbox"
                      checked={
                        notifications.stock
                      }
                      onChange={() =>
                        toggleNotification(
                          "stock"
                        )
                      }
                    />

                    <span className="toggle-slider"></span>

                  </label>

                </div>

                <div className="notification-item">

                  <div className="notification-icon">

                    <FileText size={17} />

                  </div>

                  <div className="notification-info">

                    <strong>
                      RFQ Responses
                    </strong>

                    <span>
                      Get notified when suppliers
                      respond to RFQs.
                    </span>

                  </div>

                  <label className="toggle">

                    <input
                      type="checkbox"
                      checked={
                        notifications.rfq
                      }
                      onChange={() =>
                        toggleNotification(
                          "rfq"
                        )
                      }
                    />

                    <span className="toggle-slider"></span>

                  </label>

                </div>

              </div>

              <div className="settings-card-footer">

                <button
                  type="button"
                  className="save-settings-btn"
                  onClick={
                    saveNotifications
                  }
                  disabled={loading}
                >

                  <Save size={15} />

                  {loading
                    ? "Saving..."
                    : "Save Changes"}

                </button>

              </div>

            </div>
          )}

          {/* =================================================
              SECURITY
          ================================================= */}

          {activeTab === "security" && (

            <div className="settings-card">

              <div className="settings-card-header">

                <div>

                  <h2>
                    Security
                  </h2>

                  <p>
                    Manage your password and
                    account security.
                  </p>

                </div>

              </div>

              <div className="security-section">

                <div className="security-icon">

                  <Lock size={22} />

                </div>

                <div>

                  <h3>
                    Change Password
                  </h3>

                  <p>
                    We recommend using a strong
                    password that you don't use
                    anywhere else.
                  </p>

                </div>

              </div>

              <div className="settings-form">

                <div className="settings-field">

                  <label>
                    CURRENT PASSWORD
                  </label>

                  <input
                    type="password"
                    name="currentPassword"
                    value={
                      passwords.currentPassword
                    }
                    onChange={
                      handlePasswordChange
                    }
                    placeholder="Enter current password"
                  />

                </div>

                <div className="settings-field">

                  <label>
                    NEW PASSWORD
                  </label>

                  <input
                    type="password"
                    name="newPassword"
                    value={
                      passwords.newPassword
                    }
                    onChange={
                      handlePasswordChange
                    }
                    placeholder="Enter new password"
                  />

                </div>

                <div className="settings-field">

                  <label>
                    CONFIRM NEW PASSWORD
                  </label>

                  <input
                    type="password"
                    name="confirmPassword"
                    value={
                      passwords.confirmPassword
                    }
                    onChange={
                      handlePasswordChange
                    }
                    placeholder="Confirm new password"
                  />

                </div>

              </div>

              <div className="settings-card-footer">

                <button
                  type="button"
                  className="save-settings-btn"
                  onClick={
                    updatePassword
                  }
                  disabled={loading}
                >

                  <Save size={15} />

                  {loading
                    ? "Updating..."
                    : "Update Password"}

                </button>

              </div>

            </div>
          )}

               </section>
      </div>
      </main>
    </div>

      <Footer />
    </div>
  );
}