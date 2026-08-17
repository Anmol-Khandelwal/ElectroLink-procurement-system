const express = require("express");

const router = express.Router();

const pool = require("../config/db");

const {
    authenticateToken,
    requireAdmin,
    isAdmin
} = require("../middleware/authMiddleware");

const {
    loadCart,
    buildTotals,
    round
} = require("../utils/cart");

/* =========================================================
   AUTHENTICATION
========================================================= */

router.use(authenticateToken);

/* =========================================================
   ORDER STATUS FLOW
========================================================= */

const ORDER_STATUSES = [
    "Placed",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled"
];

/* A cancelled order returns its units to the catalogue, so
   the stock has to be released only once. */

const STOCK_RELEASING_STATUSES = ["Cancelled"];

/* An order can still be cancelled by the buyer while it has
   not been shipped yet. */

const BUYER_CANCELLABLE_STATUSES = ["Placed", "Processing"];

/* =========================================================
   FORMAT ORDER
========================================================= */

function formatOrder(row, items = []) {

    return {
        id: row.id,
        orderNumber: row.order_number,

        userId: row.user_id,
        customerName: row.customer_name || null,
        customerEmail: row.customer_email || null,

        status: row.status,

        subtotal: Number(row.subtotal || 0),
        tax: Number(row.tax || 0),
        shippingFee: Number(row.shipping_fee || 0),
        total: Number(row.total || 0),

        paymentMethod: row.payment_method,

        contactName: row.contact_name,
        contactPhone: row.contact_phone,
        shippingAddress: row.shipping_address,
        city: row.city,
        postalCode: row.postal_code,
        country: row.country,
        notes: row.notes,

        placedAt: row.placed_at,
        updatedAt: row.updated_at,

        itemCount: Number(row.item_count ?? items.length),
        totalQuantity: Number(row.total_quantity ?? 0),

        items: items.map((item) => ({
            id: item.id,
            productId: item.product_id,
            productName: item.product_name,
            partNumber: item.part_number,
            manufacturer: item.manufacturer,
            imageUrl: item.image_url,
            unitPrice: Number(item.unit_price || 0),
            quantity: Number(item.quantity || 0),
            lineTotal: Number(item.line_total || 0)
        }))
    };
}

/* =========================================================
   RELEASE STOCK

   Puts the ordered units back into the catalogue when an
   order is cancelled.
========================================================= */

async function releaseStock(client, orderId) {

    await client.query(
        `
        UPDATE products p
        SET
            available_stock = p.available_stock + oi.quantity,
            updated_at = CURRENT_TIMESTAMP
        FROM order_items oi
        WHERE oi.order_id = $1
          AND oi.product_id = p.id
        `,
        [orderId]
    );
}

/* =========================================================
   CHECKOUT PREVIEW
   GET /api/orders/checkout-preview

   Gives the checkout page the same totals the order will be
   created with, without touching the cart.
========================================================= */

router.get("/checkout-preview", async (req, res) => {

    try {

        const cart = await loadCart(req.user.id);

        const unavailableItems = cart.items.filter(
            (item) => !item.inStock || item.exceedsStock
        );

        return res.json({
            success: true,
            cart,
            canCheckout:
                cart.items.length > 0 && unavailableItems.length === 0,
            unavailableItems
        });

    } catch (error) {

        console.error("Checkout preview error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to prepare the checkout"
        });
    }
});

/* =========================================================
   ORDER STATISTICS
   GET /api/orders/stats

   Must stay above /:id so that "stats" is not read as an id.
========================================================= */

router.get("/stats", async (req, res) => {

    try {

        const scopeToUser = !isAdmin(req) || req.query.scope === "mine";

        const values = [];

        let filter = "";

        if (scopeToUser) {
            filter = "WHERE user_id = $1";
            values.push(req.user.id);
        }

        const result = await pool.query(
            `
            SELECT
                COUNT(*)                                        AS total,
                COUNT(*) FILTER (WHERE status = 'Placed')       AS placed,
                COUNT(*) FILTER (WHERE status = 'Processing')   AS processing,
                COUNT(*) FILTER (WHERE status = 'Shipped')      AS shipped,
                COUNT(*) FILTER (WHERE status = 'Delivered')    AS delivered,
                COUNT(*) FILTER (WHERE status = 'Cancelled')    AS cancelled,

                COALESCE(
                    SUM(total) FILTER (WHERE status != 'Cancelled'),
                    0
                )                                               AS total_value

            FROM orders
            ${filter}
            `,
            values
        );

        const row = result.rows[0];

        return res.json({
            success: true,

            stats: {
                total: Number(row.total),
                placed: Number(row.placed),
                processing: Number(row.processing),
                shipped: Number(row.shipped),
                delivered: Number(row.delivered),
                cancelled: Number(row.cancelled),
                totalValue: Number(row.total_value)
            }
        });

    } catch (error) {

        console.error("Order statistics error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch order statistics"
        });
    }
});

