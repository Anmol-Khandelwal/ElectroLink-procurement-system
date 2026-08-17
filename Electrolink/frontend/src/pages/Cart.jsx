import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  ShoppingCart,
  Package,
  AlertTriangle,
  Truck,
} from "lucide-react";

import Header from "../components/Header";
import Footer from "../components/Footer";

import { formatCurrency } from "../services/api";

import { useCart } from "../context/useCart";

import "./Cart.css";

/* =========================================================
   CART

   Reads and writes the cart stored against the account, so
   the contents survive a refresh, a logout and a different
   device.
========================================================= */

export default function Cart() {
  const navigate = useNavigate();

  const {
    items,
    totals,
    loading,
    error,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  const [busyId, setBusyId] = useState(null);

  const [notice, setNotice] = useState("");

  const [localError, setLocalError] = useState("");

  const runAction = async (productId, action) => {
    setBusyId(productId);
    setNotice("");
    setLocalError("");

    const result = await action();

    setBusyId(null);

    if (!result.success) {
      setLocalError(result.message);
    } else if (result.message) {
      setNotice(result.message);
    }
  };

  const handleClearCart = async () => {
    const confirmed = window.confirm(
      "Remove every item from your cart?",
    );

    if (!confirmed) return;

    await runAction("all", clearCart);
  };

  const blockedItems = items.filter(
    (item) => !item.inStock || item.exceedsStock,
  );

  const canCheckout = items.length > 0 && blockedItems.length === 0;

  const amountToFreeShipping =
    totals.subtotal > 0 && totals.shippingFee > 0
      ? Number(totals.freeShippingThreshold) - Number(totals.subtotal)
      : 0;

  return (
    <div className="cart-page">
      <Header />

      <main className="cart-main">
        {/* =================================================
            HEADING
        ================================================= */}

        <div className="cart-heading">
          <div>
            <h1>Shopping Cart</h1>

            <p>Review your selected electronic components before checkout.</p>
          </div>

          {items.length > 0 && (
            <button
              type="button"
              className="cart-clear-btn"
              onClick={handleClearCart}
            >
              Clear cart
            </button>
          )}
        </div>

        {/* =================================================
            MESSAGES
        ================================================= */}

        {(error || localError) && (
          <div className="cart-alert cart-alert--error">
            {localError || error}
          </div>
        )}

        {notice && <div className="cart-alert cart-alert--info">{notice}</div>}

        {blockedItems.length > 0 && (
          <div className="cart-alert cart-alert--warning">
            <AlertTriangle size={16} />

            <span>
              {blockedItems.length} item
              {blockedItems.length === 1 ? " is" : "s are"} no longer available
              in the requested quantity. Reduce the quantity or remove the item
              to continue.
            </span>
          </div>
        )}

        {/* =================================================
            CONTENT
        ================================================= */}

        {loading && items.length === 0 ? (
          <section className="cart-empty">
            <div className="cart-empty-icon">
              <ShoppingCart size={34} />
            </div>

            <h2>Loading your cart...</h2>
          </section>
        ) : items.length === 0 ? (
          <section className="cart-empty">
            <div className="cart-empty-icon">
              <ShoppingCart size={34} />
            </div>

            <h2>Your cart is empty</h2>

            <p>
              Add components from the catalog to start building your
              procurement order.
            </p>

            <button
              type="button"
              className="cart-browse-btn"
              onClick={() => navigate("/catalog")}
            >
              Browse catalog
            </button>
          </section>
        ) : (
          <div className="cart-layout">
            {/* =================================================
                ITEMS
            ================================================= */}

            <section className="cart-items-panel">
              <div className="cart-panel-header">
                <h2>
                  Cart items ({items.length}) · {totals.totalQuantity} unit
                  {totals.totalQuantity === 1 ? "" : "s"}
                </h2>
              </div>

              <div className="cart-items">
                {items.map((item) => {
                  const busy = busyId === item.productId;

                  return (
                    <div
                      className={`cart-item ${
                        item.exceedsStock || !item.inStock
                          ? "cart-item--blocked"
                          : ""
                      }`}
                      key={item.productId}
                    >
                      <Link
                        to={`/catalog/${item.productId}`}
                        className="cart-item-image"
                      >
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.productName} />
                        ) : (
                          <Package size={26} />
                        )}
                      </Link>

                      <div className="cart-item-info">
                        <Link
                          to={`/catalog/${item.productId}`}
                          className="cart-item-name"
                        >
                          {item.productName}
                        </Link>

                        <p className="cart-item-sku">
                          {item.partNumber || "No part number"}
                        </p>

                        <span className="cart-item-supplier">
                          {item.manufacturer || "Supplier not specified"}
                        </span>

                        <span className="cart-item-unit">
                          {formatCurrency(item.price)} per unit
                        </span>

                        {!item.inStock && (
                          <span className="cart-item-warning">
                            Out of stock
                          </span>
                        )}

                        {item.inStock && item.exceedsStock && (
                          <span className="cart-item-warning">
                            Only {item.availableStock} available
                          </span>
                        )}
                      </div>

                      <div className="cart-item-quantity">
                        <button
                          type="button"
                          disabled={
                            busy ||
                            item.quantity <= item.minimumOrderQuantity
                          }
                          onClick={() =>
                            runAction(item.productId, () =>
                              updateQuantity(
                                item.productId,
                                item.quantity - 1,
                              ),
                            )
                          }
                          aria-label={`Decrease quantity of ${item.productName}`}
                        >
                          <Minus size={14} />
                        </button>

                        <span>{item.quantity}</span>

                        <button
                          type="button"
                          disabled={
                            busy || item.quantity >= item.availableStock
                          }
                          onClick={() =>
                            runAction(item.productId, () =>
                              updateQuantity(
                                item.productId,
                                item.quantity + 1,
                              ),
                            )
                          }
                          aria-label={`Increase quantity of ${item.productName}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <div className="cart-item-price">
                        {formatCurrency(item.lineTotal)}
                      </div>

                      <button
                        type="button"
                        className="cart-delete-btn"
                        disabled={busy}
                        onClick={() =>
                          runAction(item.productId, () =>
                            removeFromCart(item.productId),
                          )
                        }
                        title={`Remove ${item.productName}`}
                        aria-label={`Remove ${item.productName}`}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* =================================================
                SUMMARY
            ================================================= */}

            <section className="cart-summary">
              <h2>Order summary</h2>

              <div className="cart-summary-row">
                <span>Items</span>
                <span>{items.length}</span>
              </div>

              <div className="cart-summary-row">
                <span>Units</span>
                <span>{totals.totalQuantity}</span>
              </div>

              <div className="cart-summary-row">
                <span>Subtotal</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>

              <div className="cart-summary-row">
                <span>GST ({Math.round((totals.taxRate || 0) * 100)}%)</span>
                <span>{formatCurrency(totals.tax)}</span>
              </div>

              <div className="cart-summary-row">
                <span>Shipping</span>

                <span>
                  {totals.shippingFee > 0
                    ? formatCurrency(totals.shippingFee)
                    : "Free"}
                </span>
              </div>

              {amountToFreeShipping > 0 && (
                <p className="cart-shipping-hint">
                  <Truck size={14} />
                  Add {formatCurrency(amountToFreeShipping)} more for free
                  shipping.
                </p>
              )}

              <div className="cart-summary-divider" />

              <div className="cart-summary-total">
                <span>Total</span>

                <strong>{formatCurrency(totals.total)}</strong>
              </div>

              <button
                type="button"
                className="cart-checkout-btn"
                disabled={!canCheckout}
                onClick={() => navigate("/checkout")}
              >
                Proceed to checkout
              </button>

              <button
                type="button"
                className="cart-continue-btn"
                onClick={() => navigate("/catalog")}
              >
                <ArrowLeft size={15} />
                Continue shopping
              </button>
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
