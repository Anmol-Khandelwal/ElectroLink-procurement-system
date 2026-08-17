const express = require("express");

const router = express.Router();

const pool = require("../config/db");

const {
    authenticateToken
} = require("../middleware/authMiddleware");

const {
    loadCart,
    clampQuantity
} = require("../utils/cart");

/* =========================================================
   AUTHENTICATION

   The cart always belongs to the logged in account, exactly
   like Amazon or Flipkart: it follows the user across
   devices instead of living only in the browser.
========================================================= */

router.use(authenticateToken);

/* =========================================================
   GET PRODUCT
========================================================= */

async function getProduct(productId) {

    const result = await pool.query(
        `
        SELECT
            id,
            product_name,
            price,
            available_stock,
            minimum_order_quantity
        FROM products
        WHERE id = $1
        `,
        [productId]
    );

    return result.rows[0] || null;
}

/* =========================================================
   GET CART
   GET /api/cart
========================================================= */

router.get("/", async (req, res) => {

    try {

        const cart = await loadCart(req.user.id);

        return res.json({
            success: true,
            cart
        });

    } catch (error) {

        console.error("Get cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load the cart"
        });
    }
});

/* =========================================================
   ADD TO CART
   POST /api/cart

   Adding a product that is already in the cart increases
   its quantity instead of creating a duplicate row.
========================================================= */

router.post("/", async (req, res) => {

    try {

        const productId = Number(req.body.product_id ?? req.body.productId);

        const requestedQuantity = Number(
            req.body.quantity ?? req.body.qty ?? 0
        );

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid product id is required"
            });
        }

        const product = await getProduct(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        if (Number(product.available_stock) <= 0) {
            return res.status(400).json({
                success: false,
                message: `${product.product_name} is out of stock`
            });
        }

        const existing = await pool.query(
            `
            SELECT quantity
            FROM cart_items
            WHERE user_id = $1
              AND product_id = $2
            `,
            [req.user.id, productId]
        );

        const currentQuantity = existing.rows.length
            ? Number(existing.rows[0].quantity)
            : 0;

        /* Without an explicit quantity the product is added one
           unit at a time. clampQuantity then lifts the line to
           the minimum order quantity and caps it at the stock. */

        const addedQuantity =
            Number.isFinite(requestedQuantity) && requestedQuantity > 0
                ? Math.floor(requestedQuantity)
                : 1;

        const quantity = clampQuantity(
            currentQuantity + addedQuantity,
            product
        );

        await pool.query(
            `
            INSERT INTO cart_items
            (
                user_id,
                product_id,
                quantity
            )
            VALUES
            (
                $1,
                $2,
                $3
            )
            ON CONFLICT (user_id, product_id)
            DO UPDATE SET
                quantity = EXCLUDED.quantity,
                updated_at = CURRENT_TIMESTAMP
            `,
            [req.user.id, productId, quantity]
        );

        const cart = await loadCart(req.user.id);

        return res.status(201).json({
            success: true,
            message: `${product.product_name} added to your cart`,
            cart
        });

    } catch (error) {

        console.error("Add to cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to add the product to the cart"
        });
    }
});

/* =========================================================
   UPDATE QUANTITY
   PUT /api/cart/:productId
========================================================= */

router.put("/:productId", async (req, res) => {

    try {

        const productId = Number(req.params.productId);

        const requestedQuantity = Number(req.body.quantity);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid product id is required"
            });
        }

        if (!Number.isFinite(requestedQuantity)) {
            return res.status(400).json({
                success: false,
                message: "A valid quantity is required"
            });
        }

        const product = await getProduct(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        /* A quantity of zero removes the line, the same way a
           quantity selector works on a shopping site. */

        if (requestedQuantity <= 0) {

            await pool.query(
                `
                DELETE FROM cart_items
                WHERE user_id = $1
                  AND product_id = $2
                `,
                [req.user.id, productId]
            );

            const emptiedCart = await loadCart(req.user.id);

            return res.json({
                success: true,
                message: "Item removed from your cart",
                cart: emptiedCart
            });
        }

        const quantity = clampQuantity(requestedQuantity, product);

        const updated = await pool.query(
            `
            UPDATE cart_items
            SET
                quantity = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
              AND product_id = $3
            RETURNING id
            `,
            [quantity, req.user.id, productId]
        );

        if (updated.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "This product is not in your cart"
            });
        }

        const cart = await loadCart(req.user.id);

        return res.json({
            success: true,

            message:
                quantity !== Math.floor(requestedQuantity)
                    ? `Quantity adjusted to ${quantity} because of the available stock`
                    : "Quantity updated",

            cart
        });

    } catch (error) {

        console.error("Update cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update the cart"
        });
    }
});

/* =========================================================
   REMOVE ITEM
   DELETE /api/cart/:productId
========================================================= */

router.delete("/:productId", async (req, res) => {

    try {

        const productId = Number(req.params.productId);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "A valid product id is required"
            });
        }

        await pool.query(
            `
            DELETE FROM cart_items
            WHERE user_id = $1
              AND product_id = $2
            `,
            [req.user.id, productId]
        );

        const cart = await loadCart(req.user.id);

        return res.json({
            success: true,
            message: "Item removed from your cart",
            cart
        });

    } catch (error) {

        console.error("Remove cart item error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to remove the item from the cart"
        });
    }
});

/* =========================================================
   CLEAR CART
   DELETE /api/cart
========================================================= */

router.delete("/", async (req, res) => {

    try {

        await pool.query(
            `
            DELETE FROM cart_items
            WHERE user_id = $1
            `,
            [req.user.id]
        );

        const cart = await loadCart(req.user.id);

        return res.json({
            success: true,
            message: "Cart cleared",
            cart
        });

    } catch (error) {

        console.error("Clear cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to clear the cart"
        });
    }
});

/* =========================================================
   MERGE CART
   POST /api/cart/merge

   Used right after login so anything the visitor collected
   before signing in is moved into the account cart.
========================================================= */

router.post("/merge", async (req, res) => {

    try {

        const incomingItems = Array.isArray(req.body.items)
            ? req.body.items
            : [];

        for (const incomingItem of incomingItems) {

            const productId = Number(
                incomingItem.product_id ??
                incomingItem.productId ??
                incomingItem.id
            );

            if (!Number.isInteger(productId) || productId <= 0) {
                continue;
            }

            const product = await getProduct(productId);

            if (!product || Number(product.available_stock) <= 0) {
                continue;
            }

            const existing = await pool.query(
                `
                SELECT quantity
                FROM cart_items
                WHERE user_id = $1
                  AND product_id = $2
                `,
                [req.user.id, productId]
            );

            const currentQuantity = existing.rows.length
                ? Number(existing.rows[0].quantity)
                : 0;

            const quantity = clampQuantity(
                currentQuantity + Number(incomingItem.quantity || 1),
                product
            );

            await pool.query(
                `
                INSERT INTO cart_items
                (
                    user_id,
                    product_id,
                    quantity
                )
                VALUES
                (
                    $1,
                    $2,
                    $3
                )
                ON CONFLICT (user_id, product_id)
                DO UPDATE SET
                    quantity = EXCLUDED.quantity,
                    updated_at = CURRENT_TIMESTAMP
                `,
                [req.user.id, productId, quantity]
            );
        }

        const cart = await loadCart(req.user.id);

        return res.json({
            success: true,
            message: "Cart synchronised",
            cart
        });

    } catch (error) {

        console.error("Merge cart error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to synchronise the cart"
        });
    }
});

module.exports = router;
