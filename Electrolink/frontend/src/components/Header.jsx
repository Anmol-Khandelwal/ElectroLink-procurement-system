import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  Search,
  ShoppingCart,
  User,
  LayoutGrid,
  Package,
  FileText,
  Settings as SettingsIcon,
  Users as UsersIcon,
  LogOut,
  ChevronDown,
} from "lucide-react";

import { useAuth } from "../context/useAuth";
import { useCart } from "../context/useCart";

import "./Header.css";

/* =========================================================
   HEADER

   The single navigation bar of the application. Every link
   points at a real page and the entries change with the
   role of the signed in account:

     buyer          Catalog, My Orders
     administrator  Catalog, Orders, Inventory, Requests,
                    Analytics, Users
========================================================= */

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, isAdmin, logout } = useAuth();
  const { cartCount } = useCart();

  const menuRef = useRef(null);

  const [search, setSearch] = useState(() => {
    return new URLSearchParams(location.search).get("search") || "";
  });

  const [menuOpen, setMenuOpen] = useState(false);

  /* Keep the search box in step with the address bar when the
     catalogue is opened from somewhere else. */

  useEffect(() => {
    if (location.pathname === "/catalog") {
      setSearch(new URLSearchParams(location.search).get("search") || "");
    }
  }, [location.pathname, location.search]);

  /* Close the account menu on an outside click. */

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleSearch = (event) => {
    event.preventDefault();

    const value = search.trim();

    navigate(
      value ? `/catalog?search=${encodeURIComponent(value)}` : "/catalog",
    );
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate("/login", { replace: true });
  };

  const isActive = (path) => location.pathname === path;

  const navLinks = isAdmin
    ? [
        { label: "Catalog", path: "/catalog", icon: Package },
        { label: "Orders", path: "/orders", icon: ShoppingCart },
        { label: "Inventory", path: "/products", icon: Package },
        { label: "Requests", path: "/requests", icon: FileText },
        { label: "Analytics", path: "/dashboard", icon: LayoutGrid },
      ]
    : [
        { label: "Catalog", path: "/catalog", icon: Package },
        { label: "My Orders", path: "/orders", icon: ShoppingCart },
        { label: "My Requests", path: "/requests", icon: FileText },
      ];

  const initials = String(user?.name || user?.email || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <header className="el-topnav">
      {/* =================================================
          LOGO
      ================================================= */}

      <button
        type="button"
        className="el-logo"
        onClick={() => navigate(isAdmin ? "/dashboard" : "/catalog")}
      >
        ElectroLink
      </button>

      {/* =================================================
          SEARCH
      ================================================= */}

      <form className="el-search" onSubmit={handleSearch}>
        <Search size={16} className="el-search-icon" />

        <input
          type="text"
          placeholder="Search catalog..."
          aria-label="Search catalog"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </form>

      {/* =================================================
          NAVIGATION
      ================================================= */}

      <nav className="el-nav-links">
        {navLinks.map((link) => (
          <button
            key={link.path + link.label}
            type="button"
            className={`el-nav-link ${
              isActive(link.path) ? "el-nav-link--active" : ""
            }`}
            onClick={() => navigate(link.path)}
          >
            {link.label}
          </button>
        ))}
      </nav>

      {/* =================================================
          CART AND ACCOUNT
      ================================================= */}

      <div className="el-topnav-icons">
        <button
          type="button"
          className={`el-icon-btn el-cart-btn ${
            isActive("/cart") ? "el-icon-btn--dashed" : ""
          }`}
          onClick={() => navigate("/cart")}
          title="Shopping cart"
          aria-label={`Shopping cart with ${cartCount} item${
            cartCount === 1 ? "" : "s"
          }`}
        >
          <ShoppingCart size={18} />

          {cartCount > 0 && (
            <span className="el-cart-badge">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          )}
        </button>

        <div className="el-account" ref={menuRef}>
          <button
            type="button"
            className="el-icon-btn el-account-btn"
            onClick={() => setMenuOpen((open) => !open)}
            title="Your account"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="el-avatar">{initials || <User size={16} />}</span>

            <ChevronDown size={14} className="el-account-caret" />
          </button>

          {menuOpen && (
            <div className="el-account-menu" role="menu">
              <div className="el-account-header">
                <p className="el-account-name">{user?.name || "Account"}</p>

                <p className="el-account-email">{user?.email}</p>

                <span
                  className={`el-account-role el-account-role--${
                    isAdmin ? "admin" : "user"
                  }`}
                >
                  {isAdmin ? "Administrator" : "Buyer"}
                </span>
              </div>

              <button
                type="button"
                className="el-account-item"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/settings");
                }}
              >
                <User size={15} />
                My Profile
              </button>

              <button
                type="button"
                className="el-account-item"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/orders");
                }}
              >
                <ShoppingCart size={15} />
                {isAdmin ? "All Orders" : "My Orders"}
              </button>

              <button
                type="button"
                className="el-account-item"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/settings?tab=company");
                }}
              >
                <SettingsIcon size={15} />
                Account Settings
              </button>

              {isAdmin && (
                <button
                  type="button"
                  className="el-account-item"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate("/users");
                  }}
                >
                  <UsersIcon size={15} />
                  Manage Users
                </button>
              )}

              <div className="el-account-divider" />

              <button
                type="button"
                className="el-account-item el-account-item--danger"
                onClick={handleLogout}
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
