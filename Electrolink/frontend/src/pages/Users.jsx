import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Search,
  ShieldCheck,
  UserRound,
  Users as UsersIcon,
} from "lucide-react";

import Header from "../components/Header";
import Footer from "../components/Footer";

import api, {
  getErrorMessage,
  formatCurrency,
  formatDate,
} from "../services/api";

import { useAuth } from "../context/useAuth";

import "./Users.css";

/* =========================================================
   MANAGE USERS

   Administrator only. This is where a buyer account is
   promoted to administrator, which is the only way to create
   a second administrator from inside the application.
========================================================= */

export default function Users() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");

  const [busyId, setBusyId] = useState(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { data } = await api.get("/admin/users");

      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Failed to load the users."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return users;

    return users.filter((item) =>
      [item.name, item.email, item.companyName].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      ),
    );
  }, [users, search]);

  const adminCount = users.filter((item) => item.role === "admin").length;

  const changeRole = async (item, role) => {
    const confirmed = window.confirm(
      role === "admin"
        ? `Give ${item.name} full administrator access?`
        : `Remove administrator access from ${item.name}?`,
    );

    if (!confirmed) return;

    try {
      setBusyId(item.id);
      setError("");
      setNotice("");

      const { data } = await api.patch(`/admin/users/${item.id}/role`, {
        role,
      });

      setNotice(data.message);

      await loadUsers();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Failed to change the role."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="users-page">
      <Header />

      <main className="users-main">
        <div className="users-heading">
          <div>
            <h1>Manage Users</h1>

            <p>
              Buyers can browse the catalog and place orders. Administrators can
              also manage the inventory, the requests and every order.
            </p>
          </div>

          <div className="users-counts">
            <div>
              <span>TOTAL</span>
              <strong>{users.length}</strong>
            </div>

            <div>
              <span>ADMINS</span>
              <strong>{adminCount}</strong>
            </div>
          </div>
        </div>

        {error && <div className="users-alert users-alert--error">{error}</div>}

        {notice && (
          <div className="users-alert users-alert--success">{notice}</div>
        )}

        <section className="users-panel">
          <div className="users-filter-bar">
            <div className="users-search">
              <Search size={17} />

              <input
                type="text"
                placeholder="Search by name, email or company..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="users-table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>USER</th>
                  <th>COMPANY</th>
                  <th>ROLE</th>
                  <th>ORDERS</th>
                  <th>ORDER VALUE</th>
                  <th>JOINED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="users-empty-cell">
                      Loading users...
                    </td>
                  </tr>
                ) : visibleUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="users-empty-cell">
                      No user matches your search.
                    </td>
                  </tr>
                ) : (
                  visibleUsers.map((item) => {
                    const isSelf = item.id === currentUser?.id;

                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="users-name-cell">
                            <span className="users-avatar">
                              {item.role === "admin" ? (
                                <ShieldCheck size={16} />
                              ) : (
                                <UserRound size={16} />
                              )}
                            </span>

                            <div>
                              <div className="users-name">
                                {item.name}
                                {isSelf && (
                                  <span className="users-you">You</span>
                                )}
                              </div>

                              <div className="users-email">{item.email}</div>
                            </div>
                          </div>
                        </td>

                        <td>{item.companyName || "—"}</td>

                        <td>
                          <span
                            className={`users-role users-role--${item.role}`}
                          >
                            {item.role === "admin" ? "Administrator" : "Buyer"}
                          </span>
                        </td>

                        <td>{item.orderCount}</td>

                        <td>{formatCurrency(item.orderValue)}</td>

                        <td>{formatDate(item.createdAt)}</td>

                        <td>
                          {item.role === "admin" ? (
                            <button
                              type="button"
                              className="users-action-btn users-action-btn--demote"
                              disabled={
                                busyId === item.id || isSelf || adminCount <= 1
                              }
                              title={
                                isSelf
                                  ? "You cannot change your own role"
                                  : adminCount <= 1
                                    ? "The last administrator cannot be demoted"
                                    : "Make this account a buyer"
                              }
                              onClick={() => changeRole(item, "user")}
                            >
                              Make buyer
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="users-action-btn users-action-btn--promote"
                              disabled={busyId === item.id}
                              onClick={() => changeRole(item, "admin")}
                            >
                              <UsersIcon size={14} />
                              Make administrator
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
