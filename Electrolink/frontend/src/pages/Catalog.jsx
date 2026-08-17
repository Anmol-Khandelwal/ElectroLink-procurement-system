import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  Search,
  ShoppingCart,
  Package,
  Check,
  SlidersHorizontal,
} from "lucide-react";

import Header from "../components/Header";
import Footer from "../components/Footer";

import api, { getErrorMessage, formatCurrency } from "../services/api";

import { useCart } from "../context/useCart";

import "./Catalog.css";

/* =========================================================
   CATALOG

   The shopping side of ElectroLink. Every signed in account
   can browse it and add products to the cart; only the
   administrator can change what it contains, from the
   Inventory screen.
========================================================= */

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
  { value: "stock", label: "Stock: high to low" },
];

const STOCK_OPTIONS = [
  { value: "all", label: "All stock" },
  { value: "in", label: "In stock only" },
  { value: "low", label: "Low stock" },
];

function stockLabel(product) {
  const stock = Number(product.available_stock || 0);
  const minimum = Number(product.minimum_order_quantity || 1);

  if (stock <= 0) {
    return { text: "Out of stock", type: "out" };
  }

  if (stock <= minimum) {
    return { text: `Only ${stock} left`, type: "low" };
  }

  return { text: `${stock} in stock`, type: "in" };
}

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();

  const { addToCart, getCartItem } = useCart();

  const [products, setProducts] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [addingId, setAddingId] = useState(null);

  const [addedId, setAddedId] = useState(null);

  const [category, setCategory] = useState("All categories");

  const [stockFilter, setStockFilter] = useState("all");

  const [sort, setSort] = useState("newest");

  const search = searchParams.get("search") || "";

  /* -------------------------------------------------------
     LOAD THE CATALOG
  ------------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      try {
        setLoading(true);
        setError("");

        const { data } = await api.get("/products");

        if (!cancelled) {
          setProducts(Array.isArray(data.products) ? data.products : []);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            getErrorMessage(requestError, "Failed to load the catalog."),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  /* -------------------------------------------------------
     CATEGORIES
  ------------------------------------------------------- */

  const categories = useMemo(() => {
    const values = products.map((product) => product.category).filter(Boolean);

    return ["All categories", ...Array.from(new Set(values)).sort()];
  }, [products]);

  /* -------------------------------------------------------
     SEARCH, FILTER AND SORT
  ------------------------------------------------------- */

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = products.filter((product) => {
      const matchesSearch =
        !query ||
        [
          product.product_name,
          product.part_number,
          product.manufacturer,
          product.category,
          product.description,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(query),
        );

      const matchesCategory =
        category === "All categories" || product.category === category;

      const stock = Number(product.available_stock || 0);
      const minimum = Number(product.minimum_order_quantity || 1);

      let matchesStock = true;

      if (stockFilter === "in") {
        matchesStock = stock > 0;
      } else if (stockFilter === "low") {
        matchesStock = stock > 0 && stock <= minimum;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });

    const sorted = [...filtered];

    if (sort === "price-asc") {
      sorted.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sort === "price-desc") {
      sorted.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sort === "name") {
      sorted.sort((a, b) =>
        String(a.product_name).localeCompare(String(b.product_name)),
      );
    } else if (sort === "stock") {
      sorted.sort(
        (a, b) => Number(b.available_stock) - Number(a.available_stock),
      );
    }

    return sorted;
  }, [products, search, category, stockFilter, sort]);

  /* -------------------------------------------------------
     ADD TO CART
  ------------------------------------------------------- */

  const handleAddToCart = async (product) => {
    setAddingId(product.id);
    setNotice("");
    setError("");

    const result = await addToCart(
      product.id,
      Number(product.minimum_order_quantity || 1),
    );

    setAddingId(null);

    if (result.success) {
      setNotice(result.message || `${product.product_name} added to cart`);
      setAddedId(product.id);

      window.setTimeout(() => {
        setAddedId((current) => (current === product.id ? null : current));
      }, 1800);
    } else {
      setError(result.message);
    }
  };

  const handleSearchChange = (value) => {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set("search", value);
    } else {
      next.delete("search");
    }

    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => {
    setCategory("All categories");
    setStockFilter("all");
    setSort("newest");
    handleSearchChange("");
  };

  const hasFilters =
    Boolean(search) ||
    category !== "All categories" ||
    stockFilter !== "all" ||
    sort !== "newest";

  return (
    <div className="catalog-page">
      <Header />

      <main className="catalog-main">
        {/* =================================================
            HEADING
        ================================================= */}

        <div className="catalog-heading">
          <div>
            <h1>Component Catalog</h1>

            <p>
              Browse verified electronic components and add them to your
              procurement cart.
            </p>
          </div>

          <Link to="/cart" className="catalog-cart-link">
            <ShoppingCart size={16} />
            Go to cart
          </Link>
        </div>

        {/* =================================================
            MESSAGES
        ================================================= */}

        {error && <div className="catalog-alert catalog-alert--error">{error}</div>}

        {notice && (
          <div className="catalog-alert catalog-alert--success">{notice}</div>
        )}

        {/* =================================================
            FILTER BAR
        ================================================= */}

        <section className="catalog-filters">
          <div className="catalog-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Search by name, part number or manufacturer..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </div>

          <select
            className="catalog-select"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filter by category"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            className="catalog-select"
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value)}
            aria-label="Filter by availability"
          >
            {STOCK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            className="catalog-select"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label="Sort products"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {hasFilters && (
            <button
              type="button"
              className="catalog-clear-btn"
              onClick={clearFilters}
            >
              <SlidersHorizontal size={15} />
              Clear
            </button>
          )}
        </section>

        <p className="catalog-count">
          {loading
            ? "Loading components..."
            : `${visibleProducts.length} component${
                visibleProducts.length === 1 ? "" : "s"
              } found`}
        </p>

        {/* =================================================
            PRODUCT GRID
        ================================================= */}

        {loading ? (
          <div className="catalog-grid">
            {[1, 2, 3, 4, 5, 6].map((placeholder) => (
              <div className="catalog-card catalog-card--skeleton" key={placeholder}>
                <div className="catalog-card-image" />
                <div className="catalog-skeleton-line" />
                <div className="catalog-skeleton-line catalog-skeleton-line--short" />
              </div>
            ))}
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="catalog-empty">
            <Package size={34} />

            <h2>No components found</h2>

            <p>
              {products.length === 0
                ? "The catalog is empty. Once the procurement team adds components they will appear here."
                : "Try a different search term or clear the filters."}
            </p>

            {hasFilters && (
              <button
                type="button"
                className="catalog-empty-btn"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="catalog-grid">
            {visibleProducts.map((product) => {
              const availability = stockLabel(product);

              const cartItem = getCartItem(product.id);

              const outOfStock = Number(product.available_stock || 0) <= 0;

              return (
                <article className="catalog-card" key={product.id}>
                  <Link
                    to={`/catalog/${product.id}`}
                    className="catalog-card-image"
                  >
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.product_name} />
                    ) : (
                      <Package size={40} />
                    )}
                  </Link>

                  <div className="catalog-card-body">
                    <span className="catalog-card-category">
                      {product.category}
                    </span>

                    <Link
                      to={`/catalog/${product.id}`}
                      className="catalog-card-name"
                    >
                      {product.product_name}
                    </Link>

                    <p className="catalog-card-meta">
                      {product.manufacturer || "Unbranded"} ·{" "}
                      {product.part_number}
                    </p>

                    <div className="catalog-card-price-row">
                      <span className="catalog-card-price">
                        {formatCurrency(product.price)}
                      </span>

                      <span
                        className={`catalog-card-stock catalog-card-stock--${availability.type}`}
                      >
                        {availability.text}
                      </span>
                    </div>

                    <p className="catalog-card-moq">
                      Minimum order: {product.minimum_order_quantity || 1} unit
                      {Number(product.minimum_order_quantity || 1) === 1
                        ? ""
                        : "s"}
                    </p>

                    {cartItem && (
                      <p className="catalog-card-incart">
                        {cartItem.quantity} already in your cart
                      </p>
                    )}

                    <div className="catalog-card-actions">
                      <button
                        type="button"
                        className="catalog-add-btn"
                        disabled={outOfStock || addingId === product.id}
                        onClick={() => handleAddToCart(product)}
                      >
                        {addedId === product.id ? (
                          <>
                            <Check size={15} />
                            Added
                          </>
                        ) : (
                          <>
                            <ShoppingCart size={15} />
                            {addingId === product.id
                              ? "Adding..."
                              : outOfStock
                                ? "Out of stock"
                                : "Add to cart"}
                          </>
                        )}
                      </button>

                      <Link
                        to={`/catalog/${product.id}`}
                        className="catalog-details-btn"
                      >
                        Details
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
