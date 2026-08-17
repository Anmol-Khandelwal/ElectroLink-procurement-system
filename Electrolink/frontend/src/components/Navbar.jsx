import { Link, NavLink } from "react-router-dom";

function Navbar() {
  const navLinkClass = ({ isActive }) =>
    `transition ${
      isActive
        ? "font-semibold text-blue-600"
        : "text-slate-600 hover:text-blue-600"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6">

        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">
            E
          </div>

          <div>
            <p className="text-xl font-bold text-slate-900">
              Electro<span className="text-blue-600">Link</span>
            </p>

            <p className="text-xs text-slate-500">
              B2B Components
            </p>
          </div>
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-7">
          <NavLink
            to="/"
            className={navLinkClass}
          >
            Home
          </NavLink>

        <NavLink to="/login" className={navLinkClass}>
            Login
        </NavLink>
        
          <NavLink
            to="/products"
            className={navLinkClass}
          >
            Products
          </NavLink>

          <Link
            to="/products"
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white transition hover:bg-blue-700"
          >
            Browse Catalog
          </Link>
        </div>

      </nav>
    </header>
  );
}

export default Navbar;