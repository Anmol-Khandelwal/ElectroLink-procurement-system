const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

dotenv.config();

const pool = require("./config/db");

const {
  authenticateToken,
  requireAdmin,
  isAdmin,
} = require("./middleware/authMiddleware");

const {
  hashPassword,
  verifyPassword,
  upgradeLegacyPassword,
} = require("./utils/password");

const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

/* =========================================================
   CONFIGURATION
========================================================= */

const PORT = process.env.PORT || 5000;

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing from .env");
}

/* =========================================================
   MIDDLEWARE
========================================================= */

const ALLOWED_ORIGINS = (
  process.env.CLIENT_URL || "http://localhost:5173,http://localhost:5174"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   DATABASE TEST
========================================================= */

async function testDatabase() {
  try {
    const result = await pool.query("SELECT NOW()");

    console.log("=================================");
    console.log("PostgreSQL connected successfully");
    console.log("Database:", process.env.DB_NAME);
    console.log("Database time:", result.rows[0].now);
    console.log("=================================");
  } catch (error) {
    console.error("PostgreSQL connection failed:");
    console.error(error.message);

    throw error;
  }
}

/* =========================================================
   CREATE / UPDATE REQUIRED TABLES
========================================================= */

async function createTables() {
  try {
    /* -----------------------------------------------------
       USERS
    ----------------------------------------------------- */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        phone VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    /* -----------------------------------------------------
       USER SETTINGS
    ----------------------------------------------------- */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY
          REFERENCES users(id)
          ON DELETE CASCADE,

        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(50),

        company_name VARCHAR(255),
        industry VARCHAR(100) DEFAULT 'Electronics',
        company_size VARCHAR(100) DEFAULT '201-500',
        business_address TEXT,
        city VARCHAR(100),
        country VARCHAR(100) DEFAULT 'India',

        email_notifications BOOLEAN DEFAULT TRUE,
        order_notifications BOOLEAN DEFAULT TRUE,
        stock_notifications BOOLEAN DEFAULT TRUE,
        rfq_notifications BOOLEAN DEFAULT FALSE,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    /* -----------------------------------------------------
       PRODUCTS
    ----------------------------------------------------- */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,

        product_name VARCHAR(255) NOT NULL,
        category VARCHAR(150) NOT NULL,
        manufacturer VARCHAR(255) NOT NULL,
        part_number VARCHAR(255) NOT NULL,

        description TEXT,

        price NUMERIC(12,2) DEFAULT 0,
        available_stock INTEGER DEFAULT 0,
        minimum_order_quantity INTEGER DEFAULT 1,

        image_url TEXT,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    /*
      Make sure updated_at exists even if the products
      table was created previously.
    */

    await pool.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS updated_at
      TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    /* -----------------------------------------------------
       REQUESTS
    ----------------------------------------------------- */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,

        request_id VARCHAR(100) UNIQUE NOT NULL,

        request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        supplier VARCHAR(255) NOT NULL,

        items INTEGER DEFAULT 1,

        category VARCHAR(150) NOT NULL,

        status VARCHAR(50) DEFAULT 'Pending',

        amount NUMERIC(12,2) DEFAULT 0,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    /* -----------------------------------------------------
       ORDERS

       One row per checkout. The money columns are frozen at
       the moment the order is placed, so a later price change
       never rewrites the buyer's history.
    ----------------------------------------------------- */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,

        order_number VARCHAR(50) UNIQUE,

        user_id INTEGER NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        status VARCHAR(50) DEFAULT 'Placed',

        subtotal NUMERIC(12,2) DEFAULT 0,
        tax NUMERIC(12,2) DEFAULT 0,
        shipping_fee NUMERIC(12,2) DEFAULT 0,
        total NUMERIC(12,2) DEFAULT 0,

        payment_method VARCHAR(100) DEFAULT 'Cash on Delivery',

        contact_name VARCHAR(255),
        contact_phone VARCHAR(50),
        shipping_address TEXT,
        city VARCHAR(150),
        postal_code VARCHAR(20),
        country VARCHAR(100) DEFAULT 'India',
        notes TEXT,

        placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_user_id
      ON orders(user_id);
    `);

    /* -----------------------------------------------------
       ORDER ITEMS

       The product details are copied into the line so the
       order still reads correctly if the product is later
       renamed or removed from the catalogue.
    ----------------------------------------------------- */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,

        order_id INTEGER NOT NULL
          REFERENCES orders(id)
          ON DELETE CASCADE,

        product_id INTEGER
          REFERENCES products(id)
          ON DELETE SET NULL,

        product_name VARCHAR(255) NOT NULL,
        part_number VARCHAR(255),
        manufacturer VARCHAR(255),
        image_url TEXT,

        unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 1,
        line_total NUMERIC(12,2) NOT NULL DEFAULT 0,

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_order_items_order_id
      ON order_items(order_id);
    `);

    /* -----------------------------------------------------
       CART ITEMS

       The cart lives in the database instead of the browser,
       so it survives a logout and follows the account to any
       other device.
    ----------------------------------------------------- */

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart_items (
        id SERIAL PRIMARY KEY,

        user_id INTEGER NOT NULL
          REFERENCES users(id)
          ON DELETE CASCADE,

        product_id INTEGER NOT NULL
          REFERENCES products(id)
          ON DELETE CASCADE,

        quantity INTEGER NOT NULL DEFAULT 1
          CHECK (quantity > 0),

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        UNIQUE (user_id, product_id)
      );
    `);

    /* -----------------------------------------------------
       MIGRATIONS FOR EXISTING INSTALLATIONS
    ----------------------------------------------------- */

    /* The role decides what the account is allowed to do. */

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user';
    `);

    await pool.query(`
      UPDATE users
      SET role = 'user'
      WHERE role IS NULL OR TRIM(role) = '';
    `);

    /* Requests used to be global. They now belong to the
       buyer who raised them and can point at the order they
       were created from. */

    await pool.query(`
      ALTER TABLE requests
      ADD COLUMN IF NOT EXISTS user_id INTEGER
      REFERENCES users(id) ON DELETE SET NULL;
    `);

    await pool.query(`
      ALTER TABLE requests
      ADD COLUMN IF NOT EXISTS order_id INTEGER
      REFERENCES orders(id) ON DELETE SET NULL;
    `);

    console.log("Database tables ready");
  } catch (error) {
    console.error("Error creating/updating tables:");
    console.error(error.message);

    throw error;
  }
}

