import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";

import { useAuth } from "./context/useAuth";

import {
  ProtectedRoute,
  AdminRoute,
  PublicOnlyRoute,
} from "./components/RouteGuards";

import { homePathFor } from "./utils/navigation";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";

import Catalog from "./pages/Catalog";
import ProductDetails from "./pages/ProductDetails";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import OrderDetails from "./pages/OrderDetails";
import Settings from "./pages/Settings";

import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Requests from "./pages/Requests";
import Users from "./pages/Users";

/* =========================================================
   ENTRY REDIRECT

   "/" sends a visitor to the login page, an administrator to
   the control panel and a buyer to the catalogue.
========================================================= */

function EntryRedirect() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <Navigate to={isAuthenticated ? homePathFor(user) : "/login"} replace />
  );
}

/* =========================================================
   OLD PRODUCT LINK

   The catalogue used to live at /products/:id, which is now
   the administrator area. Old links keep working.
========================================================= */

function LegacyProductRedirect() {
  const { id } = useParams();

  return <Navigate to={`/catalog/${id}`} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            {/* =================================================
                PUBLIC
            ================================================= */}

            <Route path="/" element={<EntryRedirect />} />

            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              }
            />

            <Route
              path="/register"
              element={
                <PublicOnlyRoute>
                  <Register />
                </PublicOnlyRoute>
              }
            />

            <Route path="/reset-password" element={<ResetPassword />} />

            {/* =================================================
                BUYER AND ADMINISTRATOR
            ================================================= */}

            <Route
              path="/catalog"
              element={
                <ProtectedRoute>
                  <Catalog />
                </ProtectedRoute>
              }
            />

            <Route
              path="/catalog/:id"
              element={
                <ProtectedRoute>
                  <ProductDetails />
                </ProtectedRoute>
              }
            />

            <Route
              path="/cart"
              element={
                <ProtectedRoute>
                  <Cart />
                </ProtectedRoute>
              }
            />

            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              }
            />

            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              }
            />

            <Route
              path="/orders/:id"
              element={
                <ProtectedRoute>
                  <OrderDetails />
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            <Route
              path="/requests"
              element={
                <ProtectedRoute>
                  <Requests />
                </ProtectedRoute>
              }
            />

            {/* =================================================
                ADMINISTRATOR ONLY
            ================================================= */}

            <Route
              path="/dashboard"
              element={
                <AdminRoute>
                  <Dashboard />
                </AdminRoute>
              }
            />

            <Route
              path="/products"
              element={
                <AdminRoute>
                  <Products />
                </AdminRoute>
              }
            />

            <Route
              path="/users"
              element={
                <AdminRoute>
                  <Users />
                </AdminRoute>
              }
            />

            {/* =================================================
                OLD LINKS
            ================================================= */}

            <Route
              path="/products/:id"
              element={
                <ProtectedRoute>
                  <LegacyProductRedirect />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<EntryRedirect />} />
          </Routes>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
