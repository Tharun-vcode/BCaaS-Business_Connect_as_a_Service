const crypto = require("crypto");
const pool = require("../db");

//service imports
const {
    generateAndSendInvoiceForOrder,
} = require("../services/invoice.service");
const { activateBoostForOrder } = require("../services/profile.boost.service");
const {
    sendPushNotificationToUser,
} = require("../services/push.notification.service");
const {
    routePaymentToAdmin,
} = require("../services/razorpayRoute.service");

//function logic
// function sleep(ms) {
//     return new Promise((resolve) => setTimeout(resolve, ms));
// }
exports.handleRazorpayWebhook = async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            console.error("Missing RAZORPAY_WEBHOOK_SECRET");
            return res.status(500).json({ ok: false });
        }

        const razorpaySignature = req.headers["x-razorpay-signature"];
        const body = req.body; // Buffer

        if (!razorpaySignature || !body) {
            return res.status(400).send("Missing signature/body");
        }

        // 1) Verify webhook signature using webhook secret
        const expected = crypto
            .createHmac("sha256", webhookSecret)
            .update(body)
            .digest("hex");

        if (expected !== razorpaySignature) {
            return res.status(400).send("Invalid signature");
        }

        // 2) Parse event
        const event = JSON.parse(body.toString("utf8"));
        const eventType = event?.event;

        const paymentEntity = event?.payload?.payment?.entity || null;
        const orderEntity = event?.payload?.order?.entity || null;

        const paymentId = paymentEntity?.id || null;
        const orderId = paymentEntity?.order_id || orderEntity?.id || null;

        if (!orderId) return res.status(200).json({ ok: true });

        // 3) Update DB by event type
        if (eventType === "payment.captured") {
            // await sleep(60000 * 2); //to test pending payments case
            //overwrite with successful payment info
            const { rows } = await pool.query(
                `UPDATE premium
                SET is_successful = TRUE,
                    payment_id = $1,
                    payment_status = 'captured',
                    updated_at = NOW()
                WHERE order_id = $2
                RETURNING user_id, dates, amount, currency, 
                    is_featured_profile, 
                    is_search_preference, 
                    is_premium_banner, 
                    is_trending_banner,  
                    invoice_sent_at,
                    community_id,
                    admin_amount`,
                [paymentId, orderId],
            );
            if (rows.length === 0) {
                // Race condition: Row doesn't exist yet. Return 500 to force retry.
                console.error("Webhook: Order not found for", orderId);
                return res.status(500).json({ ok: false });
            }
            const order = rows[0];
            if (order.is_featured_profile || order.is_search_preference) {
                try {
                    await activateBoostForOrder(orderId);
                } catch (err) {
                    console.error(
                        `Immediate Boost activation failed for order ${orderId}`,
                        err,
                    );
                }
            }

            // D. Handle Invoice (Retry-Safe)
            if (!order.invoice_sent_at) {
                try {
                    await generateAndSendInvoiceForOrder(orderId);
                    await pool.query(
                        `UPDATE premium SET invoice_sent_at = NOW() WHERE order_id = $1`,
                        [orderId],
                    );
                    console.log(`Invoice sent for order ${orderId}`);
                } catch (err) {
                    console.error(
                        `Invoice send failed for order ${orderId}`,
                        err,
                    );
                    // still return 500 so Razorpay retries invoice sending
                    throw err;
                }
            }

            // Push should not be gated by invoice_sent_at, and should not break webhook delivery
            try {
                await sendPushNotificationToUser({
                    userId: order.user_id,
                    dates: order.dates,
                    status: "success",
                    amount: order.amount,
                    currency: order.currency,
                    flags: {
                        is_featured_profile: order.is_featured_profile,
                        is_search_preference: order.is_search_preference,
                        is_premium_banner: order.is_premium_banner,
                        is_trending_banner: order.is_trending_banner,
                    },
                });
                // console.log(`Push notification sent for order ${orderId}`);
            } catch (err) {
                console.error(`Success push failed for order ${orderId}`, err);
                // do NOT throw; otherwise retries may skip push due to invoice_sent_at
            }

            // E. Route payment to community admin via Razorpay Route
            try {
                const { rows: communityRows } = await pool.query(
                    "SELECT razorpay_account_id FROM communities WHERE id = $1",
                    [order.community_id],
                );

                if (
                    communityRows.length &&
                    communityRows[0].razorpay_account_id
                ) {
                    const adminAmountPaise = Math.round(
                        Number(order.admin_amount || 0) * 100,
                    );

                    if (adminAmountPaise > 0) {
                        const transfer = await routePaymentToAdmin(
                            paymentId,
                            communityRows[0].razorpay_account_id,
                            adminAmountPaise,
                        );

                        // Save transfer ID for future refund reversals
                        await pool.query(
                            `UPDATE premium SET razorpay_transfer_id = $1 WHERE order_id = $2`,
                            [transfer.items[0].id, orderId],
                        );
                        console.log(
                            `Routed ₹${adminAmountPaise / 100} to admin for order ${orderId}`,
                        );
                    }
                }
            } catch (routeErr) {
                // Log but don't throw — don't block webhook ack for routing failures
                // You can add a retry queue here later
                console.error(
                    `Route transfer failed for order ${orderId}:`,
                    routeErr.response?.data || routeErr.message,
                );
            }
        } else if (eventType === "payment.failed") {
            await pool.query(
                `UPDATE premium
                SET payment_id = $1,
                    payment_status = 'failed',
                    updated_at = NOW()
                WHERE order_id = $2
                AND payment_status IS DISTINCT FROM 'captured'`,
                [paymentId, orderId],
            );
        } else if (eventType === "payment.authorized") {
            const { rows } = await pool.query(
                `UPDATE premium
                SET payment_id = $1,
                    payment_status = 'authorized',
                    updated_at = NOW()
                WHERE order_id = $2
                AND payment_status IS DISTINCT FROM 'captured'
                AND payment_status IS DISTINCT FROM 'authorized'
                AND pending_notified_at IS NULL
                RETURNING order_id`,
                [paymentId, orderId],
            );

            if (rows.length === 0) return res.status(200).json({ ok: true });
        }
        return res.status(200).json({ ok: true });
    } catch (err) {
        console.error("Razorpay webhook error:", err);
        return res.status(500).json({ ok: false });
    }
};