/* =========================================================
   SEED THE ADMINISTRATOR ACCOUNT

   The first administrator cannot be created from the sign up
   form, otherwise anybody could grant themselves full access.
   It is created from the environment instead:

     ADMIN_EMAIL     the administrator login
     ADMIN_PASSWORD  its password
     ADMIN_EMAILS    optional list of existing accounts that
                     should be promoted to administrator

   Further administrators are then promoted from the
   Manage Users screen.
========================================================= */

async function seedAdminAccount() {
  try {
    const adminEmail = String(
      process.env.ADMIN_EMAIL || "admin@electrolink.com",
    )
      .trim()
      .toLowerCase();

    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    const existing = await pool.query(
      `
      SELECT id, role
      FROM users
      WHERE LOWER(email) = $1
      `,
      [adminEmail],
    );

    if (existing.rows.length === 0) {
      const hashedPassword = await hashPassword(adminPassword);

      const created = await pool.query(
        `
        INSERT INTO users
        (
          name,
          email,
          password,
          role
        )
        VALUES
        (
          $1,
          $2,
          $3,
          'admin'
        )
        RETURNING id
        `,
        ["ElectroLink Administrator", adminEmail, hashedPassword],
      );

      await pool.query(
        `
        INSERT INTO user_settings (user_id)
        VALUES ($1)
        ON CONFLICT (user_id)
        DO NOTHING
        `,
        [created.rows[0].id],
      );

      console.log(`Administrator account created for ${adminEmail}`);
    } else if (existing.rows[0].role !== "admin") {
      await pool.query(
        `
        UPDATE users
        SET
          role = 'admin',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [existing.rows[0].id],
      );

      console.log(`Existing account ${adminEmail} promoted to administrator`);
    }

    /* Optional extra administrators. */

    const extraAdmins = String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    for (const email of extraAdmins) {
      const result = await pool.query(
        `
        UPDATE users
        SET
          role = 'admin',
          updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(email) = $1
          AND role != 'admin'
        RETURNING email
        `,
        [email],
      );

      if (result.rows.length > 0) {
        console.log(`Existing account ${email} promoted to administrator`);
      }
    }
  } catch (error) {
    console.error("Could not prepare the administrator account:");
    console.error(error.message);
  }
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "ElectroLink Backend is running",
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "ElectroLink API is working",
  });
});

app.get("/api/debug/db", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS user
    `);

    res.json({
      success: true,
      database: result.rows[0].database,
      user: result.rows[0].user,
    });
  } catch (error) {
    console.error("Debug DB error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/* =========================================================
   REGISTER
========================================================= */

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password, company } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await pool.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER($1)
      `,
      [normalizedEmail],
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email is already registered",
      });
    }

    /*
      Everyone who signs up from the form is a buyer.
      The role is never taken from the request body, so an
      account cannot promote itself to administrator.
    */

    const hashedPassword = await hashPassword(password);

    const result = await pool.query(
      `
      INSERT INTO users
      (
        name,
        email,
        password,
        role
      )
      VALUES
      (
        $1,
        $2,
        $3,
        'user'
      )
      RETURNING id, name, email, role
      `,
      [name.trim(), normalizedEmail, hashedPassword],
    );

    const user = result.rows[0];

    await pool.query(
      `
      INSERT INTO user_settings
      (
        user_id,
        company_name
      )
      VALUES
      (
        $1,
        $2
      )
      ON CONFLICT (user_id)
      DO NOTHING
      `,
      [user.id, company || ""],
    );

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user,
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
});

/* =========================================================
   LOGIN
========================================================= */

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `
      SELECT id, name, email, password, role, phone
      FROM users
      WHERE LOWER(TRIM(email)) = $1
      LIMIT 1
      `,
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    /*
      Passwords are stored as bcrypt hashes. Accounts created
      before that change still hold plain text, so the check
      falls back to a direct comparison and the stored value
      is upgraded to a hash right after a successful login.
    */

    const passwordMatches = await verifyPassword(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    await upgradeLegacyPassword(user.id, password, user.password);

    await pool.query(
      `
      INSERT INTO user_settings (user_id)
      VALUES ($1)
      ON CONFLICT (user_id)
      DO NOTHING
      `,
      [user.id],
    );

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",

      token,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* =========================================================
   GET CURRENT USER
========================================================= */

app.get("/api/me", authenticateToken, async (req, res) => {
  return res.json({
    success: true,
    user: req.user,
  });
});

/* =========================================================
   DASHBOARD
========================================================= */

app.get("/api/dashboard", authenticateToken, async (req, res) => {
  try {
    /*
      An administrator sees the numbers of the whole platform.
      A buyer only sees the activity of their own account.
    */

    const admin = isAdmin(req);

    const scopeValues = admin ? [] : [req.user.id];

    const requestScope = admin ? "" : "WHERE user_id = $1";

    const orderScope = admin ? "" : "WHERE user_id = $1";

    const productsResult = await pool.query(`
      SELECT COUNT(*) AS total
      FROM products
    `);

    const requestsResult = await pool.query(
      `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'Pending')  AS pending,
        COUNT(*) FILTER (WHERE status = 'Approved') AS approved
      FROM requests
      ${requestScope}
      `,
      scopeValues,
    );

    const ordersResult = await pool.query(
      `
      SELECT
        COUNT(*) AS total,

        COUNT(*) FILTER (
          WHERE status IN ('Placed', 'Processing', 'Shipped')
        ) AS active,

        COUNT(*) FILTER (WHERE status = 'Delivered') AS delivered,

        COALESCE(
          SUM(total) FILTER (WHERE status != 'Cancelled'),
          0
        ) AS total_value

      FROM orders
      ${orderScope}
      `,
      scopeValues,
    );

    const stockResult = await pool.query(`
      SELECT COUNT(*) AS total
      FROM products
      WHERE available_stock <= minimum_order_quantity
    `);

    const customersResult = admin
      ? await pool.query(`
          SELECT COUNT(*) AS total
          FROM users
          WHERE role = 'user'
        `)
      : { rows: [{ total: 0 }] };

    return res.json({
      success: true,

      role: req.user.role,

      stats: {
        totalProducts: Number(productsResult.rows[0].total),

        totalRequests: Number(requestsResult.rows[0].total),

        pendingRequests: Number(requestsResult.rows[0].pending),

        approvedRequests: Number(requestsResult.rows[0].approved),

        totalOrders: Number(ordersResult.rows[0].total),

        activeOrders: Number(ordersResult.rows[0].active),

        deliveredOrders: Number(ordersResult.rows[0].delivered),

        orderValue: Number(ordersResult.rows[0].total_value),

        lowStock: Number(stockResult.rows[0].total),

        totalCustomers: Number(customersResult.rows[0].total),
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard",
    });
  }
});

/* =========================================================
   SETTINGS - PROFILE GET
========================================================= */

app.get("/api/settings/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      `
      INSERT INTO user_settings (user_id)
      VALUES ($1)
      ON CONFLICT (user_id)
      DO NOTHING
      `,
      [userId],
    );

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.phone AS user_phone,

        s.first_name,
        s.last_name,
        s.phone AS settings_phone

      FROM users u

      LEFT JOIN user_settings s
        ON u.id = s.user_id

      WHERE u.id = $1
      `,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    const profile = result.rows[0];

    let firstName = profile.first_name || "";

    let lastName = profile.last_name || "";

    if (!firstName && !lastName && profile.name) {
      const parts = profile.name.trim().split(/\s+/);

      firstName = parts[0] || "";

      lastName = parts.slice(1).join(" ") || "";
    }

    return res.json({
      success: true,

      profile: {
        id: profile.id,

        firstName,

        lastName,

        name: profile.name || "",

        email: profile.email || "",

        phone: profile.settings_phone || profile.user_phone || "",

        role: profile.role || "user",
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
    });
  }
});

