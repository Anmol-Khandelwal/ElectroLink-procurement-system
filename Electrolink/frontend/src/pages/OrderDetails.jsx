import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  Package,
  CheckCircle,
  MapPin,
  CreditCard,
  StickyNote,
} from "lucide-react";

import Header from "../components/Header";
import Footer from "../components/Footer";

import { OrderStatusBadge } from "./Orders";

import api, {
  getErrorMessage,
  formatCurrency,
  formatDateTime,
} from "../services/api";

import { useAuth } from "../context/useAuth";

import "./OrderDetails.css";

/* =========================================================
   ORDER DETAILS

   The full record of one order: every line, the delivery
   details and the money breakdown. The administrator can
   also move it through the fulfilment statuses from here.
========================================================= */

const ORDER_STATUSES = [
  "Placed",
  "Processing",
  "Shipped",
  "Delivered",
];

export default function OrderDetails() {
  const { id } = useParams();

  const navigate = useNavigate();

  const location = useLocation();

  const { isAdmin } = useAuth();

  const [order, setOrder] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState(
    location.state?.justPlaced ? location.state.message : "",
  );

  const [busy, setBusy] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const { data } = await api.get(`/orders/${id}`);

      setOrder(data.order);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Failed to load this order."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  /* -------------------------------------------------------
     ACTIONS
  ------------------------------------------------------- */

  const changeStatus = async (status) => {
    try {
      setBusy(true);
      setError("");
      setNotice("");

      const { data } = await api.patch(`/orders/${id}/status`, { status });

      setNotice(data.message);

      await loadOrder();
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Failed to update the order status."),
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async () => {
    const confirmed = window.confirm(
      `Cancel order ${order.orderNumber}? The reserved stock goes back to the catalog.`,
    );

    if (!confirmed) return;

    try {
      setBusy(true);
      setError("");
      setNotice("");

      const { data } = await api.post(`/orders/${id}/cancel`);

      setNotice(data.message);

      await loadOrder();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Failed to cancel the order."));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="order-page">
        <Header />

        <main className="order-main order-state">Loading order...</main>

        <Footer />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="order-page">
        <Header />

        <main className="order-main order-state">
          <h1>Order unavailable</h1>

          <p>{error}</p>

          <Link to="/orders" className="order-back-link">
            <ArrowLeft size={15} />
            Back to orders
          </Link>
        </main>

        <Footer />
      </div>
    );
  }

  const canBuyerCancel =
    order.status === "Placed" || order.status === "Processing";

  const timelineIndex = ORDER_STATUSES.indexOf(order.status);

  return (
    <div className="order-page">
      <Header />

      <main className="order-main">
        <button
          type="button"
          className="order-back"
          onClick={() => navigate("/orders")}
        >
          <ArrowLeft size={15} />
          Back to orders
        </button>

        {/* =================================================
            MESSAGES
        ================================================= */}

        {location.state?.justPlaced && (
          <div className="order-placed">
            <CheckCircle size={22} />

            <div>
              <h2>Thank you, your order is confirmed</h2>

              <p>
                We have sent {order.orderNumber} to the procurement team. You
                can follow its progress on this page.
              </p>
            </div>
          </div>
        )}

        {error && <div className="order-alert order-alert--error">{error}</div>}

        {notice && !location.state?.justPlaced && (
          <div className="order-alert order-alert--success">{notice}</div>
        )}

        {/* =================================================
            HEADING
        ================================================= */}

        <div className="order-heading">
          <div>
            <h1>{order.orderNumber}</h1>

            <p>Placed on {formatDateTime(order.placedAt)}</p>
          </div>

          <OrderStatusBadge status={order.status} />
        </div>

        {/* =================================================
            TIMELINE
        ================================================= */}

        {order.status !== "Cancelled" ? (
          <div className="order-timeline">
            {ORDER_STATUSES.map((status, index) => (
              <div
                className={`order-timeline-step ${
                  index <= timelineIndex ? "order-timeline-step--done" : ""
                }`}
                key={status}
              >
                <span className="order-timeline-dot" />

                <span className="order-timeline-label">{status}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="order-cancelled-banner">
            This order was cancelled and the stock has been returned to the
            catalog.
          </div>
        )}

        <div className="order-layout">
          {/* =================================================
              ITEMS
          ================================================= */}

          <section className="order-panel">
            <h2>
              Items ({order.itemCount}) · {order.totalQuantity} unit
              {order.totalQuantity === 1 ? "" : "s"}
            </h2>

            <div className="order-items">
              {order.items.map((item) => (
                <div className="order-item" key={item.id}>
                  <div className="order-item-image">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} />
                    ) : (
                      <Package size={22} />
                    )}
                  </div>

                  <div className="order-item-info">
                    {item.productId ? (
                      <Link to={`/catalog/${item.productId}`}>
                        {item.productName}
                      </Link>
                    ) : (
                      <span className="order-item-name">
                        {item.productName}
                      </span>
                    )}

                    <p>
                      {item.partNumber || "No part number"} ·{" "}
                      {item.manufacturer || "Supplier not specified"}
                    </p>

                    <span>
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </span>
                  </div>

                  <div className="order-item-total">
                    {formatCurrency(item.lineTotal)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* =================================================
              SIDE PANELS
          ================================================= */}

          <aside className="order-side">
            <section className="order-panel">
              <h2>Payment summary</h2>

              <div className="order-summary-row">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>

              <div className="order-summary-row">
                <span>GST</span>
                <span>{formatCurrency(order.tax)}</span>
              </div>

              <div className="order-summary-row">
                <span>Shipping</span>

                <span>
                  {order.shippingFee > 0
                    ? formatCurrency(order.shippingFee)
                    : "Free"}
                </span>
              </div>

              <div className="order-summary-divider" />

              <div className="order-summary-total">
                <span>Total</span>
                <strong>{formatCurrency(order.total)}</strong>
              </div>

              <p className="order-payment-method">
                <CreditCard size={14} />
                {order.paymentMethod}
              </p>
            </section>

            <section className="order-panel">
              <h2>Delivery details</h2>

              <p className="order-address-line">
                <MapPin size={14} />

                <span>
                  <strong>{order.contactName}</strong>
                  <br />
                  {order.shippingAddress}
                  <br />
                  {order.city}
                  {order.postalCode ? ` - ${order.postalCode}` : ""}
                  <br />
                  {order.country}
                  {order.contactPhone ? (
                    <>
                      <br />
                      {order.contactPhone}
                    </>
                  ) : null}
                </span>
              </p>

              {order.notes && (
                <p className="order-notes">
                  <StickyNote size={14} />
                  {order.notes}
                </p>
              )}

              {isAdmin && order.customerEmail && (
                <p className="order-customer-line">
                  Ordered by {order.customerName} ({order.customerEmail})
                </p>
              )}
            </section>

            {/* =================================================
                ACTIONS
            ================================================= */}

            {(isAdmin || canBuyerCancel) && order.status !== "Cancelled" && (
              <section className="order-panel">
                <h2>{isAdmin ? "Manage this order" : "Need a change?"}</h2>

                {isAdmin && (
                  <div className="order-status-buttons">
                    {ORDER_STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={`order-status-btn ${
                          order.status === status
                            ? "order-status-btn--active"
                            : ""
                        }`}
                        disabled={busy || order.status === status}
                        onClick={() => changeStatus(status)}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                )}

                {(isAdmin || canBuyerCancel) &&
                  order.status !== "Delivered" && (
                    <button
                      type="button"
                      className="order-cancel-full-btn"
                      disabled={busy}
                      onClick={cancelOrder}
                    >
                      Cancel this order
                    </button>
                  )}

                {!isAdmin && (
                  <p className="order-cancel-note">
                    An order can be cancelled until it is shipped.
                  </p>
                )}
              </section>
            )}
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
