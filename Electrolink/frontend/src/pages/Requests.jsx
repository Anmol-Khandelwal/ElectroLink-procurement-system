import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Header from "../components/Header";
import Footer from "../components/Footer";

import {
  Search,
  ShoppingBag,
  Users,
  LayoutGrid,
  Package,
  FileText,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  SlidersHorizontal,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  X,
  Edit,
  Trash2,
} from "lucide-react";

import { useAuth } from "../context/useAuth";

import { formatCurrency } from "../services/api";

import "./Requests.css";

// =====================================================
// BACKEND API
// =====================================================

const API_URL = "http://localhost:5000/api";

// =====================================================
// EMPTY FORM
// =====================================================

const emptyForm = {
  request_id: "",
  request_date: "",
  supplier: "",
  items: "",
  category: "",
  status: "Pending",
  amount: "",
};

// =====================================================
// STATUS BADGE
// =====================================================

function StatusBadge({ status }) {
  const statusValue = String(status || "").toLowerCase();

  let type = "pending";

  if (statusValue === "quoted") {
    type = "quoted";
  } else if (statusValue === "rejected") {
    type = "rejected";
  } else if (statusValue === "approved") {
    type = "approved";
  } else if (statusValue === "pending") {
    type = "pending";
  }

  return (
    <span className={`request-status request-status--${type}`}>
      {status || "Pending"}
    </span>
  );
}

// =====================================================
// DATE FORMAT
// =====================================================

function formatDate(date) {
  if (!date) return "-";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return date;
  }

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

// =====================================================
// DATE FOR INPUT
// =====================================================