/* =========================================================
   SETTINGS - PROFILE UPDATE
========================================================= */

app.put("/api/settings/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      firstName,
      lastName,
      email,
      phone,
    } = req.body;

    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        message: "First name, last name and email are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const duplicate = await pool.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = LOWER($1)
      AND id != $2
      `,
      [normalizedEmail, userId],
    );

    if (duplicate.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Email is already being used by another user",
      });
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    /* Update users */

    await pool.query(
      `
      UPDATE users
      SET
        name = $1,
        email = $2,
        phone = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      `,
      [
        fullName,
        normalizedEmail,
        phone || "",
        userId,
      ],
    );

    /* Update settings */

    await pool.query(
      `
      INSERT INTO user_settings
      (
        user_id,
        first_name,
        last_name,
        phone
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        phone = EXCLUDED.phone,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        userId,
        firstName.trim(),
        lastName.trim(),
        phone || "",
      ],
    );

    return res.json({
      success: true,

      message: "Profile updated successfully",

      profile: {
        firstName: firstName.trim(),

        lastName: lastName.trim(),

        email: normalizedEmail,

        phone: phone || "",

        role: req.user.role || "user",
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
});

/* =========================================================
   SETTINGS - COMPANY GET
========================================================= */

app.get("/api/settings/company", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      `
      INSERT INTO user_settings (user_id)
      VALUES ($1)
      ON CONFLICT (user_id)
      DO NOTHING
      `,
      [userId],
    );

    const result = await pool.query(
      `
      SELECT
        company_name,
        industry,
        company_size,
        business_address,
        city,
        country

      FROM user_settings

      WHERE user_id = $1
      `,
      [userId],
    );

    const company = result.rows[0];

    return res.json({
      success: true,

      company: {
        companyName: company?.company_name || "",

        industry: company?.industry || "Electronics",

        companySize: company?.company_size || "201-500",

        businessAddress: company?.business_address || "",

        city: company?.city || "",

        country: company?.country || "India",
      },
    });
  } catch (error) {
    console.error("Get company error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch company information",
    });
  }
});

