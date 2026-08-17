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
  Plus,
  MoreVertical,
  ChevronDown,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  X,
  Pencil,
  Trash2,
  Save,
} from "lucide-react";

import api, { getErrorMessage, formatCurrency } from "../services/api";

import "./Products.css";

const EMPTY_FORM = {
  product_name: "",
  category: "",
  manufacturer: "",
  part_number: "",
  description: "",
  price: "",
  available_stock: "",
  minimum_order_quantity: "1",
  image_url: "",
};

function ProductStatus({ status, type }) {
  return (
    <span className={`product-status product-status--${type}`}>
      {status}
    </span>
  );
}

function normalizeProduct(product) {
  const stock = Number(product.available_stock ?? 0);
  const minimumOrder = Number(product.minimum_order_quantity ?? 1);

  let status = "In Stock";
  let statusType = "instock";

  if (stock <= 0) {
    status = "Out of Stock";
    statusType = "outstock";
  } else if (stock <= minimumOrder) {
    status = "Low Stock";
    statusType = "lowstock";
  }

  return {
    ...product,
    displayId: `PRD-${String(product.id).padStart(3, "0")}`,
    name: product.product_name || "",
    sku: product.part_number || "",
    supplier: product.manufacturer || "",
    stock,
    priceValue: Number(product.price ?? 0),
    price: formatCurrency(product.price),
    status,
    statusType,
  };
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [stockFilter, setStockFilter] = useState("All Stock");
  const [showFilters, setShowFilters] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showStockMenu, setShowStockMenu] = useState(false);

  const [openActionId, setOpenActionId] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [page, setPage] = useState(1);
  const pageSize = 8;

  /* Every call goes through the shared axios client, which
     attaches the token and signs the user out when the
     session has expired. */

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const { data } = await api.get("/products");

      setProducts(
        Array.isArray(data.products)
          ? data.products.map(normalizeProduct)
          : []
      );
    } catch (err) {
      console.error("Products API error:", err);
      setError(getErrorMessage(err, "Failed to fetch products"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const categories = useMemo(() => {
    const values = products
      .map((product) => product.category)
      .filter(Boolean);

    return ["All Categories", ...Array.from(new Set(values)).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        [
          product.name,
          product.sku,
          product.supplier,
          product.category,
          product.displayId,
        ].some((value) =>
          String(value || "").toLowerCase().includes(query)
        );

      const matchesCategory =
        category === "All Categories" || product.category === category;

      let matchesStock = true;

      if (stockFilter === "In Stock") {
        matchesStock = product.stock > product.minimum_order_quantity;
      } else if (stockFilter === "Low Stock") {
        matchesStock =
          product.stock > 0 &&
          product.stock <= product.minimum_order_quantity;
      } else if (stockFilter === "Out of Stock") {
        matchesStock = product.stock <= 0;
      }

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, search, category, stockFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / pageSize)
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, category, stockFilter]);

  const visibleProducts = filteredProducts.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const totalProducts = products.length;
  const inStock = products.filter(
    (product) => product.stock > product.minimum_order_quantity
  ).length;
  const lowStock = products.filter(
    (product) =>
      product.stock > 0 &&
      product.stock <= product.minimum_order_quantity
  ).length;
  const outOfStock = products.filter((product) => product.stock <= 0).length;

  const openAddModal = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setShowModal(true);
    setOpenActionId(null);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setForm({
      product_name: product.product_name || "",
      category: product.category || "",
      manufacturer: product.manufacturer || "",
      part_number: product.part_number || "",
      description: product.description || "",
      price: product.price ?? "",
      available_stock: product.available_stock ?? "",
      minimum_order_quantity: product.minimum_order_quantity ?? "1",
      image_url: product.image_url || "",
    });
    setError("");
    setSuccess("");
    setShowModal(true);
    setOpenActionId(null);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setEditingProduct(null);
    setForm(EMPTY_FORM);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSaveProduct = async (event) => {
    event.preventDefault();

    if (
      !form.product_name.trim() ||
      !form.category.trim() ||
      !form.manufacturer.trim() ||
      !form.part_number.trim()
    ) {
      setError(
        "Product name, category, manufacturer and part number are required."
      );
      return;
    }

    const price = Number(form.price);
    const stock = Number(form.available_stock);
    const minimumOrder = Number(form.minimum_order_quantity);

    if (!Number.isFinite(price) || price < 0) {
      setError("Please enter a valid price.");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setError("Available stock must be a whole number greater than or equal to 0.");
      return;
    }

    if (!Number.isInteger(minimumOrder) || minimumOrder < 1) {
      setError("Minimum order quantity must be at least 1.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        product_name: form.product_name.trim(),
        category: form.category.trim(),
        manufacturer: form.manufacturer.trim(),
        part_number: form.part_number.trim(),
        description: form.description.trim(),
        price,
        available_stock: stock,
        minimum_order_quantity: minimumOrder,
        image_url: form.image_url.trim(),
      };

      const { data } = editingProduct
        ? await api.put(`/products/${editingProduct.id}`, payload)
        : await api.post("/products", payload);

      const savedProduct = normalizeProduct(data.product);

      if (editingProduct) {
        setProducts((current) =>
          current.map((product) =>
            product.id === savedProduct.id ? savedProduct : product
          )
        );
        setSuccess("Product updated successfully.");
      } else {
        setProducts((current) => [savedProduct, ...current]);
        setSuccess("Product added successfully.");
      }

      setShowModal(false);
      setEditingProduct(null);
      setForm(EMPTY_FORM);
      setPage(1);
    } catch (err) {
      console.error("Save product error:", err);
      setError(getErrorMessage(err, "Failed to save product."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (product) => {
    setOpenActionId(null);

    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.name}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");

      await api.delete(`/products/${product.id}`);

      setProducts((current) =>
        current.filter((item) => item.id !== product.id)
      );

      setSuccess("Product deleted successfully.");
    } catch (err) {
      console.error("Delete product error:", err);
      setError(getErrorMessage(err, "Failed to delete product."));
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("All Categories");
    setStockFilter("All Stock");
    setShowFilters(false);
  };

  const goToPage = (nextPage) => {
    const safePage = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(safePage);
  };

  const pageNumbers = useMemo(() => {
    const numbers = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) {
        numbers.push(i);
      }
      return numbers;
    }

    numbers.push(1);

    if (page > 3) numbers.push("...");

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let i = start; i <= end; i += 1) {
      if (!numbers.includes(i)) numbers.push(i);
    }

    if (page < totalPages - 2) numbers.push("...");

    numbers.push(totalPages);

    return numbers;
  }, [page, totalPages]);

  return (
    <div className="products-page">
      <Header />

      {/* =================================================
          BODY
      ================================================= */}
      <div className="el-body">
        <aside className="el-sidebar">
          <div className="el-sidebar-header">
            <h2>Admin Dashboard</h2>
            <p>Procurement Control</p>
          </div>

          <nav className="el-sidebar-nav">
            <Link to="/dashboard" className="el-sidebar-link">
              <LayoutGrid size={16} />
              <span>Analytics</span>
            </Link>

            <Link
              to="/products"
              className="el-sidebar-link el-sidebar-link--active"
            >
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
        <main className="products-main">
          <div className="products-heading">
            <div>
              <h1>Products</h1>
              <p>Manage your electronic components and inventory.</p>
            </div>

            <button className="add-product-btn" onClick={openAddModal}>
              <Plus size={15} />
              <span>Add Product</span>
            </button>
          </div>

          {/* =================================================
              STAT CARDS
          ================================================= */}
          <div className="products-stats-grid">
            <div className="product-stat-card">
              <div className="product-stat-label">TOTAL PRODUCTS</div>
              <div className="product-stat-value">{totalProducts}</div>
              <div className="product-stat-note">Products in catalog</div>
            </div>

            <div className="product-stat-card">
              <div className="product-stat-label">IN STOCK</div>
              <div className="product-stat-value">{inStock}</div>
              <div className="product-stat-note">Currently available</div>
            </div>

            <div className="product-stat-card">
              <div className="product-stat-label">LOW STOCK</div>
              <div className="product-stat-value product-stat-value--orange">
                {lowStock}
              </div>
              <div className="product-stat-note">Requires attention</div>
            </div>

            <div className="product-stat-card">
              <div className="product-stat-label">OUT OF STOCK</div>
              <div className="product-stat-value product-stat-value--red">
                {outOfStock}
              </div>
              <div className="product-stat-note">Requires immediate action</div>
            </div>
          </div>

          {error && !showModal && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                border: "1px solid #f0b6b6",
                background: "#fff5f5",
                color: "#c62828",
                fontSize: 13,
                borderRadius: 4,
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                marginTop: 16,
                padding: "12px 14px",
                border: "1px solid #b8e2cc",
                background: "#f2fbf6",
                color: "#19744a",
                fontSize: 13,
                borderRadius: 4,
              }}
            >
              {success}
            </div>
          )}

          {/* =================================================
              PRODUCT PANEL
          ================================================= */}
          <section className="products-panel">
            <div className="products-filter-bar">
              <div className="products-table-search">
                <Search size={17} />
                <input
                  type="text"
                  placeholder="Search product, SKU, supplier..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  className="product-filter-select"
                  onClick={() => {
                    setShowCategoryMenu((current) => !current);
                    setShowStockMenu(false);
                  }}
                >
                  <span>{category}</span>
                  <ChevronDown size={15} />
                </button>

                {showCategoryMenu && (
                  <div style={menuStyle}>
                    {categories.map((item) => (
                      <button
                        type="button"
                        key={item}
                        style={menuItemStyle}
                        onClick={() => {
                          setCategory(item);
                          setShowCategoryMenu(false);
                        }}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  className="product-filter-select"
                  onClick={() => {
                    setShowStockMenu((current) => !current);
                    setShowCategoryMenu(false);
                  }}
                >
                  <span>{stockFilter}</span>
                  <ChevronDown size={15} />
                </button>

                {showStockMenu && (
                  <div style={menuStyle}>
                    {["All Stock", "In Stock", "Low Stock", "Out of Stock"].map(
                      (item) => (
                        <button
                          type="button"
                          key={item}
                          style={menuItemStyle}
                          onClick={() => {
                            setStockFilter(item);
                            setShowStockMenu(false);
                          }}
                        >
                          {item}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="product-filters-btn"
                onClick={() => setShowFilters((current) => !current)}
              >
                <SlidersHorizontal size={15} />
                <span>Filters</span>
              </button>
            </div>

            {showFilters && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 20px",
                  borderBottom: "1px solid #dfe4ea",
                  background: "#fafbfd",
                  fontSize: 13,
                }}
              >
                <span>
                  Showing {filteredProducts.length} matching product
                  {filteredProducts.length === 1 ? "" : "s"}
                </span>

                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    border: 0,
                    background: "transparent",
                    color: "#0566c9",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}

            <div className="products-table-wrapper">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>SKU</th>
                    <th>CATEGORY</th>
                    <th>SUPPLIER</th>
                    <th>STOCK</th>
                    <th>PRICE</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={emptyCellStyle}>
                        Loading products...
                      </td>
                    </tr>
                  ) : visibleProducts.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={emptyCellStyle}>
                        {products.length === 0
                          ? "No products found. Click Add Product to create your first product."
                          : "No products match your current search or filters."}
                      </td>
                    </tr>
                  ) : (
                    visibleProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <div className="product-name-wrapper">
                            <div className="product-image-placeholder">
                              <Package size={16} />
                            </div>

                            <div>
                              <div className="product-name">{product.name}</div>
                              <div className="product-id">
                                {product.displayId}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="product-sku">{product.sku}</span>
                        </td>

                        <td>
                          <span className="product-category">
                            {product.category}
                          </span>
                        </td>

                        <td>
                          <span className="product-supplier">
                            {product.supplier}
                          </span>
                        </td>

                        <td>
                          <span
                            className={
                              product.stock === 0
                                ? "product-stock product-stock--zero"
                                : product.stock <= product.minimum_order_quantity
                                ? "product-stock product-stock--low"
                                : "product-stock"
                            }
                          >
                            {product.stock}
                          </span>
                        </td>

                        <td>
                          <span className="product-price">{product.price}</span>
                        </td>

                        <td>
                          <ProductStatus
                            status={product.status}
                            type={product.statusType}
                          />
                        </td>

                        <td>
                          <div style={{ position: "relative" }}>
                            <button
                              type="button"
                              className="product-action-btn"
                              onClick={() =>
                                setOpenActionId((current) =>
                                  current === product.id ? null : product.id
                                )
                              }
                              aria-label={`Actions for ${product.name}`}
                            >
                              <MoreVertical size={17} />
                            </button>

                            {openActionId === product.id && (
                              <div style={actionMenuStyle}>
                                <button
                                  type="button"
                                  style={actionMenuItemStyle}
                                  onClick={() => openEditModal(product)}
                                >
                                  <Pencil size={14} />
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  style={{
                                    ...actionMenuItemStyle,
                                    color: "#c62828",
                                  }}
                                  onClick={() => handleDeleteProduct(product)}
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
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

            <div className="products-pagination">
              <div className="products-pagination-info">
                Showing{" "}
                {filteredProducts.length === 0
                  ? 0
                  : (page - 1) * pageSize + 1}{" "}
                to {Math.min(page * pageSize, filteredProducts.length)} of{" "}
                {filteredProducts.length} products
              </div>

              <div className="products-pagination-controls">
                <button
                  type="button"
                  className="product-page-arrow"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft size={15} />
                </button>

                {pageNumbers.map((number, index) =>
                  number === "..." ? (
                    <span
                      className="product-page-dots"
                      key={`dots-${index}`}
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      type="button"
                      key={number}
                      className={`product-page-number ${
                        page === number
                          ? "product-page-number--active"
                          : ""
                      }`}
                      onClick={() => goToPage(number)}
                    >
                      {number}
                    </button>
                  )
                )}

                <button
                  type="button"
                  className="product-page-arrow"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      <Footer />

      {/* =================================================
          ADD / EDIT PRODUCT MODAL
      ================================================= */}
      {showModal && (
        <div style={modalOverlayStyle} onMouseDown={closeModal}>
          <div
            style={modalStyle}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={modalTitleStyle}>
                  {editingProduct ? "Edit Product" : "Add Product"}
                </h2>
                <p style={modalSubtitleStyle}>
                  {editingProduct
                    ? "Update the product information below."
                    : "Enter the product information to add it to your catalog."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                style={closeButtonStyle}
              >
                <X size={19} />
              </button>
            </div>

            {error && (
              <div style={modalErrorStyle}>
                {error}
              </div>
            )}

            <form onSubmit={handleSaveProduct}>
              <div style={formGridStyle}>
                <FormField
                  label="Product Name *"
                  name="product_name"
                  value={form.product_name}
                  onChange={handleFormChange}
                  placeholder="e.g. ESP32 Development Board"
                />

                <FormField
                  label="Category *"
                  name="category"
                  value={form.category}
                  onChange={handleFormChange}
                  placeholder="e.g. Microcontrollers"
                />

                <FormField
                  label="Manufacturer / Supplier *"
                  name="manufacturer"
                  value={form.manufacturer}
                  onChange={handleFormChange}
                  placeholder="e.g. Espressif"
                />

                <FormField
                  label="Part Number / SKU *"
                  name="part_number"
                  value={form.part_number}
                  onChange={handleFormChange}
                  placeholder="e.g. ESP32-WROOM-32"
                />

                <FormField
                  label="Price *"
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={handleFormChange}
                  placeholder="450.00"
                />

                <FormField
                  label="Available Stock *"
                  name="available_stock"
                  type="number"
                  min="0"
                  step="1"
                  value={form.available_stock}
                  onChange={handleFormChange}
                  placeholder="95"
                />

                <FormField
                  label="Minimum Order Quantity *"
                  name="minimum_order_quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={form.minimum_order_quantity}
                  onChange={handleFormChange}
                  placeholder="1"
                />

                <FormField
                  label="Image URL"
                  name="image_url"
                  value={form.image_url}
                  onChange={handleFormChange}
                  placeholder="https://..."
                />

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleFormChange}
                    placeholder="Product description..."
                    rows="3"
                    style={textareaStyle}
                  />
                </div>
              </div>

              <div style={modalFooterStyle}>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  style={cancelButtonStyle}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={saveButtonStyle}
                >
                  {saving ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save size={15} />
                      {editingProduct ? "Update Product" : "Save Product"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  step,
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        name={name}
        type={type}
        min={min}
        step={step}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

/* =====================================================
   INLINE UI STYLES
   These are only for the new functional controls.
   Existing Products.css remains untouched.
===================================================== */

const menuStyle = {
  position: "absolute",
  top: "calc(100% + 5px)",
  left: 0,
  minWidth: 180,
  background: "#fff",
  border: "1px solid #d7dee8",
  boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
  zIndex: 50,
  padding: "5px 0",
};

const menuItemStyle = {
  display: "block",
  width: "100%",
  padding: "9px 12px",
  border: 0,
  background: "#fff",
  textAlign: "left",
  color: "#23344d",
  fontSize: 13,
  cursor: "pointer",
};

const actionMenuStyle = {
  position: "absolute",
  right: 0,
  top: "calc(100% + 4px)",
  width: 120,
  background: "#fff",
  border: "1px solid #d7dee8",
  boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
  zIndex: 60,
  padding: "5px 0",
};

const actionMenuItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "9px 12px",
  border: 0,
  background: "#fff",
  textAlign: "left",
  color: "#23344d",
  fontSize: 13,
  cursor: "pointer",
};

const emptyCellStyle = {
  padding: "45px 20px",
  textAlign: "center",
  color: "#6b7a90",
  fontSize: 14,
};

const modalOverlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  background: "rgba(15, 23, 42, 0.48)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const modalStyle = {
  width: "min(760px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 8,
  boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
};

const modalHeaderStyle = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: "20px 22px",
  borderBottom: "1px solid #e1e6ed",
};

const modalTitleStyle = {
  margin: 0,
  color: "#132238",
  fontSize: 21,
  fontWeight: 700,
};

const modalSubtitleStyle = {
  margin: "6px 0 0",
  color: "#718096",
  fontSize: 13,
};

const closeButtonStyle = {
  width: 34,
  height: 34,
  border: "1px solid #d9e0e8",
  background: "#fff",
  borderRadius: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#53657d",
};

const modalErrorStyle = {
  margin: "16px 22px 0",
  padding: "11px 13px",
  border: "1px solid #f0b6b6",
  background: "#fff5f5",
  color: "#c62828",
  borderRadius: 4,
  fontSize: 13,
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
  padding: 22,
};

const labelStyle = {
  display: "block",
  marginBottom: 7,
  color: "#26384f",
  fontSize: 12,
  fontWeight: 600,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  height: 40,
  border: "1px solid #d5dde7",
  borderRadius: 4,
  padding: "0 11px",
  outline: "none",
  color: "#26384f",
  fontSize: 13,
  background: "#fff",
};

const textareaStyle = {
  ...inputStyle,
  height: "auto",
  padding: "10px 11px",
  resize: "vertical",
};

const modalFooterStyle = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  padding: "16px 22px",
  borderTop: "1px solid #e1e6ed",
  background: "#fafbfd",
};

const cancelButtonStyle = {
  height: 40,
  padding: "0 18px",
  border: "1px solid #d3dce7",
  borderRadius: 4,
  background: "#fff",
  color: "#30445e",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

const saveButtonStyle = {
  height: 40,
  padding: "0 18px",
  border: "0",
  borderRadius: 4,
  background: "#0867c9",
  color: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 7,
};