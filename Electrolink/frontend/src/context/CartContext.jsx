import { useCallback, useEffect, useMemo, useState } from "react";

import api, { getErrorMessage } from "../services/api";

import { useAuth } from "./useAuth";

import { CartContext } from "./useCart";

/* =========================================================
   CART CONTEXT

   The cart is stored in PostgreSQL against the account, the
   same way Amazon or Flipkart keep a cart: it survives a
   refresh, a logout and a different device.

   Anything collected before signing in is kept in the
   browser and merged into the account cart at login.
========================================================= */

const GUEST_CART_KEY = "electrolink_cart";

const EMPTY_TOTALS = {
  itemCount: 0,
  totalQuantity: 0,
  subtotal: 0,
  tax: 0,
  taxRate: 0.18,
  shippingFee: 0,
  freeShippingThreshold: 5000,
  total: 0,
};

function readGuestCart() {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);

    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clearGuestCart() {
  localStorage.removeItem(GUEST_CART_KEY);
}

export function CartProvider({ children }) {
  const { isAuthenticated, user } = useAuth();

  const [items, setItems] = useState([]);

  const [totals, setTotals] = useState(EMPTY_TOTALS);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const applyCart = useCallback((cart) => {
    setItems(Array.isArray(cart?.items) ? cart.items : []);
    setTotals(cart?.totals || EMPTY_TOTALS);
  }, []);

  const resetCart = useCallback(() => {
    setItems([]);
    setTotals(EMPTY_TOTALS);
  }, []);

  /* -------------------------------------------------------
     LOAD THE CART
  ------------------------------------------------------- */

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      resetCart();
      return;
    }

    try {
      setLoading(true);
      setError("");

      const { data } = await api.get("/cart");

      applyCart(data.cart);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Failed to load your cart."));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, applyCart, resetCart]);

  /* -------------------------------------------------------
     LOAD AND MERGE WHEN THE ACCOUNT CHANGES
  ------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!isAuthenticated) {
        resetCart();
        return;
      }

      try {
        setLoading(true);
        setError("");

        const guestItems = readGuestCart();

        if (guestItems.length > 0) {
          const { data } = await api.post("/cart/merge", {
            items: guestItems.map((item) => ({
              product_id: item.productId ?? item.product_id ?? item.id,
              quantity: item.quantity ?? 1,
            })),
          });

          clearGuestCart();

          if (!cancelled) {
            applyCart(data.cart);
          }

          return;
        }

        const { data } = await api.get("/cart");

        if (!cancelled) {
          applyCart(data.cart);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            getErrorMessage(requestError, "Failed to load your cart."),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id, applyCart, resetCart]);

  /* -------------------------------------------------------
     ADD TO CART
  ------------------------------------------------------- */

  const addToCart = useCallback(
    async (productId, quantity) => {
      try {
        setError("");

        const { data } = await api.post("/cart", {
          product_id: productId,
          quantity,
        });

        applyCart(data.cart);

        return {
          success: true,
          message: data.message,
        };
      } catch (requestError) {
        const message = getErrorMessage(
          requestError,
          "Could not add this product to your cart.",
        );

        setError(message);

        return {
          success: false,
          message,
        };
      }
    },
    [applyCart],
  );

  /* -------------------------------------------------------
     UPDATE QUANTITY
  ------------------------------------------------------- */

  const updateQuantity = useCallback(
    async (productId, quantity) => {
      try {
        setError("");

        const { data } = await api.put(`/cart/${productId}`, {
          quantity,
        });

        applyCart(data.cart);

        return {
          success: true,
          message: data.message,
        };
      } catch (requestError) {
        const message = getErrorMessage(
          requestError,
          "Could not update the quantity.",
        );

        setError(message);

        return {
          success: false,
          message,
        };
      }
    },
    [applyCart],
  );

  /* -------------------------------------------------------
     REMOVE ONE ITEM
  ------------------------------------------------------- */

  const removeFromCart = useCallback(
    async (productId) => {
      try {
        setError("");

        const { data } = await api.delete(`/cart/${productId}`);

        applyCart(data.cart);

        return {
          success: true,
          message: data.message,
        };
      } catch (requestError) {
        const message = getErrorMessage(
          requestError,
          "Could not remove this item.",
        );

        setError(message);

        return {
          success: false,
          message,
        };
      }
    },
    [applyCart],
  );

  /* -------------------------------------------------------
     CLEAR THE CART
  ------------------------------------------------------- */

  const clearCart = useCallback(async () => {
    try {
      setError("");

      const { data } = await api.delete("/cart");

      applyCart(data.cart);

      return {
        success: true,
      };
    } catch (requestError) {
      const message = getErrorMessage(
        requestError,
        "Could not clear your cart.",
      );

      setError(message);

      return {
        success: false,
        message,
      };
    }
  }, [applyCart]);

  /* -------------------------------------------------------
     HELPERS FOR THE PRODUCT PAGES
  ------------------------------------------------------- */

  const getCartItem = useCallback(
    (productId) =>
      items.find((item) => Number(item.productId) === Number(productId)) ||
      null,
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      totals,
      loading,
      error,

      /* The badge on the navbar shows the number of units,
         like every shopping site does. */
      cartCount: totals.totalQuantity || 0,

      refreshCart,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      resetCart,
      getCartItem,
    }),
    [
      items,
      totals,
      loading,
      error,
      refreshCart,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      resetCart,
      getCartItem,
    ],
  );

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