/* =========================================================
   SETTINGS - COMPANY UPDATE
========================================================= */

app.put("/api/settings/company", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      companyName,
      industry,
      companySize,
      businessAddress,
      city,
      country,
    } = req.body;

    await pool.query(
      `
      INSERT INTO user_settings
      (
        user_id,
        company_name,
        industry,
        company_size,
        business_address,
        city,
        country
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        company_name = EXCLUDED.company_name,
        industry = EXCLUDED.industry,
        company_size = EXCLUDED.company_size,
        business_address = EXCLUDED.business_address,
        city = EXCLUDED.city,
        country = EXCLUDED.country,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        userId,
        companyName || "",
        industry || "Electronics",
        companySize || "201-500",
        businessAddress || "",
        city || "",
        country || "India",
      ],
    );

    return res.json({
      success: true,

      message: "Company information updated successfully",

      company: {
        companyName: companyName || "",

        industry: industry || "Electronics",

        companySize: companySize || "201-500",

        businessAddress: businessAddress || "",

        city: city || "",

        country: country || "India",
      },
    });
  } catch (error) {
    console.error("Update company error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update company information",
    });
  }
});

/* =========================================================
   SETTINGS - NOTIFICATIONS GET
========================================================= */

app.get(
  "/api/settings/notifications",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;

      await pool.query(
        `
        INSERT INTO user_settings (user_id)
        VALUES ($1)
        ON CONFLICT (user_id)
        DO NOTHING
        `,
        [userId],
      );

      const result = await pool.query(
        `
        SELECT
          email_notifications,
          order_notifications,
          stock_notifications,
          rfq_notifications

        FROM user_settings

        WHERE user_id = $1
        `,
        [userId],
      );

      const row = result.rows[0];

      return res.json({
        success: true,

        notifications: {
          email: row?.email_notifications ?? true,

          order: row?.order_notifications ?? true,

          stock: row?.stock_notifications ?? true,

          rfq: row?.rfq_notifications ?? false,
        },
      });
    } catch (error) {
      console.error("Get notification error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch notification settings",
      });
    }
  },
);

/* =========================================================
   SETTINGS - NOTIFICATIONS UPDATE
========================================================= */

app.put(
  "/api/settings/notifications",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const {
        email,
        order,
        stock,
        rfq,
      } = req.body;

      await pool.query(
        `
        INSERT INTO user_settings
        (
          user_id,
          email_notifications,
          order_notifications,
          stock_notifications,
          rfq_notifications
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5
        )
        ON CONFLICT (user_id)
        DO UPDATE SET

          email_notifications =
            EXCLUDED.email_notifications,

          order_notifications =
            EXCLUDED.order_notifications,

          stock_notifications =
            EXCLUDED.stock_notifications,

          rfq_notifications =
            EXCLUDED.rfq_notifications,

          updated_at =
            CURRENT_TIMESTAMP
        `,
        [
          userId,
          email ?? true,
          order ?? true,
          stock ?? true,
          rfq ?? false,
        ],
      );

      return res.json({
        success: true,

        message: "Notification preferences updated successfully",

        notifications: {
          email: email ?? true,

          order: order ?? true,

          stock: stock ?? true,

          rfq: rfq ?? false,
        },
      });
    } catch (error) {
      console.error("Update notification error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to update notification settings",
      });
    }
  },
);

/* =========================================================
   SETTINGS - CHANGE PASSWORD
========================================================= */

app.put(
  "/api/settings/password",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;

      const {
        currentPassword,
        newPassword,
        confirmPassword,
      } = req.body;

      if (
        !currentPassword ||
        !newPassword ||
        !confirmPassword
      ) {
        return res.status(400).json({
          success: false,
          message: "All password fields are required",
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "New passwords do not match",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must contain at least 6 characters",
        });
      }

      const result = await pool.query(
        `
        SELECT password
        FROM users
        WHERE id = $1
        `,
        [userId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const currentPasswordStored =
        result.rows[0].password;

      const passwordMatches = await verifyPassword(
        currentPassword,
        currentPasswordStored,
      );

      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      const hashedPassword = await hashPassword(newPassword);

      await pool.query(
        `
        UPDATE users
        SET
          password = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [
          hashedPassword,
          userId,
        ],
      );

      return res.json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (error) {
      console.error("Change password error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to update password",
      });
    }
  },
);

