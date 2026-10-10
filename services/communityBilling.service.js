const pool = require("../db");

const BILLING_FIELDS = {
    commission: "commission",
    premiumBanner: "premium_banner",
    trendingBanner: "trending_banner",
    featuredProfiles: "featured_profile",
    searchPreference: "search_preference",
};

function billingConfigError(message) {
    const error = new Error(message);
    error.statusCode = 500;
    error.isBillingConfigError = true;
    return error;
}

function parseNumericField(source, fieldName, label) {
    const rawValue = source[fieldName];
    const numericValue = Number(rawValue);

    if (!Number.isFinite(numericValue)) {
        throw billingConfigError(
            `Invalid or missing billing configuration for ${label}`,
        );
    }

    return numericValue;
}

async function getGlobalGst() {
    const { rows } = await pool.query(
        `
        SELECT DISTINCT amount::numeric AS amount
        FROM amount_values
        WHERE services = 'gst'
        `,
    );

    if (rows.length !== 1) {
        throw billingConfigError(
            "Global GST configuration is missing or inconsistent",
        );
    }

    return parseNumericField(rows[0], "amount", "gst");
}

async function getCommunityBillingDetails(communityId) {
    const parsedCommunityId = Number.parseInt(communityId, 10);

    if (!Number.isInteger(parsedCommunityId)) {
        throw billingConfigError("Invalid community identifier for billing");
    }

    const { rows } = await pool.query(
        `
        SELECT billing_details
        FROM communities
        WHERE id = $1
        `,
        [parsedCommunityId],
    );

    if (!rows.length) {
        throw billingConfigError("Community billing configuration not found");
    }

    const billingDetails = rows[0].billing_details || {};
    const gst = await getGlobalGst();

    return {
        commission: parseNumericField(
            billingDetails,
            BILLING_FIELDS.commission,
            BILLING_FIELDS.commission,
        ),
        premiumBanner: parseNumericField(
            billingDetails,
            BILLING_FIELDS.premiumBanner,
            BILLING_FIELDS.premiumBanner,
        ),
        trendingBanner: parseNumericField(
            billingDetails,
            BILLING_FIELDS.trendingBanner,
            BILLING_FIELDS.trendingBanner,
        ),
        featuredProfiles: parseNumericField(
            billingDetails,
            BILLING_FIELDS.featuredProfiles,
            BILLING_FIELDS.featuredProfiles,
        ),
        searchPreference: parseNumericField(
            billingDetails,
            BILLING_FIELDS.searchPreference,
            BILLING_FIELDS.searchPreference,
        ),
        gst,
    };
}

module.exports = {
    BILLING_FIELDS,
    getCommunityBillingDetails,
    billingConfigError,
};
