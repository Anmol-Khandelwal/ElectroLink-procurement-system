const express = require("express");

const router = express.Router();

const pool = require("../config/db");

const {
    authenticateToken,
    requireAdmin
} = require("../middleware/authMiddleware");

/* =========================================================
   AUTHENTICATION

   Every route below is for administrators only.
========================================================= */

router.use(authenticateToken);
router.use(requireAdmin);

const ROLES = ["user", "admin"];

/* =========================================================
   LIST USERS
   GET /api/admin/users
========================================================= */

router.get("/users", async (req, res) => {

    try {

        const { search } = req.query;

        const values = [];

        let where = "";

        if (search && search.trim()) {
            where = `
                WHERE LOWER(u.name) LIKE LOWER($1)
                   OR LOWER(u.email) LIKE LOWER($1)
            `;

            values.push(`%${search.trim()}%`);
        }

        const result = await pool.query(
            `
            SELECT
                u.id,
                u.name,
                u.email,
                u.role,
                u.phone,
                u.created_at,

                s.company_name,

                COALESCE(o.order_count, 0) AS order_count,
                COALESCE(o.order_value, 0) AS order_value

            FROM users u

            LEFT JOIN user_settings s
                ON s.user_id = u.id

            LEFT JOIN (
                SELECT
                    user_id,
                    COUNT(*) AS order_count,
                    SUM(total) FILTER (
                        WHERE status != 'Cancelled'
                    ) AS order_value
                FROM orders
                GROUP BY user_id
            ) o
                ON o.user_id = u.id

            ${where}

            ORDER BY u.created_at DESC, u.id DESC
            `,
            values
        );

        return res.json({
            success: true,

            users: result.rows.map((row) => ({
                id: row.id,
                name: row.name,
                email: row.email,
                role: row.role,
                phone: row.phone || "",
                companyName: row.company_name || "",
                createdAt: row.created_at,
                orderCount: Number(row.order_count),
                orderValue: Number(row.order_value)
            }))
        });

    } catch (error) {

        console.error("List users error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch users"
        });
    }
});

/* =========================================================
   CHANGE A USER ROLE
   PATCH /api/admin/users/:id/role
========================================================= */

router.patch("/users/:id/role", async (req, res) => {

    try {

        const userId = Number(req.params.id);

        const { role } = req.body;

        if (!Number.isInteger(userId) || userId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid user id is required"
            });
        }

        if (!ROLES.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `Role must be one of: ${ROLES.join(", ")}`
            });
        }

        /* An administrator must not be able to lock the whole
           system out by removing their own access. */

        if (userId === req.user.id && role !== "admin") {
            return res.status(400).json({
                success: false,
                message: "You cannot remove your own administrator access"
            });
        }

        if (role !== "admin") {

            const adminCount = await pool.query(
                `
                SELECT COUNT(*) AS total
                FROM users
                WHERE role = 'admin'
                `
            );

            if (Number(adminCount.rows[0].total) <= 1) {
                return res.status(400).json({
                    success: false,
                    message: "The last administrator account cannot be demoted"
                });
            }
        }

        const result = await pool.query(
            `
            UPDATE users
            SET
                role = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, name, email, role
            `,
            [role, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.json({
            success: true,
            message: `${result.rows[0].name} is now ${role === "admin" ? "an administrator" : "a buyer"}`,
            user: result.rows[0]
        });

    } catch (error) {

        console.error("Update user role error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update the user role"
        });
    }
});

module.exports = router;
