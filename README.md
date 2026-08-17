# ElectroLink Procurement System

A B2B electronics procurement platform built on the **PERN** stack
(PostgreSQL · Express · React · Node.js).

Buyers browse a component catalog, build a cart and place orders.
Administrators manage the catalog, every order and every user account.

---

## Project structure

```
Electrolink/
├── backend/                 Express + PostgreSQL API
│   ├── config/db.js         Shared connection pool
│   ├── middleware/          authenticateToken, requireAdmin
│   ├── routes/              cart, orders, admin
│   ├── utils/               password hashing, cart pricing
│   └── server.js            App, schema, auth, products, requests
│
└── frontend/                React 19 + Vite
    └── src/
        ├── components/      Header (navbar), Footer, route guards
        ├── context/         AuthContext, CartContext + their hooks
        ├── pages/           Catalog, Cart, Checkout, Orders, ...
        ├── services/api.js  Axios client, currency and date helpers
        └── utils/
```

---

## Getting started

### 1. Database

Create an empty PostgreSQL database. Every table is created automatically
the first time the server starts, and existing installations are migrated
in place — no manual SQL is needed.

```sql
CREATE DATABASE electrolink;
```

### 2. Backend

```bash
cd Electrolink/backend
npm install
cp .env.example .env        # then fill in your own values
npm run dev                 # http://localhost:5000
```

`.env` values:

| Variable | Meaning |
| --- | --- |
| `PORT` | API port, default `5000` |
| `DB_USER` `DB_HOST` `DB_NAME` `DB_PASSWORD` `DB_PORT` | PostgreSQL connection |
| `JWT_SECRET` | Any long random string. Changing it signs everybody out |
| `CLIENT_URL` | Comma separated origins allowed to call the API |
| `ADMIN_EMAIL` `ADMIN_PASSWORD` | The administrator account created on startup |
| `ADMIN_EMAILS` | Optional: existing accounts to promote to administrator |

### 3. Frontend

```bash
cd Electrolink/frontend
npm install
npm run dev                 # http://localhost:5173
```

---

## Roles

The role lives on the `users` row and is read from the database on every
request, so a role change takes effect immediately.

### Buyer (`user`)

Everyone who signs up through the registration form is a buyer.

* Browse the catalog and open a product page
* Add to cart, change quantities, remove items
* Check out and place an order
* See **their own** orders and requests, and cancel an order that has not
  shipped yet
* Manage their profile, company details, notifications and password

### Administrator (`admin`)

Everything a buyer can do, plus:

* Add, edit and delete products (Inventory)
* See **every** order, move it through Placed → Processing → Shipped →
  Delivered, and cancel any order
* See and manage every procurement request
* The analytics dashboard
* Manage Users: promote a buyer to administrator or back

### The first administrator

An administrator cannot be created from the sign up form — otherwise
anybody could grant themselves full access. Instead the server creates one
on startup from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (defaults
`admin@electrolink.com` / `admin123`). If that email already belongs to an
account, that account is promoted instead.

**Change the default password before deploying anywhere.**

Further administrators are promoted from the Manage Users screen.

---

## Navigation

Every entry in the navbar goes to a real page, and the entries change with
the role:

| Item | Buyer | Administrator |
| --- | --- | --- |
| Catalog | `/catalog` | `/catalog` |
| Orders | `/orders` (own orders) | `/orders` (all orders, filterable) |
| Requests | `/requests` (own) | `/requests` (all) |
| Inventory | — | `/products` |
| Analytics | — | `/dashboard` |
| Cart icon | `/cart`, with a live item badge | same |
| Avatar menu | Profile · Orders · Settings · Logout | plus Manage Users |

The search box in the navbar always searches the catalog.

---

## Cart and orders

The cart is stored in PostgreSQL against the account rather than in the
browser, the way Amazon and Flipkart work: it survives a refresh, a logout
and a different device. Anything collected before signing in is merged into
the account cart at login.

* Quantities respect the minimum order quantity and the available stock
* Checkout runs in a single transaction: the stock is locked and reduced,
  the order and its lines are written, and the cart is emptied. If any step
  fails, nothing is committed
* Order lines copy the product name, part number and price, so an order
  still reads correctly after the product is renamed, repriced or deleted
* Cancelling an order returns its units to the catalog
* Every order also creates the matching procurement request, so the
  administrator RFQ screens stay in step

Pricing rules live in `backend/utils/cart.js`: 18% GST, ₹250 shipping,
free above ₹5,000.

---

## API

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/api/register`, `/api/login` | public |
| `GET` | `/api/me` | any signed in account |
| `GET` | `/api/products`, `/api/products/:id` | any signed in account |
| `POST` `PUT` `DELETE` | `/api/products…` | administrator |
| `GET` `POST` `PUT` `DELETE` | `/api/cart…` | own cart |
| `POST` | `/api/orders` | own cart → own order |
| `GET` | `/api/orders`, `/api/orders/:id` | own orders; administrator sees all |
| `PATCH` | `/api/orders/:id/status` | administrator |
| `POST` | `/api/orders/:id/cancel` | owner (until shipped) or administrator |
| `GET` | `/api/requests` | own requests; administrator sees all |
| `PATCH` | `/api/requests/:id/status` | administrator |
| `GET` `PATCH` | `/api/admin/users…` | administrator |
| `GET` `PUT` | `/api/settings/…` | own settings |
| `GET` | `/api/dashboard` | scoped to the role |

---

## Passwords

Passwords are stored as bcrypt hashes. Accounts created before this change
still hold plain text, so the login check falls back to a direct comparison
and silently replaces the stored value with a hash on the first successful
login. No account needs to be recreated.
