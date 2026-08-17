const { Pool } = require("pg");
require("dotenv").config();

// Cloud Postgres providers (Neon, Render, Supabase, etc.) issue a single
// DATABASE_URL and require SSL. Prefer that if it's set; otherwise fall
// back to the discrete DB_* vars for local development.
const useConnectionString = Boolean(process.env.DATABASE_URL);

const pool = useConnectionString
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    });

pool.on("connect", () => {
  console.log("PostgreSQL client connected");
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error);
});

module.exports = pool;
