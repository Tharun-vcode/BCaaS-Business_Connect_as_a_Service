const pool = require("../db");

async function activateBoostForOrder(orderId) {
    // Fetch the premium row for this order
    const { rows } = await pool.query(
        `SELECT user_id, dates, is_featured_profile, is_search_preference
         FROM premium
         WHERE order_id = $1
         LIMIT 1`,
        [orderId]
    );

    //no premium row then return
    if (!rows.length) return;

    const premium = rows[0];

    // Only activate if "today" is in dates
    const today = new Date();
    const todayDateString =
        today.toISOString().split("T")[0] + "T00:00:00.000Z";

    const hasToday = Array.isArray(premium.dates)
        ? premium.dates.some((d) => {
              const dt = new Date(d);
              const normalized =
                  dt.toISOString().split("T")[0] + "T00:00:00.000Z";
              return normalized === todayDateString;
          })
        : false;

    //if selected boost profile dates do not include today, return
    if (!hasToday) return;

    // Idempotent updates (setting TRUE repeatedly is safe)-activate boost only if today is there
    if (premium.is_featured_profile === true) {
        await pool.query(
            `UPDATE data_collection
             SET is_featured_profile = TRUE
             WHERE user_id = $1`,
            [premium.user_id]
        );
    } else if (premium.is_search_preference === true) {
        await pool.query(
            `UPDATE data_collection
             SET is_search_preference = TRUE
             WHERE user_id = $1`,
            [premium.user_id]
        );
    }
    console.log(
        `Boost for current day applied for user ${premium.user_id} and order ${orderId}`
    );
}

module.exports = { activateBoostForOrder };
