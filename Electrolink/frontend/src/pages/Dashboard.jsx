import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import Header from "../components/Header";
import Footer from "../components/Footer";

import {
  LayoutGrid,
  Package,
  FileText,
  Settings,
  Users,
  ShoppingBag,
  Truck,
  AlertTriangle,
  Lightbulb,
  IndianRupee,
} from "lucide-react";

import api, {
  getErrorMessage,
  formatCurrency,
  formatDate,
} from "../services/api";

import { useAuth } from "../context/useAuth";

import "./Dashboard.css";

/* =========================================================
   ADMIN DASHBOARD

   The control panel of the platform. Only an administrator
   can reach this page, so it always shows platform wide
   numbers.
========================================================= */

function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${String(status).toLowerCase()}`}>
      {status}
    </span>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const { user } = useAuth();

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalRequests: 0,
    totalOrders: 0,
    activeOrders: 0,
    orderValue: 0,
    lowStock: 0,
    totalCustomers: 0,
  });

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* -------------------------------------------------------
     LOAD THE DASHBOARD
  ------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const [dashboardResponse, ordersResponse, productsResponse] =
          await Promise.all([
            api.get("/dashboard"),
            api.get("/orders"),
            api.get("/products"),
          ]);

        if (cancelled) return;

        if (dashboardResponse.data?.stats) {
          setStats(dashboardResponse.data.stats);
        }

        setOrders(
          Array.isArray(ordersResponse.data.orders)
            ? ordersResponse.data.orders
            : [],
        );

        setProducts(
          Array.isArray(productsResponse.data.products)
            ? productsResponse.data.products
            : [],
        );
      } catch (requestError) {
        if (!cancelled) {
          setError(
            getErrorMessage(requestError, "Failed to load the dashboard."),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  /* -------------------------------------------------------
     RECENT ORDERS
  ------------------------------------------------------- */

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

  /* -------------------------------------------------------
     STOCK THAT NEEDS ATTENTION
  ------------------------------------------------------- */

  const attentionProducts = useMemo(() => {
    const scored = products.map((product) => {
      const stock = Number(product.available_stock || 0);
      const minimum = Number(product.minimum_order_quantity || 1);

      let tag = { text: "IN STOCK", type: "instock" };

      if (stock <= 0) {
        tag = { text: "OUT OF STOCK", type: "critical" };
      } else if (stock <= minimum) {
        tag = { text: "CRITICAL", type: "critical" };
      } else if (stock <= minimum * 3) {
        tag = { text: "LOW STOCK", type: "leadtime" };
      }

      return { ...product, stock, tag };
    });

    return scored
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 4);
  }, [products]);

  /* -------------------------------------------------------
     STAT CARDS
  ------------------------------------------------------- */

  const dashboardStats = [
    {
      label: "TOTAL ORDERS",
      value: stats.totalOrders,
      icon: ShoppingBag,
      note: "Orders placed by buyers",
      noteType: "positive",
    },
    {
      label: "ACTIVE ORDERS",
      value: stats.activeOrders,
      icon: Truck,
      note: "Waiting to be delivered",
      noteType: "neutral",
    },
    {
      label: "ORDER VALUE",
      value: formatCurrency(stats.orderValue),
      icon: IndianRupee,
      note: "Excluding cancelled orders",
      noteType: "positive",
    },
    {
      label: "RFQ REQUESTS",
      value: stats.totalRequests,
      icon: FileText,
      note: "Procurement requests raised",
      noteType: "neutral",
    },
    {
      label: "REGISTERED BUYERS",
      value: stats.totalCustomers,
      icon: Users,
      note: "Accounts that can order",
      noteType: "positive",
    },
    {
      label: "LOW STOCK ALERTS",
      value: stats.lowStock,
      icon: AlertTriangle,
      note: "Requires immediate action",
      noteType: "negative",
    },
  ];

  return (
    <div className="el-app">
      <Header />

      <div className="el-body">
        {/* =================================================
            SIDEBAR
        ================================================= */}

        <aside className="el-sidebar">
          <div className="el-sidebar-header">
            <h2>Admin Dashboard</h2>
            <p>Procurement Control</p>
          </div>

          <nav className="el-sidebar-nav">
            <Link
              to="/dashboard"
              className="el-sidebar-link el-sidebar-link--active"
            >
              <LayoutGrid size={16} />
              <span>Analytics</span>
            </Link>

            <Link to="/products" className="el-sidebar-link">
              <Package size={16} />
              <span>Products</span>
            </Link>

            <Link to="/orders" className="el-sidebar-link">
              <ShoppingBag size={16} />
              <span>Orders</span>
            </Link>

            <Link to="/requests" className="el-sidebar-link">
              <FileText size={16} />
              <span>Requests</span>
            </Link>

            <Link to="/users" className="el-sidebar-link">
              <Users size={16} />
              <span>Users</span>
            </Link>

            <Link to="/settings" className="el-sidebar-link">
              <Settings size={16} />
              <span>Settings</span>
            </Link>
          </nav>
        </aside>

        {/* =================================================
            MAIN CONTENT
        ================================================= */}

        <main className="el-main">
          <div className="el-welcome">
            <h1>Welcome back, {user?.name || "Administrator"}</h1>
            <p>Here is the procurement overview for today.</p>
          </div>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                padding: "12px 16px",
                borderRadius: "6px",
                marginBottom: "20px",
              }}
            >
              {error}
            </div>
          )}

          {/* =================================================
              STAT CARDS
          ================================================= */}

          <div className="el-stats-grid">
            {dashboardStats.map((stat) => {
              const Icon = stat.icon;

              return (
                <div className="el-stat-card" key={stat.label}>
                  <div className="el-stat-card-top">
                    <span className="el-stat-label">{stat.label}</span>

                    <Icon
                      size={18}
                      className={`el-stat-icon el-stat-icon--${stat.noteType}`}
                    />
                  </div>

                  <div className="el-stat-value">
                    {loading ? "..." : stat.value}
                  </div>

                  <div
                    className={`el-stat-note el-stat-note--${stat.noteType}`}
                  >
                    {stat.note}
                  </div>
                </div>
              );
            })}
          </div>

          {/* =================================================
              LOWER GRID
          ================================================= */}

          <div className="el-lower-grid">
            {/* =================================================
                RECENT ORDERS
            ================================================= */}

            <section className="el-panel el-rfq-panel">
              <div className="el-panel-header">
                <h3>Recent Orders</h3>

                <button
                  className="el-view-all"
                  onClick={() => navigate("/orders")}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  VIEW ALL
                </button>
              </div>

              <table className="el-table">
                <thead>
                  <tr>
                    <th>ORDER</th>
                    <th>CUSTOMER</th>
                    <th>DATE</th>
                    <th>STATUS</th>
                    <th className="el-th-right">AMOUNT</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center" }}>
                        Loading orders...
                      </td>
                    </tr>
                  ) : recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center" }}>
                        No orders have been placed yet.
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <button
                            className="el-request-id"
                            onClick={() => navigate(`/orders/${order.id}`)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            {order.orderNumber}
                          </button>
                        </td>

                        <td>{order.customerName || "—"}</td>

                        <td>{formatDate(order.placedAt)}</td>

                        <td>
                          <StatusBadge status={order.status} />
                        </td>

                        <td className="el-td-right">
                          {formatCurrency(order.total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            {/* =================================================
                STOCK ATTENTION
            ================================================= */}

            <section className="el-panel el-recommend-panel">
              <div className="el-panel-header">
                <h3>Needs Restocking</h3>

                <Lightbulb size={16} className="el-bulb-icon" />
              </div>

              <div className="el-recommend-list">
                {loading ? (
                  <div style={{ padding: "20px" }}>Loading products...</div>
                ) : attentionProducts.length === 0 ? (
                  <div style={{ padding: "20px" }}>
                    No products in the catalog yet.
                  </div>
                ) : (
                  attentionProducts.map((product) => (
                    <div
                      className="el-recommend-card"
                      key={product.id}
                      onClick={() => navigate("/products")}
                      style={{ cursor: "pointer" }}
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.product_name}
                        />
                      ) : (
                        <div className="el-recommend-placeholder">
                          <Package size={22} />
                        </div>
                      )}

                      <div className="el-recommend-info">
                        <div className="el-recommend-name">
                          {product.product_name}
                        </div>

                        <div className="el-recommend-sku">
                          {product.stock} in stock ·{" "}
                          {product.part_number || product.manufacturer || "—"}
                        </div>

                        <span
                          className={`el-recommend-tag el-recommend-tag--${product.tag.type}`}
                        >
                          {product.tag.text}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