/* =========================================================
   LIST ORDERS
   GET /api/orders

   A buyer only ever sees the orders placed from their own
   account. An administrator sees every order, unless the
   query asks for "mine".
========================================================= */

router.get("/", async (req, res) => {

    try {

        const {
            search,
            status,
            scope
        } = req.query;

        const conditions = [];
        const values = [];

        let index = 1;

        const scopeToUser = !isAdmin(req) || scope === "mine";

        if (scopeToUser) {
            conditions.push(`o.user_id = $${index}`);
            values.push(req.user.id);
            index += 1;
        }

        if (status && ORDER_STATUSES.includes(status)) {
            conditions.push(`o.status = $${index}`);
            values.push(status);
            index += 1;
        }

        if (search && search.trim()) {
            conditions.push(`
                (
                    LOWER(o.order_number) LIKE LOWER($${index})
                    OR LOWER(u.name) LIKE LOWER($${index})
                    OR LOWER(u.email) LIKE LOWER($${index})
                )
            `);
            values.push(`%${search.trim()}%`);
            index += 1;
        }

        const where = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const result = await pool.query(
            `
            SELECT
                o.*,

                u.name  AS customer_name,
                u.email AS customer_email,

                COALESCE(items.item_count, 0)     AS item_count,
                COALESCE(items.total_quantity, 0) AS total_quantity

            FROM orders o

            LEFT JOIN users u
                ON u.id = o.user_id

            LEFT JOIN (
                SELECT
                    order_id,
                    COUNT(*)      AS item_count,
                    SUM(quantity) AS total_quantity
                FROM order_items
                GROUP BY order_id
            ) items
                ON items.order_id = o.id

            ${where}

            ORDER BY o.placed_at DESC, o.id DESC
            `,
            values
        );

        return res.json({
            success: true,
            orders: result.rows.map((row) => formatOrder(row))
        });

    } catch (error) {

        console.error("List orders error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch orders"
        });
    }
});

/* =========================================================
   GET ONE ORDER
   GET /api/orders/:id
========================================================= */

router.get("/:id", async (req, res) => {

    try {

        const orderId = Number(req.params.id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid order id is required"
            });
        }

        const result = await pool.query(
            `
            SELECT
                o.*,

                u.name  AS customer_name,
                u.email AS customer_email

            FROM orders o

            LEFT JOIN users u
                ON u.id = o.user_id

            WHERE o.id = $1
            `,
            [orderId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const order = result.rows[0];

        if (!isAdmin(req) && order.user_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "You can only view your own orders"
            });
        }

        const itemsResult = await pool.query(
            `
            SELECT *
            FROM order_items
            WHERE order_id = $1
            ORDER BY id ASC
            `,
            [orderId]
        );

        const totalQuantity = itemsResult.rows.reduce(
            (count, item) => count + Number(item.quantity || 0),
            0
        );

        return res.json({
            success: true,

            order: formatOrder(
                {
                    ...order,
                    item_count: itemsResult.rows.length,
                    total_quantity: totalQuantity
                },
                itemsResult.rows
            )
        });

    } catch (error) {

        console.error("Get order error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch the order"
        });
    }
});

/* =========================================================
   PLACE ORDER
   POST /api/orders

   Everything happens inside one transaction: the stock is
   locked and reduced, the order and its lines are written
   and the cart is emptied. If any step fails nothing is
   committed.
========================================================= */

