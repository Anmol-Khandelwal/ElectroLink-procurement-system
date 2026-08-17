import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  ArrowLeft,
  Package,
  Minus,
  Plus,
  ShoppingCart,
  Check,
  Pencil,
} from "lucide-react";

import Header from "../components/Header";
import Footer from "../components/Footer";

import api, { getErrorMessage, formatCurrency } from "../services/api";

import { useAuth } from "../context/useAuth";
import { useCart } from "../context/useCart";

import "./ProductDetails.css";

/* =========================================================
   PRODUCT DETAILS

   The full page for one component. A buyer can pick a
   quantity and put it in the cart; an administrator also
   gets a shortcut into the inventory screen.
========================================================= */

export default function ProductDetails() {
  const { id } = useParams();

  const navigate = useNavigate();

  const { isAdmin } = useAuth();

  const { addToCart, getCartItem } = useCart();

  const [product, setProduct] = useState(null);

  const [quantity, setQuantity] = useState(1);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [adding, setAdding] = useState(false);

  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProduct = async () => {
      try {
        setLoading(true);
        setError("");

        const { data } = await api.get(`/products/${id}`);

        if (!cancelled) {
          setProduct(data.product);

          setQuantity(Number(data.product.minimum_order_quantity || 1));
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            getErrorMessage(
              requestError,
              "This product could not be loaded.",
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProduct();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="details-page">
        <Header />

        <main className="details-main details-state">
          <div className="details-spinner" />
          <p>Loading product details...</p>
        </main>

        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="details-page">
        <Header />

        <main className="details-main details-state">
          <h1>Product unavailable</h1>

          <p>{error || "This product no longer exists."}</p>

          <Link to="/catalog" className="details-back-btn">
            <ArrowLeft size={15} />
            Back to catalog
          </Link>
        </main>

        <Footer />
      </div>
    );
  }

  const stock = Number(product.available_stock || 0);

  const minimumOrder = Number(product.minimum_order_quantity || 1);

  const outOfStock = stock <= 0;

  const cartItem = getCartItem(product.id);

  const changeQuantity = (change) => {
    setQuantity((current) => {
      const next = current + change;

      if (next < minimumOrder) return minimumOrder;

      if (stock > 0 && next > stock) return stock;

      return next;
    });
  };

  const handleAddToCart = async () => {
    setAdding(true);
    setNotice("");
    setError("");

    const result = await addToCart(product.id, quantity);

    setAdding(false);

    if (result.success) {
      setNotice(result.message || "Added to your cart");
      setAdded(true);

      window.setTimeout(() => setAdded(false), 1800);
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="details-page">
      <Header />

      <main className="details-main">
        <button
          type="button"
          className="details-breadcrumb"
          onClick={() => navigate("/catalog")}
        >
          <ArrowLeft size={15} />
          Back to catalog
        </button>

        {error && <div className="details-alert details-alert--error">{error}</div>}

        {notice && (
          <div className="details-alert details-alert--success">{notice}</div>
        )}

        <section className="details-card">
          {/* =================================================
              IMAGE
          ================================================= */}

          <div className="details-image">
            {product.image_url ? (
              <img src={product.image_url} alt={product.product_name} />
            ) : (
              <div className="details-image-fallback">
                <Package size={54} />
                <span>No image available</span>
              </div>
            )}
          </div>

          {/* =================================================
              INFORMATION
          ================================================= */}

          <div className="details-info">
            <div className="details-info-top">
              <span className="details-category">{product.category}</span>

              <span
                className={`details-stock details-stock--${
                  outOfStock ? "out" : stock <= minimumOrder ? "low" : "in"
                }`}
              >
                {outOfStock
                  ? "Out of stock"
                  : stock <= minimumOrder
                    ? `Only ${stock} left`
                    : `${stock} in stock`}
              </span>
            </div>

            <h1>{product.product_name}</h1>

            <p className="details-description">
              {product.description ||
                "No detailed description has been added for this component yet."}
            </p>

            <div className="details-specs">
              <div className="details-spec">
                <span>Part number</span>
                <strong>{product.part_number}</strong>
              </div>

              <div className="details-spec">
                <span>Manufacturer</span>
                <strong>{product.manufacturer || "Not specified"}</strong>
              </div>

              <div className="details-spec">
                <span>Available stock</span>
                <strong>{stock} units</strong>
              </div>

              <div className="details-spec">
                <span>Minimum order</span>
                <strong>{minimumOrder} units</strong>
              </div>
            </div>

            <div className="details-price-block">
              <span>Price per unit</span>
              <strong>{formatCurrency(product.price)}</strong>
            </div>

            {/* =================================================
                QUANTITY
            ================================================= */}

            <div className="details-quantity">
              <span className="details-quantity-label">Quantity</span>

              <div className="details-stepper">
                <button
                  type="button"
                  onClick={() => changeQuantity(-1)}
                  disabled={outOfStock || quantity <= minimumOrder}
                  aria-label="Decrease quantity"
                >
                  <Minus size={15} />
                </button>

                <span>{quantity}</span>

                <button
                  type="button"
                  onClick={() => changeQuantity(1)}
                  disabled={outOfStock || quantity >= stock}
                  aria-label="Increase quantity"
                >
                  <Plus size={15} />
                </button>
              </div>

              <span className="details-quantity-note">
                Minimum {minimumOrder}
                {stock > 0 ? `, maximum ${stock}` : ""}
              </span>
            </div>

            <div className="details-total">
              <span>Estimated total</span>

              <strong>
                {formatCurrency(Number(product.price || 0) * quantity)}
              </strong>
            </div>

            {cartItem && (
              <p className="details-incart">
                {cartItem.quantity} unit
                {cartItem.quantity === 1 ? "" : "s"} of this component are
                already in your cart.
              </p>
            )}

            {/* =================================================
                ACTIONS
            ================================================= */}

            <div className="details-actions">
              <button
                type="button"
                className="details-add-btn"
                onClick={handleAddToCart}
                disabled={outOfStock || adding}
              >
                {added ? (
                  <>
                    <Check size={16} />
                    Added to cart
                  </>
                ) : (
                  <>
                    <ShoppingCart size={16} />
                    {adding
                      ? "Adding..."
                      : outOfStock
                        ? "Out of stock"
                        : "Add to cart"}
                  </>
                )}
              </button>

              <button
                type="button"
                className="details-cart-btn"
                onClick={() => navigate("/cart")}
              >
                Go to cart
              </button>

              {isAdmin && (
                <button
                  type="button"
                  className="details-admin-btn"
                  onClick={() => navigate("/products")}
                  title="Manage this component in the inventory"
                >
                  <Pencil size={15} />
                  Manage in inventory
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
