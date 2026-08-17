const bcrypt = require("bcryptjs");

const pool = require("../config/db");

const SALT_ROUNDS = 10;

/* =========================================================
   HASH PASSWORD
========================================================= */

async function hashPassword(plainPassword) {
    return bcrypt.hash(String(plainPassword), SALT_ROUNDS);
}

/* =========================================================
   IS HASHED

   Detects a bcrypt hash so that accounts created before the
   hashing change (plain text passwords) keep working.
========================================================= */

function isHashed(storedPassword) {
    return (
        typeof storedPassword === "string" &&
        /^\$2[aby]\$/.test(storedPassword)
    );
}

/* =========================================================
   VERIFY PASSWORD

   Compares against a bcrypt hash when the stored value is
   hashed, otherwise falls back to the legacy plain text
   comparison.
========================================================= */

async function verifyPassword(plainPassword, storedPassword) {

    if (!storedPassword) {
        return false;
    }

    if (isHashed(storedPassword)) {
        return bcrypt.compare(String(plainPassword), storedPassword);
    }

    return String(plainPassword) === String(storedPassword);
}

/* =========================================================
   UPGRADE LEGACY PASSWORD

   Called after a successful login. If the stored password is
   still plain text it is silently replaced with a hash, so
   old accounts migrate the first time they log in.
========================================================= */

async function upgradeLegacyPassword(userId, plainPassword, storedPassword) {

    if (isHashed(storedPassword)) {
        return;
    }

    try {
        const hashed = await hashPassword(plainPassword);

        await pool.query(
            `
            UPDATE users
            SET
                password = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            `,
            [hashed, userId]
        );

        console.log(
            `Password for user ${userId} migrated to a hashed value`
        );
    } catch (error) {
        console.error(
            "Could not migrate legacy password:",
            error.message
        );
    }
}

module.exports = {
    hashPassword,
    verifyPassword,
    isHashed,
    upgradeLegacyPassword
};
