import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  Search,
  Package,
  ShoppingBag,
  Truck,
  CheckCircle,
  XCircle,
  ChevronRight,
} from "lucide-react";

import Header from "../components/Header";
import Footer from "../components/Footer";

import api, {
  getErrorMessage,
  formatCurrency,
  formatDate,
} from "../services/api";

import { useAuth } from "../context/useAuth";

import "./Orders.css";

/* =========================================================
   ORDERS

   A buyer sees only the orders placed from their own
   account. An administrator sees every order and can move
   them through the fulfilment statuses.
========================================================= */

const STATUS_FILTERS = [
  "All",
  "Placed",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
];

const NEXT_STATUS = {
  Placed: "Processing",
  Processing: "Shipped",
  Shipped: "Delivered",
};

export function OrderStatusBadge({ status }) {
  return (
    <span
      className={`order-status order-status--${String(status).toLowerCase()}`}
    >
      {status}
    </span>
  );
}

export default function Orders() {
  const navigate = useNavigate();

  const { isAdmin } = useAuth();

  const [orders, setOrders] = useState([]);

  const [stats, setStats] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("All");

  const [scope, setScope] = useState("all");

  const [busyId, setBusyId] = useState(null);

  /* -------------------------------------------------------
     LOAD ORDERS
  ------------------------------------------------------- */

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = {};

      if (isAdmin && scope === "mine") {
        params.scope = "mine";
      }

      const [ordersResponse, statsResponse] = await Promise.all([
        api.get("/orders", { params }),
        api.get("/orders/stats", { params }),
      ]);

      setOrders(
        Array.isArray(ordersResponse.data.orders)
          ? ordersResponse.data.orders
          : [],
      );

      setStats(statsResponse.data.stats || null);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Failed to load your orders."));
    } finally {
      setLoading(false);
    }
  }, [isAdmin, scope]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  /* -------------------------------------------------------
     FILTERS
  ------------------------------------------------------- */

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "All" || order.status === statusFilter;

      const matchesSearch =
        !query ||
        [order.orderNumber, order.customerName, order.customerEmail].some(
          (value) =>
            String(value || "")
              .toLowerCase()
              .includes(query),
        );

      return matchesStatus && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  /* -------------------------------------------------------
     ACTIONS
  ------------------------------------------------------- */

  const advanceStatus = async (order) => {
    const nextStatus = NEXT_STATUS[order.status];

    if (!nextStatus) return;

    try {
      setBusyId(order.id);
      setError("");
      setNotice("");

      const { data } = await api.patch(`/orders/${order.id}/status`, {
        status: nextStatus,
      });

      setNotice(data.message);

      await loadOrders();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Failed to update the order status."),
      );
    } finally {
      setBusyId(null);
    }
  };

  const cancelOrder = async (order) => {
    const confirmed = window.confirm(
      `Cancel order ${order.orderNumber}? The reserved stock goes back to the catalog.`,
    );

    if (!confirmed) return;

    try {
      setBusyId(order.id);
      setError("");
      setNotice("");

      const { data } = await api.post(`/orders/${order.id}/cancel`);

      setNotice(data.message);

      await loadOrders();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Failed to cancel the order."));
    } finally {
      setBusyId(null);
    }
  };

  const statCards = stats
    ? [
        {
          label: isAdmin && scope === "all" ? "TOTAL ORDERS" : "MY ORDERS",
          value: stats.total,
          icon: ShoppingBag,
          type: "neutral",
        },
        {
          label: "IN PROGRESS",
          value: stats.placed + stats.processing + stats.shipped,
          icon: Truck,
          type: "blue",
        },
        {
          label: "DELIVERED",
          value: stats.delivered,
          icon: CheckCircle,
          type: "green",
        },
        {
          label: "CANCELLED",
          value: stats.cancelled,
          icon: XCircle,
          type: "red",
        },
      ]
    : [];

  return (
    <div className="orders-page">
      <Header />

      <main className="orders-main">
        {/* =================================================
            HEADING
        ================================================= */}

        <div className="orders-heading">
          <div>
            <h1>{isAdmin && scope === "all" ? "All Orders" : "My Orders"}</h1>

            <p>
              {isAdmin && scope === "all"
                ? "Every order placed on the platform, newest first."
                : "Every order you have placed, newest first."}
            </p>
          </div>

          {isAdmin && (
            <div className="orders-scope">
              <button
                type="button"
                className={scope === "all" ? "orders-scope--active" : ""}
                onClick={() => setScope("all")}
              >
                All orders
              </button>

              <button
                type="button"
                className={scope === "mine" ? "orders-scope--active" : ""}
                onClick={() => setScope("mine")}
              >
                My orders
              </button>
            </div>
          )}
        </div>

        {/* =================================================
            MESSAGES
        ================================================= */}

        {error && <div className="orders-alert orders-alert--error">{error}</div>}

        {notice && (
          <div className="orders-alert orders-alert--success">{notice}</div>
        )}

        {/* =================================================
            STAT CARDS
        ================================================= */}

        {statCards.length > 0 && (
          <div className="orders-stats">
            {statCards.map((card) => {
              const Icon = card.icon;

              return (
                <div className="orders-stat-card" key={card.label}>
                  <div className="orders-stat-top">
                    <span>{card.label}</span>

                    <Icon
                      size={18}
                      className={`orders-stat-icon orders-stat-icon--${card.type}`}
                    />
                  </div>

                  <div className="orders-stat-value">{card.value}</div>
                </div>
              );
            })}

            <div className="orders-stat-card">
              <div className="orders-stat-top">
                <span>ORDER VALUE</span>
              </div>

              <div className="orders-stat-value orders-stat-value--money">
                {formatCurrency(stats.totalValue)}
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            FILTERS
        ================================================= */}

        <section className="orders-panel">
          <div className="orders-filter-bar">
            <div className="orders-search">
              <Search size={17} />

              <input
                type="text"
                placeholder={
                  isAdmin
                    ? "Search order number, customer name or email..."
                    : "Search by order number..."
                }
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="orders-status-tabs">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`orders-status-tab ${
                    statusFilter === status ? "orders-status-tab--active" : ""
                  }`}
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* =================================================
              ORDER LIST
          ================================================= */}

          {loading ? (
            <div className="orders-state">Loading orders...</div>
          ) : visibleOrders.length === 0 ? (
            <div className="orders-state orders-state--empty">
              <Package size={34} />

              <h2>No orders yet</h2>

              <p>
                {orders.length === 0
                  ? "Once an order is placed from the catalog it will show up here."
                  : "No order matches the current search or status filter."}
              </p>

              {orders.length === 0 && (
                <button
                  type="button"
                  className="orders-browse-btn"
                  onClick={() => navigate("/catalog")}
                >
                  Browse catalog
                </button>
              )}
            </div>
          ) : (
            <div className="orders-list">
              {visibleOrders.map((order) => (
                <article className="order-card" key={order.id}>
                  <div className="order-card-main">
                    <div className="order-card-head">
                      <Link
                        to={`/orders/${order.id}`}
                        className="order-number"
                      >
                        {order.orderNumber}
                      </Link>

                      <OrderStatusBadge status={order.status} />
                    </div>

                    <div className="order-card-meta">
                      <span>Placed on {formatDate(order.placedAt)}</span>

                      <span>
                        {order.itemCount} item
                        {order.itemCount === 1 ? "" : "s"} ·{" "}
                        {order.totalQuantity} unit
                        {order.totalQuantity === 1 ? "" : "s"}
                      </span>

                      <span>{order.paymentMethod}</span>
                    </div>

                    {isAdmin && order.customerEmail && (
                      <p className="order-customer">
                        {order.customerName} · {order.customerEmail}
                      </p>
                    )}

                    <p className="order-address">
                      Ship to: {order.shippingAddress}, {order.city}
                      {order.postalCode ? ` - ${order.postalCode}` : ""}
                    </p>
                  </div>

                  <div className="order-card-side">
                    <div className="order-total">
                      {formatCurrency(order.total)}
                    </div>

                    <div className="order-card-actions">
                      <Link
                        to={`/orders/${order.id}`}
                        className="order-view-btn"
                      >
                        View details
                        <ChevronRight size={15} />
                      </Link>

                      {isAdmin && NEXT_STATUS[order.status] && (
                        <button
                          type="button"
                          className="order-advance-btn"
                          disabled={busyId === order.id}
                          onClick={() => advanceStatus(order)}
                        >
                          Mark as {NEXT_STATUS[order.status]}
                        </button>
                      )}

                      {order.status !== "Cancelled" &&
                        order.status !== "Delivered" &&
                        (isAdmin ||
                          order.status === "Placed" ||
                          order.status === "Processing") && (
                          <button
                            type="button"
                            className="order-cancel-btn"
                            disabled={busyId === order.id}
                            onClick={() => cancelOrder(order)}
                          >
                            Cancel order
                          </button>
                        )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