/* =========================================================
   PRODUCTS - GET ALL
========================================================= */

app.get("/api/products", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        product_name,
        category,
        manufacturer,
        part_number,
        description,
        price,
        available_stock,
        minimum_order_quantity,
        image_url,
        created_at,
        updated_at
      FROM products
      ORDER BY created_at DESC
    `);

    return res.json({
      success: true,
      products: result.rows,
    });
  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
});

/* =========================================================
   PRODUCTS - GET ONE
========================================================= */

app.get("/api/products/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM products
      WHERE id = $1
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Get product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
});

/* =========================================================
   PRODUCTS - CREATE
========================================================= */

app.post("/api/products", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      product_name,
      category,
      manufacturer,
      part_number,
      description,
      price,
      available_stock,
      minimum_order_quantity,
      image_url,
    } = req.body;

    if (
      !product_name ||
      !category ||
      !manufacturer ||
      !part_number
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Product name, category, manufacturer and part number are required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO products
      (
        product_name,
        category,
        manufacturer,
        part_number,
        description,
        price,
        available_stock,
        minimum_order_quantity,
        image_url
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9
      )
      RETURNING *
      `,
      [
        product_name.trim(),
        category.trim(),
        manufacturer.trim(),
        part_number.trim(),
        description || "",
        price || 0,
        available_stock || 0,
        minimum_order_quantity || 1,
        image_url || "",
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Create product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
});

