const jwt = require("jsonwebtoken");

const pool = require("../config/db");

/* =========================================================
   AUTHENTICATE TOKEN

   Reads the Bearer token, verifies it and loads the fresh
   user row from the database.

   The role is always taken from the database (never from
   the token) so that a role change applies immediately,
   even for tokens that were issued earlier.
========================================================= */

async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "Authorization token is required"
            });
        }

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Invalid authorization format"
            });
        }

        const token = authHeader.substring(7);

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Token is missing"
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const result = await pool.query(
            `
            SELECT id, name, email, role, phone
            FROM users
            WHERE id = $1
            `,
            [decoded.id]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }

        req.user = result.rows[0];

        next();

    } catch (error) {

        console.error("Authentication error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
}

/* =========================================================
   REQUIRE ADMIN

   Must be used after authenticateToken.
   Blocks every account whose role is not "admin".
========================================================= */

function requireAdmin(req, res, next) {

    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Authentication is required"
        });
    }

    if (req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Administrator access is required for this action"
        });
    }

    next();
}

/* =========================================================
   IS ADMIN HELPER
========================================================= */

function isAdmin(req) {
    return Boolean(req.user) && req.user.role === "admin";
}

module.exports = {
    authenticateToken,
    requireAdmin,
    isAdmin
};
