const pool = require("../config/db");

/* =========================================================
   PRICING RULES

   Kept in one place so the cart, the checkout preview and
   the created order always agree on the same numbers.
========================================================= */

const TAX_RATE = 0.18;

const SHIPPING_FEE = 250;

const FREE_SHIPPING_THRESHOLD = 5000;

/* =========================================================
   ROUND

   Money is stored as NUMERIC(12,2), so every computed value
   is rounded to two decimals before it is sent or saved.
========================================================= */

function round(value) {
    return Math.round(Number(value || 0) * 100) / 100;
}

/* =========================================================
   BUILD TOTALS
========================================================= */

function buildTotals(items) {

    const subtotal = round(
        items.reduce(
            (total, item) => total + Number(item.lineTotal || 0),
            0
        )
    );

    const tax = round(subtotal * TAX_RATE);

    const shippingFee =
        subtotal <= 0 || subtotal >= FREE_SHIPPING_THRESHOLD
            ? 0
            : SHIPPING_FEE;

    const total = round(subtotal + tax + shippingFee);

    const totalQuantity = items.reduce(
        (count, item) => count + Number(item.quantity || 0),
        0
    );

    return {
        itemCount: items.length,
        totalQuantity,
        subtotal,
        tax,
        taxRate: TAX_RATE,
        shippingFee,
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
        total
    };
}

/* =========================================================
   LOAD CART

   Returns the cart of one user with the live product data
   attached, so a price or stock change made by the admin is
   reflected immediately.
========================================================= */

async function loadCart(userId, client = pool) {

    const result = await client.query(
        `
        SELECT
            c.id            AS cart_item_id,
            c.quantity,

            p.id            AS product_id,
            p.product_name,
            p.category,
            p.manufacturer,
            p.part_number,
            p.description,
            p.price,
            p.available_stock,
            p.minimum_order_quantity,
            p.image_url

        FROM cart_items c

        INNER JOIN products p
            ON p.id = c.product_id

        WHERE c.user_id = $1

        ORDER BY c.created_at ASC, c.id ASC
        `,
        [userId]
    );

    const items = result.rows.map((row) => {

        const price = Number(row.price || 0);
        const quantity = Number(row.quantity || 0);
        const stock = Number(row.available_stock || 0);

        return {
            cartItemId: row.cart_item_id,
            productId: row.product_id,
            productName: row.product_name,
            category: row.category,
            manufacturer: row.manufacturer,
            partNumber: row.part_number,
            description: row.description,
            imageUrl: row.image_url,

            price,
            quantity,

            availableStock: stock,
            minimumOrderQuantity: Number(row.minimum_order_quantity || 1),

            inStock: stock > 0,
            exceedsStock: quantity > stock,

            lineTotal: round(price * quantity)
        };
    });

    return {
        items,
        totals: buildTotals(items)
    };
}

/* =========================================================
   CLAMP QUANTITY

   Keeps a requested quantity inside the minimum order
   quantity and the available stock of the product.
========================================================= */

function clampQuantity(requestedQuantity, product) {

    const minimum = Math.max(
        1,
        Number(product.minimum_order_quantity || 1)
    );

    const stock = Number(product.available_stock || 0);

    let quantity = Math.floor(Number(requestedQuantity));

    if (!Number.isFinite(quantity) || quantity < minimum) {
        quantity = minimum;
    }

    if (stock > 0 && quantity > stock) {
        quantity = stock;
    }

    return quantity;
}

module.exports = {
    TAX_RATE,
    SHIPPING_FEE,
    FREE_SHIPPING_THRESHOLD,
    round,
    buildTotals,
    loadCart,
    clampQuantity
};
