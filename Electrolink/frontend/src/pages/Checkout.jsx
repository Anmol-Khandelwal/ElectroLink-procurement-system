import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  Package,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

import Header from "../components/Header";
import Footer from "../components/Footer";

import api, { getErrorMessage, formatCurrency } from "../services/api";

import { useAuth } from "../context/useAuth";
import { useCart } from "../context/useCart";

import "./Checkout.css";

/* =========================================================
   CHECKOUT

   Collects the delivery details and turns the cart into a
   real order. The totals come from the same backend rules
   the order is created with, so nothing can drift.
========================================================= */

const PAYMENT_METHODS = [
  "Cash on Delivery",
  "Bank Transfer",
  "Credit Terms (30 days)",
  "UPI",
];

export default function Checkout() {
  const navigate = useNavigate();

  const { user } = useAuth();

  const { items, totals, refreshCart } = useCart();

  const [form, setForm] = useState({
    contactName: "",
    contactPhone: "",
    shippingAddress: "",
    city: "",
    postalCode: "",
    country: "India",
    paymentMethod: PAYMENT_METHODS[0],
    notes: "",
  });

  const [loading, setLoading] = useState(true);

  const [placing, setPlacing] = useState(false);

  /* Stays true once the order exists, so emptying the cart
     afterwards cannot bounce the buyer back to /cart before
     the confirmation page has opened. */

  const [placed, setPlaced] = useState(false);

  const [error, setError] = useState("");

  const [unavailableItems, setUnavailableItems] = useState([]);

  /* -------------------------------------------------------
     PREFILL FROM THE SAVED PROFILE AND COMPANY DETAILS
  ------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    const prefill = async () => {
      try {
        setLoading(true);

        const [profileResponse, companyResponse] = await Promise.allSettled([
          api.get("/settings/profile"),
          api.get("/settings/company"),
        ]);

        if (cancelled) return;

        const profile =
          profileResponse.status === "fulfilled"
            ? profileResponse.value.data.profile
            : null;

        const company =
          companyResponse.status === "fulfilled"
            ? companyResponse.value.data.company
            : null;

        setForm((current) => ({
          ...current,

          contactName:
            [profile?.firstName, profile?.lastName]
              .filter(Boolean)
              .join(" ")
              .trim() ||
            user?.name ||
            "",

          contactPhone: profile?.phone || user?.phone || "",

          shippingAddress: company?.businessAddress || "",

          city: company?.city || "",

          country: company?.country || "India",
        }));
      } catch {
        /* The form still works when nothing can be prefilled. */
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    prefill();

    return () => {
      cancelled = true;
    };
  }, [user]);

  /* Nothing to check out: send the buyer back to the cart. */

  useEffect(() => {
    if (!loading && items.length === 0 && !placing && !placed) {
      navigate("/cart", { replace: true });
    }
  }, [loading, items.length, placing, placed, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  /* -------------------------------------------------------
     PLACE THE ORDER
  ------------------------------------------------------- */

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setUnavailableItems([]);

    if (!form.contactName.trim()) {
      setError("Please enter a contact name.");
      return;
    }

    if (!form.shippingAddress.trim()) {
      setError("Please enter a delivery address.");
      return;
    }

    if (!form.city.trim()) {
      setError("Please enter a city.");
      return;
    }

    try {
      setPlacing(true);

      const { data } = await api.post("/orders", form);

      setPlaced(true);

      await refreshCart();

      navigate(`/orders/${data.order.id}`, {
        replace: true,
        state: {
          justPlaced: true,
          message: data.message,
        },
      });
    } catch (requestError) {
      const blocked = requestError.response?.data?.unavailableItems;

      if (Array.isArray(blocked) && blocked.length > 0) {
        setUnavailableItems(blocked);
      }

      setError(getErrorMessage(requestError, "Failed to place the order."));

      await refreshCart();
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="checkout-page">
      <Header />

      <main className="checkout-main">
        <button
          type="button"
          className="checkout-back"
          onClick={() => navigate("/cart")}
        >
          <ArrowLeft size={15} />
          Back to cart
        </button>

        <div className="checkout-heading">
          <h1>Checkout</h1>

          <p>Confirm the delivery details and place your procurement order.</p>
        </div>

        {error && (
          <div className="checkout-alert checkout-alert--error">
            <AlertTriangle size={16} />

            <div>
              <p>{error}</p>

              {unavailableItems.length > 0 && (
                <ul>
                  {unavailableItems.map((item) => (
                    <li key={item.productId}>
                      {item.productName}: {item.requested} requested,{" "}
                      {item.availableStock} available
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="checkout-layout">
          {/* =================================================
              DELIVERY FORM
          ================================================= */}

          <form className="checkout-form" onSubmit={handleSubmit}>
            <section className="checkout-panel">
              <h2>Delivery details</h2>

              <div className="checkout-grid">
                <label className="checkout-field">
                  <span>Contact name *</span>

                  <input
                    type="text"
                    name="contactName"
                    value={form.contactName}
                    onChange={handleChange}
                    placeholder="Person receiving the order"
                    disabled={placing}
                    required
                  />
                </label>

                <label className="checkout-field">
                  <span>Contact phone</span>

                  <input
                    type="tel"
                    name="contactPhone"
                    value={form.contactPhone}
                    onChange={handleChange}
                    placeholder="10 digit mobile number"
                    disabled={placing}
                  />
                </label>

                <label className="checkout-field checkout-field--full">
                  <span>Delivery address *</span>

                  <textarea
                    name="shippingAddress"
                    value={form.shippingAddress}
                    onChange={handleChange}
                    placeholder="Building, street, area"
                    rows="3"
                    disabled={placing}
                    required
                  />
                </label>

                <label className="checkout-field">
                  <span>City *</span>

                  <input
                    type="text"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Bengaluru"
                    disabled={placing}
                    required
                  />
                </label>

                <label className="checkout-field">
                  <span>Postal code</span>

                  <input
                    type="text"
                    name="postalCode"
                    value={form.postalCode}
                    onChange={handleChange}
                    placeholder="560001"
                    disabled={placing}
                  />
                </label>

                <label className="checkout-field">
                  <span>Country</span>

                  <input
                    type="text"
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    disabled={placing}
                  />
                </label>

                <label className="checkout-field">
                  <span>Payment method</span>

                  <select
                    name="paymentMethod"
                    value={form.paymentMethod}
                    onChange={handleChange}
                    disabled={placing}
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="checkout-field checkout-field--full">
                  <span>Order notes</span>

                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    placeholder="Any instruction for the procurement team"
                    rows="2"
                    disabled={placing}
                  />
                </label>
              </div>
            </section>

            <button
              type="submit"
              className="checkout-submit"
              disabled={placing || placed || items.length === 0}
            >
              {placing || placed ? "Placing your order..." : "Place order"}
            </button>

            <p className="checkout-secure">
              <ShieldCheck size={15} />
              Stock is reserved only once the order is confirmed.
            </p>
          </form>

          {/* =================================================
              ORDER SUMMARY
          ================================================= */}

          <aside className="checkout-summary">
            <h2>Order summary</h2>

            <div className="checkout-items">
              {items.map((item) => (
                <div className="checkout-item" key={item.productId}>
                  <div className="checkout-item-image">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} />
                    ) : (
                      <Package size={18} />
                    )}
                  </div>

                  <div className="checkout-item-info">
                    <p>{item.productName}</p>

                    <span>
                      {item.quantity} × {formatCurrency(item.price)}
                    </span>
                  </div>

                  <div className="checkout-item-total">
                    {formatCurrency(item.lineTotal)}
                  </div>
                </div>
              ))}
            </div>

            <div className="checkout-summary-row">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>

            <div className="checkout-summary-row">
              <span>GST ({Math.round((totals.taxRate || 0) * 100)}%)</span>
              <span>{formatCurrency(totals.tax)}</span>
            </div>

            <div className="checkout-summary-row">
              <span>Shipping</span>

              <span>
                {totals.shippingFee > 0
                  ? formatCurrency(totals.shippingFee)
                  : "Free"}
              </span>
            </div>

            <div className="checkout-summary-divider" />

            <div className="checkout-summary-total">
              <span>Total payable</span>

              <strong>{formatCurrency(totals.total)}</strong>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