router.post("/", async (req, res) => {

    const client = await pool.connect();

    try {

        const {
            contactName,
            contactPhone,
            shippingAddress,
            city,
            postalCode,
            country,
            paymentMethod,
            notes
        } = req.body;

        if (!contactName || !String(contactName).trim()) {
            return res.status(400).json({
                success: false,
                message: "A contact name is required"
            });
        }

        if (!shippingAddress || !String(shippingAddress).trim()) {
            return res.status(400).json({
                success: false,
                message: "A delivery address is required"
            });
        }

        if (!city || !String(city).trim()) {
            return res.status(400).json({
                success: false,
                message: "A city is required"
            });
        }

        await client.query("BEGIN");

        /* -----------------------------------------------------
           READ THE CART AND LOCK THE PRODUCTS
        ----------------------------------------------------- */

        const cartResult = await client.query(
            `
            SELECT
                c.product_id,
                c.quantity,

                p.product_name,
                p.part_number,
                p.manufacturer,
                p.category,
                p.image_url,
                p.price,
                p.available_stock,
                p.minimum_order_quantity

            FROM cart_items c

            INNER JOIN products p
                ON p.id = c.product_id

            WHERE c.user_id = $1

            ORDER BY c.id ASC

            FOR UPDATE OF p
            `,
            [req.user.id]
        );

        if (cartResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Your cart is empty"
            });
        }

        /* -----------------------------------------------------
           STOCK CHECK
        ----------------------------------------------------- */

        const outOfStock = cartResult.rows.filter(
            (row) => Number(row.quantity) > Number(row.available_stock)
        );

        if (outOfStock.length > 0) {

            await client.query("ROLLBACK");

            return res.status(409).json({
                success: false,

                message:
                    "Some items are no longer available in the requested quantity",

                unavailableItems: outOfStock.map((row) => ({
                    productId: row.product_id,
                    productName: row.product_name,
                    requested: Number(row.quantity),
                    availableStock: Number(row.available_stock)
                }))
            });
        }

        /* -----------------------------------------------------
           TOTALS
        ----------------------------------------------------- */

        const items = cartResult.rows.map((row) => {

            const unitPrice = Number(row.price || 0);
            const quantity = Number(row.quantity || 0);

            return {
                productId: row.product_id,
                productName: row.product_name,
                partNumber: row.part_number,
                manufacturer: row.manufacturer,
                category: row.category,
                imageUrl: row.image_url,
                unitPrice,
                quantity,
                lineTotal: round(unitPrice * quantity)
            };
        });

        const totals = buildTotals(items);

        /* -----------------------------------------------------
           CREATE THE ORDER
        ----------------------------------------------------- */

        const orderResult = await client.query(
            `
            INSERT INTO orders
            (
                user_id,
                status,
                subtotal,
                tax,
                shipping_fee,
                total,
                payment_method,
                contact_name,
                contact_phone,
                shipping_address,
                city,
                postal_code,
                country,
                notes
            )
            VALUES
            (
                $1,
                'Placed',
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                $12,
                $13
            )
            RETURNING id
            `,
            [
                req.user.id,
                totals.subtotal,
                totals.tax,
                totals.shippingFee,
                totals.total,
                paymentMethod || "Cash on Delivery",
                String(contactName).trim(),
                contactPhone ? String(contactPhone).trim() : "",
                String(shippingAddress).trim(),
                String(city).trim(),
                postalCode ? String(postalCode).trim() : "",
                country ? String(country).trim() : "India",
                notes ? String(notes).trim() : ""
            ]
        );

        const orderId = orderResult.rows[0].id;

        const orderNumber = `ORD-${String(orderId).padStart(5, "0")}`;

        await client.query(
            `
            UPDATE orders
            SET order_number = $1
            WHERE id = $2
            `,
            [orderNumber, orderId]
        );

        /* -----------------------------------------------------
           CREATE THE ORDER LINES AND REDUCE THE STOCK
        ----------------------------------------------------- */

        for (const item of items) {

            await client.query(
                `
                INSERT INTO order_items
                (
                    order_id,
                    product_id,
                    product_name,
                    part_number,
                    manufacturer,
                    image_url,
                    unit_price,
                    quantity,
                    line_total
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
                `,
                [
                    orderId,
                    item.productId,
                    item.productName,
                    item.partNumber || "",
                    item.manufacturer || "",
                    item.imageUrl || "",
                    item.unitPrice,
                    item.quantity,
                    item.lineTotal
                ]
            );

            await client.query(
                `
                UPDATE products
                SET
                    available_stock = available_stock - $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                `,
                [item.quantity, item.productId]
            );
        }

        /* -----------------------------------------------------
           MIRROR THE ORDER INTO THE PROCUREMENT REQUESTS

           The administrator screens (Dashboard and Requests)
           are built around the requests table, so every order
           also creates the matching procurement record.
        ----------------------------------------------------- */

        await client.query(
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
                user_id,
                order_id
            )
            VALUES
            (
                $1,
                CURRENT_TIMESTAMP,
                $2,
                $3,
                $4,
                'Pending',
                $5,
                $6,
                $7
            )
            ON CONFLICT (request_id)
            DO NOTHING
            `,
            [
                `REQ-${String(orderId).padStart(5, "0")}`,
                items[0].manufacturer || "Multiple suppliers",
                items.length,
                items[0].category || "General",
                totals.total,
                req.user.id,
                orderId
            ]
        );

        /* -----------------------------------------------------
           EMPTY THE CART
        ----------------------------------------------------- */

        await client.query(
            `
            DELETE FROM cart_items
            WHERE user_id = $1
            `,
            [req.user.id]
        );

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: `Order ${orderNumber} placed successfully`,

            order: {
                id: orderId,
                orderNumber,
                status: "Placed",
                subtotal: totals.subtotal,
                tax: totals.tax,
                shippingFee: totals.shippingFee,
                total: totals.total,
                itemCount: items.length,
                totalQuantity: totals.totalQuantity,
                items
            }
        });

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError.message);
        }

        console.error("Place order error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to place the order"
        });

    } finally {

        client.release();
    }
});

/* =========================================================
   UPDATE ORDER STATUS
   PATCH /api/orders/:id/status

   Administrator only.
========================================================= */

router.patch("/:id/status", requireAdmin, async (req, res) => {

    const client = await pool.connect();

    try {

        const orderId = Number(req.params.id);

        const { status } = req.body;

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid order id is required"
            });
        }

        if (!ORDER_STATUSES.includes(status)) {
            return res.status(400).json({
                success: false,

                message: `Status must be one of: ${ORDER_STATUSES.join(", ")}`
            });
        }

        await client.query("BEGIN");

        const current = await client.query(
            `
            SELECT id, status
            FROM orders
            WHERE id = $1
            FOR UPDATE
            `,
            [orderId]
        );

        if (current.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const previousStatus = current.rows[0].status;

        if (previousStatus === status) {

            await client.query("ROLLBACK");

            return res.json({
                success: true,
                message: `Order is already marked as ${status}`
            });
        }

        const wasReleased = STOCK_RELEASING_STATUSES.includes(previousStatus);
        const willRelease = STOCK_RELEASING_STATUSES.includes(status);

        if (!wasReleased && willRelease) {
            await releaseStock(client, orderId);
        }

        const updated = await client.query(
            `
            UPDATE orders
            SET
                status = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *
            `,
            [status, orderId]
        );

        /* Keep the mirrored procurement request in step. */

        const requestStatus =
            status === "Cancelled"
                ? "Rejected"
                : status === "Placed"
                    ? "Pending"
                    : "Approved";

        await client.query(
            `
            UPDATE requests
            SET
                status = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE order_id = $2
            `,
            [requestStatus, orderId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: `Order status updated to ${status}`,
            order: formatOrder(updated.rows[0])
        });

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError.message);
        }

        console.error("Update order status error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update the order status"
        });

    } finally {

        client.release();
    }
});

/* =========================================================
   CANCEL ORDER
   POST /api/orders/:id/cancel

   The buyer can cancel their own order while it has not
   been shipped. The reserved stock goes back to the
   catalogue.
========================================================= */

router.post("/:id/cancel", async (req, res) => {

    const client = await pool.connect();

    try {

        const orderId = Number(req.params.id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid order id is required"
            });
        }

        await client.query("BEGIN");

        const current = await client.query(
            `
            SELECT id, user_id, status, order_number
            FROM orders
            WHERE id = $1
            FOR UPDATE
            `,
            [orderId]
        );

        if (current.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const order = current.rows[0];

        if (!isAdmin(req) && order.user_id !== req.user.id) {

            await client.query("ROLLBACK");

            return res.status(403).json({
                success: false,
                message: "You can only cancel your own orders"
            });
        }

        if (order.status === "Cancelled") {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "This order has already been cancelled"
            });
        }

        if (
            !isAdmin(req) &&
            !BUYER_CANCELLABLE_STATUSES.includes(order.status)
        ) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,

                message: `An order that is already ${order.status.toLowerCase()} cannot be cancelled. Please contact the procurement team.`
            });
        }

        await releaseStock(client, orderId);

        const updated = await client.query(
            `
            UPDATE orders
            SET
                status = 'Cancelled',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
            `,
            [orderId]
        );

        await client.query(
            `
            UPDATE requests
            SET
                status = 'Rejected',
                updated_at = CURRENT_TIMESTAMP
            WHERE order_id = $1
            `,
            [orderId]
        );

        await client.query("COMMIT");

        return res.json({
            success: true,
            message: `Order ${order.order_number} has been cancelled`,
            order: formatOrder(updated.rows[0])
        });

    } catch (error) {

        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error("Rollback failed:", rollbackError.message);
        }

        console.error("Cancel order error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to cancel the order"
        });

    } finally {

        client.release();
    }
});

module.exports = router;