/* =========================================================
   PRODUCTS - UPDATE
========================================================= */

app.put("/api/products/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      product_name,
      category,
      manufacturer,
      part_number,
      description,
      price,
      available_stock,
      minimum_order_quantity,
      image_url,
    } = req.body;

    if (
      !product_name ||
      !category ||
      !manufacturer ||
      !part_number
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Product name, category, manufacturer and part number are required",
      });
    }

    const result = await pool.query(
      `
      UPDATE products
      SET
        product_name = $1,
        category = $2,
        manufacturer = $3,
        part_number = $4,
        description = $5,
        price = $6,
        available_stock = $7,
        minimum_order_quantity = $8,
        image_url = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
      `,
      [
        product_name.trim(),
        category.trim(),
        manufacturer.trim(),
        part_number.trim(),
        description || "",
        price || 0,
        available_stock || 0,
        minimum_order_quantity || 1,
        image_url || "",
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      message: "Product updated successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error("Update product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update product",
    });
  }
});

/* =========================================================
   PRODUCTS - DELETE
========================================================= */

app.delete("/api/products/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM products
      WHERE id = $1
      RETURNING id
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
    });
  }
});

/* =========================================================
   REQUESTS - GET ALL
========================================================= */

app.get("/api/requests", authenticateToken, async (req, res) => {
  try {
    const {
      search,
      status,
      category,
    } = req.query;

    let query = `
      SELECT
        id,
        request_id,
        request_date,
        supplier,
        items,
        category,
        status,
        amount,
        user_id,
        order_id,
        created_at,
        updated_at
      FROM requests
      WHERE 1 = 1
    `;

    const values = [];

    let index = 1;

    /* -----------------------------
       ROLE SCOPE

       A buyer only sees the requests raised from their own
       account. An administrator sees every request.
    ----------------------------- */

    if (!isAdmin(req)) {
      query += `
        AND user_id = $${index}
      `;

      values.push(req.user.id);

      index++;
    }

    /* -----------------------------
       SEARCH
    ----------------------------- */

    if (search && search.trim()) {
      query += `
        AND (
          LOWER(request_id) LIKE LOWER($${index})
          OR LOWER(supplier) LIKE LOWER($${index})
          OR LOWER(category) LIKE LOWER($${index})
        )
      `;

      values.push(`%${search.trim()}%`);

      index++;
    }

    /* -----------------------------
       STATUS FILTER
    ----------------------------- */

    if (status) {
      query += `
        AND status = $${index}
      `;

      values.push(status);

      index++;
    }

    /* -----------------------------
       CATEGORY FILTER
    ----------------------------- */

    if (category) {
      query += `
        AND category = $${index}
      `;

      values.push(category);

      index++;
    }

    query += `
      ORDER BY request_date DESC
    `;

    const result = await pool.query(
      query,
      values,
    );

    return res.json({
      success: true,
      requests: result.rows,
    });
  } catch (error) {
    console.error("Get requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch requests",
    });
  }
});

