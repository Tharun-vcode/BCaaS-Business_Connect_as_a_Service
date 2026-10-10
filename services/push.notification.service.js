const axios = require("axios");
const { formatReadableDates } = require("../helpers/date.format.helper");
const paymentStatusMessage = {
    success: {
        title: "Payment Successful",
        body: "Your payment of {{AMOUNT_PLACEHOLDER}} for service : {{SERVICE_PLACEHOLDER}}, {{SERVICE_DURATION}} been processed successfully.",
    },
    pending: {
        title: "Payment Pending",
        body: "Your payment of {{AMOUNT_PLACEHOLDER}} for service: {{SERVICE_PLACEHOLDER}}, {{SERVICE_DURATION}} is currently being processed. The service will be activated upon success otherwise the amount will be refunded",
    },
    failure: {
        title: "Payment Failed",
        body: "There was an issue processing your payment of {{AMOUNT_PLACEHOLDER}} for service: {{SERVICE_PLACEHOLDER}}, {{SERVICE_DURATION}}.",
    },
};
const serviceNamesMap = {
    is_featured_profile: "Featured Profile",
    is_search_preference: "Search Preference",
    is_premium_banner: "Premium Banner",
    is_trending_banner: "Trending Banner",
};

function resolveServiceName(flags = {}) {
    const key = Object.keys(flags).find(
        (k) => flags[k] === true && serviceNamesMap[k]
    );
    return serviceNamesMap[key] || "your selected services";
}

function fillTemplate(template, vars) {
    return String(template)
        .replaceAll("{{AMOUNT_PLACEHOLDER}}", vars.amountText || "")
        .replaceAll("{{SERVICE_PLACEHOLDER}}", vars.serviceName || "")
        .replaceAll("{{SERVICE_DURATION}}", vars.serviceDuration || "");
}

async function sendPushNotificationToUser({
    userId,
    dates,
    status,
    amount,
    currency,
    flags,
}) {
    const tpl = paymentStatusMessage[status];
    if (!tpl) return;

    const serviceName = resolveServiceName(flags);
    const amountText = `${currency} ${amount}`;
    const normalizedDates =
        typeof dates === "string" ? JSON.parse(dates) : dates;
    const formattedDates = formatReadableDates(normalizedDates);

    try {
        const res = await axios.post(
            `${process.env.ADMIN_BASE_URL}users/send-push-message`,
            {
                title: tpl.title,
                body: fillTemplate(tpl.body, {
                    amountText,
                    serviceName,
                    serviceDuration: formattedDates,
                }),

                recipientType: null,
                selectedUserIds: [userId],
            }
        );
        if (res.status === 200)
            console.log(`Push notification sent to user ${userId}`);
    } catch (e) {
        console.error(
            "Error sending push notification:",
            e?.response?.data || e?.message || e
        );
        throw e;
    }
}

module.exports = { sendPushNotificationToUser };