function formatDateForInput(date) {
  if (!date) return "";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// =====================================================
// CURRENCY
// =====================================================

function formatAmount(amount) {
  const number = Number(amount);

  if (Number.isNaN(number)) {
    return formatCurrency(0);
  }

  return formatCurrency(number);
}

// =====================================================
// API HELPER
// =====================================================

async function apiRequest(url, options = {}) {
  const token = localStorage.getItem("token");

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    /* An empty or non JSON body is handled below. */
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

// =====================================================
// REQUESTS PAGE
// =====================================================

export default function Requests() {
  // ===================================================
  // ROLE
  //
  // A buyer only ever receives their own requests from the
  // backend, and can withdraw one while it is still
  // pending. Everything else is for administrators.
  // ===================================================

  const { isAdmin } = useAuth();

  // ===================================================
  // REQUESTS
  // ===================================================

  const [requests, setRequests] = useState([]);

  // ===================================================
  // LOADING
  // ===================================================

  const [loading, setLoading] = useState(true);

  // ===================================================
  // ERROR
  // ===================================================

  const [error, setError] = useState("");

  // ===================================================
  // SEARCH
  // ===================================================

  const [searchTerm, setSearchTerm] = useState("");

  // ===================================================
  // STATUS FILTER
  // ===================================================

  const [statusFilter, setStatusFilter] = useState("");

  // ===================================================
  // CATEGORY FILTER
  // ===================================================

  const [categoryFilter, setCategoryFilter] = useState("");

  // ===================================================
  // PAGINATION
  // ===================================================

  const [currentPage, setCurrentPage] = useState(1);

  const requestsPerPage = 8;

  // ===================================================
  // MODAL
  // ===================================================

  const [showModal, setShowModal] = useState(false);

  // ===================================================
  // EDIT MODE
  // ===================================================

  const [editingRequest, setEditingRequest] = useState(null);

  // ===================================================
  // FORM
  // ===================================================

  const [formData, setFormData] = useState(emptyForm);

  // ===================================================
  // SAVING
  // ===================================================

  const [saving, setSaving] = useState(false);

  // ===================================================
  // ACTION MENU
  // ===================================================

  const [openActionId, setOpenActionId] = useState(null);

  // ===================================================
  // READ ONLY MODAL
  // ===================================================

  const [readOnly, setReadOnly] = useState(false);

  // ===================================================
  // GENERATE REQUEST ID
  // ===================================================

  const generateRequestId = (requestList) => {
    let maxNumber = 0;

    requestList.forEach((request) => {
      const id = request.request_id || "";

      const match = String(id).match(/(\d+)$/);

      if (match) {
        const number = Number(match[1]);

        if (number > maxNumber) {
          maxNumber = number;
        }
      }
    });

    const nextNumber = maxNumber + 1;

    return `RFQ-${new Date().getFullYear()}-${String(
      nextNumber
    ).padStart(3, "0")}`;
  };

  // ===================================================
  // FETCH REQUESTS
  // ===================================================

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await apiRequest(`${API_URL}/requests`);

      // Backend may return:
      // []
      // OR
      // { requests: [] }
      // OR
      // { data: [] }

      let requestData = [];

      if (Array.isArray(data)) {
        requestData = data;
      } else if (Array.isArray(data?.requests)) {
        requestData = data.requests;
      } else if (Array.isArray(data?.data)) {
        requestData = data.data;
      }

      setRequests(requestData);
    } catch (err) {
      console.error("Fetch requests error:", err);

      setError(
        err.message ||
          "Unable to load requests. Please make sure the backend server is running."
      );

      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  // ===================================================
  // INITIAL LOAD
  // ===================================================

  useEffect(() => {
    fetchRequests();
  }, []);

  // ===================================================
  // HANDLE INPUT
  // ===================================================

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // ===================================================
  // OPEN NEW REQUEST MODAL
  // ===================================================

  const openNewRequestModal = () => {
    setEditingRequest(null);

    setReadOnly(false);

    setFormData({
      ...emptyForm,
      request_id: generateRequestId(requests),
      request_date: new Date().toISOString().split("T")[0],
      status: "Pending",
    });

    setShowModal(true);
  };

  // ===================================================
  // OPEN EDIT MODAL
  // ===================================================

  const openEditModal = (request) => {
    setEditingRequest(request);

    /* A buyer may look at a request but only an
       administrator can change it. */

    setReadOnly(!isAdmin);

    setFormData({
      request_id: request.request_id || "",
      request_date: formatDateForInput(request.request_date),
      supplier: request.supplier || "",
      items: request.items ?? "",
      category: request.category || "",
      status: request.status || "Pending",
      amount: request.amount ?? "",
    });

    setOpenActionId(null);
    setShowModal(true);
  };

  // ===================================================
  // CLOSE MODAL
  // ===================================================

  const closeModal = () => {
    setShowModal(false);
    setEditingRequest(null);
    setReadOnly(false);
    setFormData(emptyForm);
  };

  // ===================================================
  // SUBMIT REQUEST
  // ===================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.request_id ||
      !formData.request_date ||
      !formData.supplier ||
      !formData.items ||
      !formData.category ||
      !formData.status ||
      formData.amount === ""
    ) {
      alert("Please fill all required fields.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      // =================================================
      // PAYLOAD FOR BACKEND
      // =================================================

      const payload = {
        request_id: formData.request_id.trim(),
        request_date: formData.request_date,
        supplier: formData.supplier.trim(),
        items: Number(formData.items),
        category: formData.category.trim(),
        status: formData.status,
        amount: Number(formData.amount),
      };

      // =================================================
      // UPDATE
      // =================================================

      if (editingRequest) {
        await apiRequest(
          `${API_URL}/requests/${editingRequest.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          }
        );

        alert("Request updated successfully.");
      }

      // =================================================
      // CREATE
      // =================================================

      else {
        await apiRequest(`${API_URL}/requests`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        alert("Request created successfully.");
      }

      // =================================================
      // REFRESH
      // =================================================

      await fetchRequests();

      closeModal();
    } catch (err) {
      console.error("Save request error:", err);

      alert(err.message || "Unable to save request.");
    } finally {
      setSaving(false);
    }
  };

  // ===================================================
  // DELETE REQUEST
  // ===================================================

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this request?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await apiRequest(`${API_URL}/requests/${id}`, {
        method: "DELETE",
      });

      alert("Request deleted successfully.");

      setOpenActionId(null);

      await fetchRequests();
    } catch (err) {
      console.error("Delete request error:", err);

      alert(err.message || "Unable to delete request.");
    }
  };

  // ===================================================
  // UNIQUE CATEGORIES
  // ===================================================

  const categories = useMemo(() => {
    return [
      ...new Set(
        requests
          .map((request) => request.category)
          .filter((category) => category)
      ),
    ];
  }, [requests]);

  // ===================================================
  // FILTER REQUESTS
  // ===================================================

  const filteredRequests = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return requests.filter((request) => {
      const requestId = String(request.request_id || "").toLowerCase();

      const supplier = String(request.supplier || "").toLowerCase();

      const category = String(request.category || "").toLowerCase();

      const matchesSearch =
        search === "" ||
        requestId.includes(search) ||
        supplier.includes(search) ||
        category.includes(search);

      const matchesStatus =
        statusFilter === "" ||
        String(request.status || "").toLowerCase() ===
          statusFilter.toLowerCase();

      const matchesCategory =
        categoryFilter === "" ||
        request.category === categoryFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory
      );
    });
  }, [
    requests,
    searchTerm,
    statusFilter,
    categoryFilter,
  ]);

  // ===================================================
  // RESET PAGE WHEN FILTER CHANGES
  // ===================================================

  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    statusFilter,
    categoryFilter,
  ]);

  // ===================================================
  // PAGINATION
  // ===================================================

  const totalPages = Math.ceil(
    filteredRequests.length / requestsPerPage
  );

  const startIndex =
    (currentPage - 1) * requestsPerPage;

  const currentRequests = filteredRequests.slice(
    startIndex,
    startIndex + requestsPerPage
  );

  // ===================================================
  // STATISTICS
  // ===================================================

  const totalRequests = requests.length;

  const pendingRequests = requests.filter(
    (request) =>
      String(request.status || "").toLowerCase() ===
      "pending"
  ).length;

  const quotedRequests = requests.filter(
    (request) =>
      String(request.status || "").toLowerCase() ===
      "quoted"
  ).length;

  const rejectedRequests = requests.filter(
    (request) =>
      String(request.status || "").toLowerCase() ===
      "rejected"
  ).length;

  // ===================================================
  // CLEAR FILTERS
  // ===================================================

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setCategoryFilter("");
    setCurrentPage(1);
  };

  // ===================================================
  // PAGE BUTTONS
  // ===================================================

  const pageNumbers = [];

  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div className="requests-page">

      <Header />

      {/* =================================================
          BODY
      ================================================= */}

      <div className="el-body">

        {/* =================================================
            SIDEBAR
        ================================================= */}

        {isAdmin && (
        <aside className="el-sidebar">

          <div className="el-sidebar-header">

            <h2>
              Admin Dashboard
            </h2>

            <p>
              Procurement Control
            </p>

          </div>

          <nav className="el-sidebar-nav">

            <Link
              to="/dashboard"
              className="el-sidebar-link"
            >
              <LayoutGrid size={16} />
              <span>Analytics</span>
            </Link>

            <Link
              to="/products"
              className="el-sidebar-link"
            >
              <Package size={16} />
              <span>Products</span>
            </Link>

            <Link
              to="/orders"
              className="el-sidebar-link"
            >
              <ShoppingBag size={16} />
              <span>Orders</span>
            </Link>

            <Link
              to="/requests"
              className="el-sidebar-link el-sidebar-link--active"
            >
              <FileText size={16} />
              <span>Requests</span>
            </Link>

            <Link
              to="/users"
              className="el-sidebar-link"
            >
              <Users size={16} />
              <span>Users</span>
            </Link>

            <Link
              to="/settings"
              className="el-sidebar-link"
            >
              <Settings size={16} />
              <span>Settings</span>
            </Link>

          </nav>

        </aside>
        )}

        {/* =================================================
            MAIN CONTENT
        ================================================= */}

        <main className="requests-main">

          {/* =================================================
              HEADING
          ================================================= */}

          <div className="requests-heading">

            <div>

              <h1>
                {isAdmin ? "Requests" : "My Requests"}
              </h1>

              <p>
                {isAdmin
                  ? "Manage and track every quotation request raised on the platform."
                  : "Track the quotation requests raised from your account."}
              </p>

            </div>

            <button
              className="new-request-btn"
              onClick={openNewRequestModal}
            >
              + New Request
            </button>

          </div>

          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <div
              style={{
                background: "#fee2e2",
                color: "#b91c1c",
                border: "1px solid #fecaca",
                padding: "12px 16px",
                marginBottom: "20px",
                borderRadius: "6px",
              }}
            >
              {error}
            </div>
          )}

          {/* =================================================
              STATISTICS
          ================================================= */}

          <div className="requests-stats-grid">

            {/* TOTAL */}

            <div className="request-stat-card">

              <div className="request-stat-top">

                <span>
                  TOTAL REQUESTS
                </span>

                <FileText
                  size={19}
                  className="request-stat-icon request-stat-icon--blue"
                />

              </div>

              <div className="request-stat-value">
                {totalRequests}
              </div>

              <div className="request-stat-note">
                Requests in database
              </div>

            </div>

            {/* PENDING */}

            <div className="request-stat-card">

              <div className="request-stat-top">

                <span>
                  PENDING
                </span>

                <Clock
                  size={19}
                  className="request-stat-icon request-stat-icon--orange"
                />

              </div>

              <div className="request-stat-value">
                {pendingRequests}
              </div>

              <div className="request-stat-note">
                Awaiting supplier response
              </div>

            </div>

            {/* QUOTED */}

            <div className="request-stat-card">

              <div className="request-stat-top">

                <span>
                  QUOTED
                </span>

                <CheckCircle
                  size={19}
                  className="request-stat-icon request-stat-icon--green"
                />

              </div>

              <div className="request-stat-value">
                {quotedRequests}
              </div>

              <div className="request-stat-note">
                Ready for review
              </div>

            </div>

            {/* REJECTED */}

            <div className="request-stat-card">

              <div className="request-stat-top">

                <span>
                  REJECTED
                </span>

                <XCircle
                  size={19}
                  className="request-stat-icon request-stat-icon--red"
                />

              </div>

              <div className="request-stat-value">
                {rejectedRequests}
              </div>

              <div className="request-stat-note">
                Requires attention
              </div>

            </div>

          </div>

          {/* =================================================
              REQUEST PANEL
          ================================================= */}

          <section className="requests-panel">

            {/* =================================================
                FILTER BAR
            ================================================= */}

            <div className="requests-filter-bar">

              {/* SEARCH */}

              <div className="requests-table-search">

                <Search size={17} />

                <input
                  type="text"
                  placeholder="Search request ID, supplier, or category..."
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(e.target.value)
                  }
                />

              </div>

              {/* STATUS */}

              <select
                className="request-filter-select"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                style={{
                  appearance: "auto",
                  WebkitAppearance: "auto",
                  backgroundColor: "#ffffff",
                  color: "#172033",
                  border: "1px solid #d5dce8",
                  cursor: "pointer",
                }}
              >

                <option value="">
                  All Status
                </option>

                <option value="Pending">
                  Pending
                </option>

                <option value="Quoted">
                  Quoted
                </option>

                <option value="Approved">
                  Approved
                </option>

                <option value="Rejected">
                  Rejected
                </option>

              </select>

              {/* CATEGORY */}

              <select
                className="request-filter-select"
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value)
                }
                style={{
                  appearance: "auto",
                  WebkitAppearance: "auto",
                  backgroundColor: "#ffffff",
                  color: "#172033",
                  border: "1px solid #d5dce8",
                  cursor: "pointer",
                }}
              >

                <option value="">
                  All Categories
                </option>

                {categories.map((category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                ))}

              </select>

              {/* CLEAR FILTER */}

              <button
                className="request-filters-btn"
                onClick={clearFilters}
              >

                <SlidersHorizontal size={15} />

                <span>
                  Filters
                </span>

              </button>

            </div>

            {/* =================================================
                LOADING
            ================================================= */}

            {loading ? (

              <div
                style={{
                  padding: "60px 20px",
                  textAlign: "center",
                  color: "#52627a",
                }}
              >
                Loading requests...
              </div>

            ) : (

              <>

                {/* =================================================
                    TABLE
                ================================================= */}

                <div className="requests-table-wrapper">

                  <table className="requests-table">

                    <thead>

                      <tr>

                        <th>
                          REQUEST ID
                        </th>

                        <th>
                          DATE
                        </th>

                        <th>
                          SUPPLIER
                        </th>

                        <th>
                          ITEMS
                        </th>

                        <th>
                          CATEGORY
                        </th>

                        <th>
                          STATUS
                        </th>

                        <th>
                          AMOUNT
                        </th>

                        <th>
                          ACTIONS
                        </th>

                      </tr>

                    </thead>

                    <tbody>

                      {currentRequests.length === 0 ? (

                        <tr>

                          <td
                            colSpan="8"
                            style={{
                              textAlign: "center",
                              padding: "50px 20px",
                              color: "#52627a",
                            }}
                          >
                            No products found.
                          </td>

                        </tr>

                      ) : (

                        currentRequests.map((request) => (

                          <tr key={request.id}>

                            {/* REQUEST ID */}

                            <td>

                              <button
                                type="button"
                                className="request-id"
                                onClick={() =>
                                  openEditModal(request)
                                }
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  padding: 0,
                                  cursor: "pointer",
                                  font: "inherit",
                                }}
                              >
                                {request.request_id}
                              </button>

                            </td>

                            {/* DATE */}

                            <td>

                              <span className="request-date">
                                {formatDate(
                                  request.request_date
                                )}
                              </span>

                            </td>

                            {/* SUPPLIER */}

                            <td>

                              <span className="request-supplier">
                                {request.supplier}
                              </span>

                            </td>

                            {/* ITEMS */}

                            <td>

                              <span className="request-items">
                                {request.items} items
                              </span>

                            </td>

                            {/* CATEGORY */}

                            <td>

                              <span className="request-category">
                                {request.category}
                              </span>

                            </td>

                            {/* STATUS */}

                            <td>

                              <StatusBadge
                                status={request.status}
                              />

                            </td>

                            {/* AMOUNT */}

                            <td>

                              <span className="request-amount">
                                {formatAmount(
                                  request.amount
                                )}
                              </span>

                            </td>

                            {/* ACTIONS */}

                            <td>

                              <div
                                style={{
                                  position: "relative",
                                  display: "inline-flex",
                                }}
                              >

                                <button
                                  className="request-action-btn"
                                  onClick={() =>
                                    setOpenActionId(
                                      openActionId === request.id
                                        ? null
                                        : request.id
                                    )
                                  }
                                >

                                  <MoreVertical size={17} />

                                </button>

                                {openActionId ===
                                  request.id && (

                                  <div
                                    style={{
                                      position: "absolute",
                                      right: 0,
                                      top: "35px",
                                      width: "150px",
                                      background: "#ffffff",
                                      border: "1px solid #d5dce8",
                                      borderRadius: "6px",
                                      boxShadow:
                                        "0 8px 25px rgba(0,0,0,0.12)",
                                      zIndex: 100,
                                      overflow: "hidden",
                                    }}
                                  >

                                    <button
                                      type="button"
                                      onClick={() =>
                                        openEditModal(
                                          request
                                        )
                                      }
                                      style={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding:
                                          "10px 12px",
                                        border: "none",
                                        background:
                                          "#ffffff",
                                        cursor: "pointer",
                                        color:
                                          "#172033",
                                        textAlign:
                                          "left",
                                      }}
                                    >

                                      <Edit size={15} />

                                      {isAdmin ? "Edit" : "View"}

                                    </button>

                                    {(isAdmin ||
                                      request.status ===
                                        "Pending") && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDelete(
                                          request.id
                                        )
                                      }
                                      style={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding:
                                          "10px 12px",
                                        border: "none",
                                        borderTop:
                                          "1px solid #edf0f5",
                                        background:
                                          "#ffffff",
                                        cursor: "pointer",
                                        color:
                                          "#dc2626",
                                        textAlign:
                                          "left",
                                      }}
                                    >

                                      <Trash2 size={15} />

                                      {isAdmin
                                        ? "Delete"
                                        : "Withdraw"}

                                    </button>
                                    )}

                                  </div>

                                )}

                              </div>

                            </td>

                          </tr>

                        ))

                      )}

                    </tbody>

                  </table>

                </div>

                {/* =================================================
                    PAGINATION
                ================================================= */}

                <div className="requests-pagination">

                  <div className="requests-pagination-info">

                    Showing{" "}

                    {filteredRequests.length === 0
                      ? 0
                      : startIndex + 1}

                    {" "}to{" "}

                    {Math.min(
                      startIndex + requestsPerPage,
                      filteredRequests.length
                    )}

                    {" "}of{" "}

                    {filteredRequests.length}

                    {" "}requests

                  </div>

                  <div className="requests-pagination-controls">

                    {/* PREVIOUS */}

                    <button
                      className="request-page-arrow"
                      disabled={currentPage === 1}
                      onClick={() =>
                        setCurrentPage(
                          (previous) =>
                            Math.max(
                              previous - 1,
                              1
                            )
                        )
                      }
                    >

                      <ChevronLeft size={15} />

                    </button>

                    {/* PAGE NUMBERS */}

                    {pageNumbers
                      .slice(0, 5)
                      .map((page) => (

                        <button
                          key={page}
                          className={
                            currentPage === page
                              ? "request-page-number request-page-number--active"
                              : "request-page-number"
                          }
                          onClick={() =>
                            setCurrentPage(page)
                          }
                        >
                          {page}
                        </button>

                      ))}

                    {/* DOTS */}

                    {totalPages > 5 && (
                      <>
                        <span className="request-page-dots">
                          ...
                        </span>

                        <button
                          className={
                            currentPage === totalPages
                              ? "request-page-number request-page-number--active"
                              : "request-page-number"
                          }
                          onClick={() =>
                            setCurrentPage(totalPages)
                          }
                        >
                          {totalPages}
                        </button>
                      </>
                    )}

                    {/* NEXT */}

                    <button
                      className="request-page-arrow"
                      disabled={
                        totalPages === 0 ||
                        currentPage === totalPages
                      }
                      onClick={() =>
                        setCurrentPage(
                          (previous) =>
                            Math.min(
                              previous + 1,
                              totalPages
                            )
                        )
                      }
                    >

                      <ChevronRight size={15} />

                    </button>

                  </div>

                </div>

              </>

            )}

          </section>

        </main>

      </div>

      {/* =================================================
          FOOTER
      ================================================= */}

      <Footer />

      {/* =================================================
          NEW / EDIT REQUEST MODAL
      ================================================= */}

      {showModal && (

        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeModal();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >

          <div
            style={{
              background: "#ffffff",
              width: "650px",
              maxWidth: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: "8px",
              padding: "32px",
              boxSizing: "border-box",
              boxShadow:
                "0 15px 45px rgba(0,0,0,0.25)",
            }}
          >

            {/* =================================================
                MODAL HEADER
            ================================================= */}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "28px",
              }}
            >

              <div>

                <h2
                  style={{
                    margin: 0,
                    fontSize: "24px",
                    fontWeight: 500,
                    color: "#172033",
                  }}
                >
                  {readOnly
                    ? "Request Details"
                    : editingRequest
                      ? "Edit Request"
                      : "New Request"}
                </h2>

                <p
                  style={{
                    margin:
                      "8px 0 0 0",
                    color: "#61708a",
                    fontSize: "16px",
                  }}
                >
                  {readOnly
                    ? "Only the procurement team can change a request once it has been raised."
                    : editingRequest
                      ? "Update quotation request."
                      : "Create a new quotation request."}
                </p>

              </div>

              <button
                type="button"
                onClick={closeModal}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: "4px",
                  color: "#172033",
                }}
              >
                <X size={25} />
              </button>

            </div>

            {/* =================================================
                FORM
            ================================================= */}

            <form onSubmit={handleSubmit}>

              {/* =================================================
                  REQUEST ID
              ================================================= */}

              <div
                style={{
                  marginBottom: "22px",
                }}
              >

                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "16px",
                    color: "#172033",
                    fontWeight: 500,
                  }}
                >
                  Request ID *
                </label>

                <input
                  type="text"
                  name="request_id"
                  disabled={readOnly}
                  value={formData.request_id}
                  onChange={handleInputChange}
                  required
                  readOnly={Boolean(editingRequest)}
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 14px",
                    boxSizing: "border-box",
                    border: "1px solid #cbd5e1",
                    borderRadius: "5px",
                    background: editingRequest
                      ? "#f8fafc"
                      : "#ffffff",
                    color: "#172033",
                    fontSize: "16px",
                    outline: "none",
                  }}
                />

              </div>

              {/* =================================================
                  DATE
              ================================================= */}

              <div
                style={{
                  marginBottom: "22px",
                }}
              >

                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "16px",
                    color: "#172033",
                    fontWeight: 500,
                  }}
                >
                  Date *
                </label>

                <input
                  type="date"
                  name="request_date"
                  disabled={readOnly}
                  value={formData.request_date}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 14px",
                    boxSizing: "border-box",
                    border: "1px solid #cbd5e1",
                    borderRadius: "5px",
                    background: "#ffffff",
                    color: "#172033",
                    fontSize: "16px",
                    outline: "none",
                  }}
                />

              </div>

              {/* =================================================
                  SUPPLIER
              ================================================= */}

              <div
                style={{
                  marginBottom: "22px",
                }}
              >

                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "16px",
                    color: "#172033",
                    fontWeight: 500,
                  }}
                >
                  Supplier *
                </label>

                <input
                  type="text"
                  name="supplier"
                  disabled={readOnly}
                  value={formData.supplier}
                  onChange={handleInputChange}
                  placeholder="Enter supplier name"
                  required
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 14px",
                    boxSizing: "border-box",
                    border: "1px solid #cbd5e1",
                    borderRadius: "5px",
                    background: "#ffffff",
                    color: "#172033",
                    fontSize: "16px",
                    outline: "none",
                  }}
                />

              </div>

              {/* =================================================
                  ITEMS + CATEGORY
              ================================================= */}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "1fr 1fr",
                  gap: "20px",
                  marginBottom: "22px",
                }}
              >

                {/* ITEMS */}

                <div>

                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "16px",
                      color: "#172033",
                      fontWeight: 500,
                    }}
                  >
                    Items *
                  </label>

                  <input
                    type="number"
                    name="items"
                    disabled={readOnly}
                    value={formData.items}
                    onChange={handleInputChange}
                    min="1"
                    placeholder="Number of items"
                    required
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 14px",
                      boxSizing:
                        "border-box",
                      border:
                        "1px solid #cbd5e1",
                      borderRadius: "5px",
                      background:
                        "#ffffff",
                      color:
                        "#172033",
                      fontSize:
                        "16px",
                      outline: "none",
                    }}
                  />

                </div>

                {/* CATEGORY */}

                <div>

                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontSize: "16px",
                      color: "#172033",
                      fontWeight: 500,
                    }}
                  >
                    Category *
                  </label>

                  <input
                    type="text"
                    name="category"
                    disabled={readOnly}
                    value={formData.category}
                    onChange={handleInputChange}
                    placeholder="Enter category"
                    required
                    style={{
                      width: "100%",
                      height: "48px",
                      padding: "0 14px",
                      boxSizing:
                        "border-box",
                      border:
                        "1px solid #cbd5e1",
                      borderRadius: "5px",
                      background:
                        "#ffffff",
                      color:
                        "#172033",
                      fontSize:
                        "16px",
                      outline: "none",
                    }}
                  />

                </div>

              </div>

              {/* =================================================
                  STATUS
              ================================================= */}

              <div
                style={{
                  marginBottom: "22px",
                }}
              >

                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "16px",
                    color: "#172033",
                    fontWeight: 500,
                  }}
                >
                  Status *
                </label>

                <select
                  name="status"
                  disabled={readOnly}
                  value={formData.status}
                  onChange={handleInputChange}
                  required
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 14px",
                    boxSizing: "border-box",
                    border: "1px solid #cbd5e1",
                    borderRadius: "5px",
                    backgroundColor: "#ffffff",
                    color: "#172033",
                    fontSize: "16px",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >

                  <option value="Pending">
                    Pending
                  </option>

                  <option value="Quoted">
                    Quoted
                  </option>

                  <option value="Approved">
                    Approved
                  </option>

                  <option value="Rejected">
                    Rejected
                  </option>

                </select>

              </div>

              {/* =================================================
                  AMOUNT
              ================================================= */}

              <div
                style={{
                  marginBottom: "28px",
                }}
              >

                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "16px",
                    color: "#172033",
                    fontWeight: 500,
                  }}
                >
                  Amount *
                </label>

                <input
                  type="number"
                  name="amount"
                  disabled={readOnly}
                  value={formData.amount}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 14px",
                    boxSizing: "border-box",
                    border: "1px solid #cbd5e1",
                    borderRadius: "5px",
                    background: "#ffffff",
                    color: "#172033",
                    fontSize: "16px",
                    outline: "none",
                  }}
                />

              </div>

              {/* =================================================
                  BUTTONS
              ================================================= */}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  paddingTop: "5px",
                }}
              >

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  style={{
                    height: "44px",
                    padding: "0 20px",
                    border:
                      "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#172033",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  {readOnly ? "Close" : "Cancel"}
                </button>

                {!readOnly && (
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    height: "44px",
                    padding: "0 20px",
                    border: "none",
                    background: "#0866d6",
                    color: "#ffffff",
                    borderRadius: "5px",
                    cursor: saving
                      ? "not-allowed"
                      : "pointer",
                    fontSize: "14px",
                    opacity: saving
                      ? 0.7
                      : 1,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : editingRequest
                    ? "Update Request"
                    : "Create Request"}
                </button>
                )}

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}