/* =========================================================
   REQUEST STATISTICS
   IMPORTANT:
   This route MUST come before /api/requests/:id
========================================================= */

app.get(
  "/api/requests/stats",
  authenticateToken,
  async (req, res) => {
    try {
      const scope = isAdmin(req) ? "" : "WHERE user_id = $1";

      const values = isAdmin(req) ? [] : [req.user.id];

      const result = await pool.query(
        `
        SELECT
          COUNT(*) AS total,

          COUNT(*) FILTER (
            WHERE status = 'Pending'
          ) AS pending,

          COUNT(*) FILTER (
            WHERE status = 'Quoted'
          ) AS quoted,

          COUNT(*) FILTER (
            WHERE status = 'Rejected'
          ) AS rejected,

          COUNT(*) FILTER (
            WHERE status = 'Approved'
          ) AS approved

        FROM requests
        ${scope}
        `,
        values,
      );

      return res.json({
        success: true,
        stats: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Request statistics error:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch request statistics",
      });
    }
  },
);

/* =========================================================
   REQUEST CATEGORIES
   IMPORTANT:
   This route MUST come before /api/requests/:id
========================================================= */

app.get(
  "/api/requests/categories",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT DISTINCT category
        FROM requests
        WHERE category IS NOT NULL
          AND category != ''
        ORDER BY category ASC
      `);

      return res.json({
        success: true,

        categories: result.rows.map(
          (row) => row.category,
        ),
      });
    } catch (error) {
      console.error(
        "Request categories error:",
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch request categories",
      });
    }
  },
);

/* =========================================================
   REQUEST - GET ONE
========================================================= */

app.get(
  "/api/requests/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `
        SELECT *
        FROM requests
        WHERE id = $1
        `,
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Request not found",
        });
      }

      const request = result.rows[0];

      if (!isAdmin(req) && request.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "You can only view your own requests",
        });
      }

      return res.json({
        success: true,
        request,
      });
    } catch (error) {
      console.error(
        "Get request error:",
        error,
      );

      return res.status(500).json({
        success: false,
        message: "Failed to fetch request",
      });
    }
  },
);

/* =========================================================
   REQUEST - CREATE
========================================================= */

app.post(
  "/api/requests",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        request_id,
        request_date,
        supplier,
        items,
        category,
        status,
        amount,
      } = req.body;

      if (
        !request_id ||
        !supplier ||
        items === undefined ||
        !category
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Request ID, supplier, items and category are required",
        });
      }

      /* -----------------------------
         CHECK DUPLICATE REQUEST ID
      ----------------------------- */

      const existing = await pool.query(
        `
        SELECT id
        FROM requests
        WHERE request_id = $1
        `,
        [request_id],
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Request ID already exists",
        });
      }

      /* -----------------------------
         CREATE REQUEST
      ----------------------------- */

      /*
        Only an administrator may set the status of a new
        request. A buyer always starts at "Pending".
      */

      const initialStatus = isAdmin(req) ? status || "Pending" : "Pending";

      const result = await pool.query(
        `
        INSERT INTO requests
        (
          request_id,
          request_date,
          supplier,
          items,
          category,
          status,
          amount,
          user_id
        )
        VALUES
        (
          $1,
          COALESCE($2, CURRENT_TIMESTAMP),
          $3,
          $4,
          $5,
          $6,
          $7,
          $8
        )
        RETURNING *
        `,
        [
          request_id,
          request_date || null,
          supplier,
          Number(items),
          category,
          initialStatus,
          amount || 0,
          req.user.id,
        ],
      );

      return res.status(201).json({
        success: true,
        message: "Request created successfully",
        request: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Create request error:",
        error,
      );

      return res.status(500).json({
        success: false,
        message: "Failed to create request",
      });
    }
  },
);

/* =========================================================
   REQUEST - UPDATE
========================================================= */

app.put("/api/requests/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      request_id,
      request_date,
      supplier,
      items,
      category,
      status,
      amount,
    } = req.body;

    const result = await pool.query(
      `
      UPDATE requests
      SET
        request_id = $1,
        request_date = $2,
        supplier = $3,
        items = $4,
        category = $5,
        status = $6,
        amount = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
      `,
      [
        request_id,
        request_date,
        supplier,
        Number(items),
        category,
        status,
        amount || 0,
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Request not found",
      });
    }

    return res.json({
      success: true,
      message: "Request updated successfully",
      request: result.rows[0],
    });
  } catch (error) {
    console.error("Update request error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update request",
    });
  }
});

/* =========================================================
   REQUEST - UPDATE STATUS
========================================================= */

app.patch(
  "/api/requests/:id/status",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      const { status } = req.body;

      const allowedStatuses = [
        "Pending",
        "Quoted",
        "Rejected",
        "Approved",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status",
        });
      }

      const result = await pool.query(
        `
        UPDATE requests
        SET
          status = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
        `,
        [status, id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Request not found",
        });
      }

      return res.json({
        success: true,
        message: "Request status updated successfully",
        request: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Update request status error:",
        error,
      );

      return res.status(500).json({
        success: false,
        message: "Failed to update request status",
      });
    }
  },
);

/* =========================================================
   REQUEST - DELETE
========================================================= */

app.delete(
  "/api/requests/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      /*
        An administrator can remove any request. A buyer can
        only withdraw one of their own requests, and only
        while it is still pending.
      */

      const existing = await pool.query(
        `
        SELECT id, user_id, status
        FROM requests
        WHERE id = $1
        `,
        [id],
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Request not found",
        });
      }

      if (!isAdmin(req)) {
        if (existing.rows[0].user_id !== req.user.id) {
          return res.status(403).json({
            success: false,
            message: "You can only withdraw your own requests",
          });
        }

        if (existing.rows[0].status !== "Pending") {
          return res.status(400).json({
            success: false,
            message:
              "A request that is already being processed cannot be withdrawn",
          });
        }
      }

      const result = await pool.query(
        `
        DELETE FROM requests
        WHERE id = $1
        RETURNING id, request_id
        `,
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Request not found",
        });
      }

      return res.json({
        success: true,
        message: "Request deleted successfully",
        request: result.rows[0],
      });
    } catch (error) {
      console.error("Delete request error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to delete request",
      });
    }
  },
);

/* =========================================================
   CART / ORDERS / ADMINISTRATION

   These groups live in their own router files because they
   carry their own transactions and role checks.
========================================================= */

app.use("/api/cart", cartRoutes);

app.use("/api/orders", orderRoutes);

app.use("/api/admin", adminRoutes);

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
    path: req.originalUrl,
    method: req.method,
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

/* =========================================================
   START SERVER
========================================================= */

async function startServer() {
  try {
    await testDatabase();

    await createTables();

    await seedAdminAccount();

    app.listen(PORT, () => {
      console.log("");
      console.log("=================================");

      console.log(
        `ElectroLink Server running on http://localhost:${PORT}`,
      );

      console.log("=================================");

      console.log("");
    });
  } catch (error) {
    console.error("Failed to start server:");

    console.error(error);
  }
}

startServer();
