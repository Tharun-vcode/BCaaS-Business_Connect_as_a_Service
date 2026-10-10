const Premium = require("../models/premium.model");
const { Op } = require("sequelize");
const pool = require("../db");
const API_BASE_URL = process.env.API_BASE_URL;
const crypto = require("crypto");
const axios = require("axios");
const Razorpay = require("razorpay");
const {
    getCommunityBillingDetails,
} = require("../services/communityBilling.service");
const razorpay = new Razorpay({
    key_id: process.env.RAZOR_KEY,
    key_secret: process.env.RAZOR_SECRET,
});
const azure = require("../util/azure");
const { BlobServiceClient } = require("@azure/storage-blob");

function buildBillingInfoPayload(billing) {
    return {
        searchPreference: billing.searchPreference,
        featuredProfiles: billing.featuredProfiles,
        gst: billing.gst,
        premiumBanner: billing.premiumBanner,
        trendingBanner: billing.trendingBanner,
    };
}

function normalizeBlobFolderPath(folderPath) {
    return String(folderPath || "")
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\/+|\/+$/g, "");
}

exports.getBillingInfo = async (req, res) => {
    try {
        const billing = await getCommunityBillingDetails(req.user.community_id);
        return res.json(buildBillingInfoPayload(billing));
    } catch (err) {
        console.error("GET /premium/billing-info error:", err);
        return res.status(err.statusCode || 500).json({
            message: err.statusCode ? err.message : "Server error",
        });
    }
};

//fetch community specific banners
exports.getAllBannersForTheDay = async (req, res) => {
    const rawCommunityId = req.user?.community_id; // middleware sets req.user
    const communityId = Number.parseInt(rawCommunityId, 10);
    // console.log("Fetching banners for community ID:", communityId);
    const today = new Date();
    try {
        const { rows } = await pool.query(
            `SELECT banner_url,is_premium_banner,is_trending_banner,trending_banner_slot_no
            FROM premium
            WHERE (is_premium_banner=true OR is_trending_banner=true)
            AND is_successful=true
            AND community_id=$1
            AND EXISTS (
                SELECT 1 FROM jsonb_array_elements_text(dates) AS elem
                WHERE elem::timestamp::date = $2::date
                )
                ORDER BY created_at ASC`,
            [communityId, today.toISOString().split("T")[0]],
        );
        if (rows.length === 0) {
            return res
                .status(404)
                .json({ error: "No banners exist for the community today" });
        }
        return res.json(rows);
    } catch (err) {
        console.error("GET /premium/getAll failed:", err);
        return res.status(500).json({
            error: "Unexpected server error. Please try again later.",
        });
    }
};

exports.getDisabledDatesOfPremiumBanner = async (req, res) => {
    try {
        //retrieve community id from cookie
        const rawCommunityId = req.user?.community_id;
        const communityId = Number.parseInt(rawCommunityId, 10);
        const lockCutoff = new Date(Date.now() - 12 * 60 * 1000).toISOString();
        const { rows } = await pool.query(
            `
            SELECT jsonb_array_elements_text(dates) AS date
            FROM premium
            WHERE is_premium_banner = TRUE
              AND is_trending_banner = FALSE
              AND community_id = $1
              AND (
                is_successful = TRUE
                OR (is_successful = FALSE AND created_at >= $2)
              )
            `,
            [communityId, lockCutoff],
        );
        //remove duplicates
        const unique = [
            ...new Set(
                rows.map((r) => r.date.split("T")[0] + "T00:00:00.000Z"),
            ),
        ];
        res.json({ data: unique });
    } catch (err) {
        console.error("premium/disabled-dates:", err);
        res.status(500).json({ error: "Server error" });
    }
};
exports.getDisabledDatesOfTrendingBannerSlot = async (req, res) => {
    try {
        //retrieve community id from cookie
        const rawCommunityId = req.user?.community_id;
        const communityId = Number.parseInt(rawCommunityId, 10);
        const slotNo = Number(req.params.slotNo);
        if (slotNo == null) {
            return res
                .status(400)
                .json({ error: "Missing or invalid slot_no" });
        }
        const lockCutoff = new Date(Date.now() - 12 * 60 * 1000).toISOString();
        const { rows } = await pool.query(
            `
            SELECT jsonb_array_elements_text(dates) AS date
            FROM premium
            WHERE is_trending_banner = TRUE
              AND is_premium_banner = FALSE
              AND trending_banner_slot_no = $1
              AND community_id = $3
              AND (
                is_successful = TRUE
                OR (is_successful = FALSE AND created_at >= $2)
              )
            `,
            [slotNo, lockCutoff, communityId],
        );

        /* count bookings per day */
        const counts = {};
        rows.forEach(({ date }) => {
            const d = date.split("T")[0] + "T00:00:00.000Z";
            counts[d] = (counts[d] || 0) + 1;
        });

        const blocked = Object.keys(counts).filter((d) => counts[d] >= 1);
        res.json({ data: blocked });
    } catch (err) {
        console.error("trending-disabled-dates:", err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.getDisabledDatesOfFeaturedProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        //retrieve community id from cookie
        const rawCommunityId = req.user?.community_id;
        const communityId = Number.parseInt(rawCommunityId, 10);
        const result = await Premium.findAll({
            where: {
                // isSuccessful: true,
                isFeaturedProfile: true,
                communityId: communityId,
                [Op.or]: [
                    {
                        [Op.and]: [
                            { isSuccessful: false },
                            {
                                createdAt: {
                                    [Op.gte]: new Date(
                                        new Date() - 12 * 60 * 1000,
                                    ), // 12 minutes ago or later
                                },
                            },
                        ],
                    },
                    {
                        [Op.or]: [
                            { isSuccessful: true },
                            { createdAt: null }, // Include this condition if you want entries with isSuccessful true to not have the time condition
                        ],
                    },
                ],
            },
        });

        const dateCounts = {};
        const filteredDates = [];
        result.forEach((resutData) => {
            if (resutData.userId == userId) {
                resutData.dates.forEach((date) => {
                    const dateMod = date.split("T")[0] + "T00:00:00.000Z";
                    filteredDates.push(dateMod);
                });
            }
        });
        const aggregatedDates = result.reduce((acc, entry) => {
            return acc.concat(entry.dates);
        }, []);
        aggregatedDates.forEach((dateTime) => {
            const date = dateTime.split("T")[0] + "T00:00:00.000Z"; // Extracting date portion
            dateCounts[date] = (dateCounts[date] || 0) + 1;
            if (dateCounts[date] === 5) {
                filteredDates.push(date);
            }
        });
        const uniqueDates = [...new Set(filteredDates)];

        res.status(201).json({
            data: uniqueDates,
        });
    } catch (error) {
        console.error("Error retrieving filtered premium entries:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.getDisabledDatesOfSearchPreference = async (req, res) => {
    // const { userId } = req.params;
    try {
        const userId = req.user.id;
        //retrieve community id from cookie
        const rawCommunityId = req.user?.community_id;
        const communityId = Number.parseInt(rawCommunityId, 10);
        const result = await Premium.findAll({
            where: {
                // isSuccessful: true,
                isSearchPreference: true,
                communityId: communityId,
                [Op.or]: [
                    {
                        [Op.and]: [
                            { isSuccessful: false },
                            {
                                createdAt: {
                                    [Op.gte]: new Date(
                                        new Date() - 12 * 60 * 1000,
                                    ), // 12 minutes ago or later
                                },
                            },
                        ],
                    },
                    {
                        [Op.or]: [
                            { isSuccessful: true },
                            { createdAt: null }, // Include this condition if you want entries with isSuccessful true to not have the time condition
                        ],
                    },
                ],
            },
        });
        const aggregatedDates = result.reduce((acc, entry) => {
            return acc.concat(entry.dates);
        }, []);

        const dateCounts = {};
        const filteredDates = [];
        result.forEach((resutData) => {
            if (resutData.userId == userId) {
                resutData.dates.forEach((date) => {
                    const dateMod = date.split("T")[0] + "T00:00:00.000Z";
                    filteredDates.push(dateMod);
                });
            }
        });
        aggregatedDates.forEach((dateTime) => {
            const date = dateTime.split("T")[0] + "T00:00:00.000Z"; // Extracting date portion
            dateCounts[date] = (dateCounts[date] || 0) + 1;
            if (dateCounts[date] === 5) {
                filteredDates.push(date);
            }
        });
        const uniqueDates = [...new Set(filteredDates)];
        res.status(201).json({
            data: uniqueDates,
        });
    } catch (error) {
        console.error("Error retrieving filtered premium entries:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

function calculateAmount(dates, bannerType, rates) {
    const days = dates.length;
    const rate =
        bannerType === 1 ? rates.trendingBanner : rates.premiumBanner;

    const total = rate * days;
    const basePrice = total / (1 + rates.gst / 100);
    const tax = total - basePrice;

    return {
        days,
        rate,
        gst: rates.gst,
        basePrice: Number(basePrice.toFixed(2)),
        tax: Number(tax.toFixed(2)),
        amountPaise: Math.round(total * 100),
        total: Number(total.toFixed(2)),
    };
}
exports.calculateAmount = async (req, res) => {
    try {
        const { dates, bannerType } = req.body;
        const rawCommunityId = req.user?.community_id;
        const communityId = Number.parseInt(rawCommunityId, 10);
        if (!Array.isArray(dates) || !dates.length) {
            return res.status(400).json({ message: "Invalid dates" });
        }

        const rates = await getCommunityBillingDetails(communityId);
        const result = calculateAmount(dates, bannerType, rates);
        res.json(result);
    } catch (err) {
        console.error("Error in /premium/calculate:", err.message);
        res.status(err.statusCode || 500).json({
            message: err.statusCode ? err.message : "Server error",
        });
    }
};
//create a banner order
exports.createBannerOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        //retrieve community id from cookie
        const rawCommunityId = req.user?.community_id;
        const communityId = Number.parseInt(rawCommunityId, 10);
        const banner = req.file ? req.file.buffer : null; // File buffer
        const dates = JSON.parse(req.body?.dates); // Parse dates from string
        const bannerType = Number(req.body?.bannerType); // Convert to number if needed
        const slotNo = Number(req.body?.slotNo);
        let bannerUrl = "";

        if (!Array.isArray(dates) || dates.length === 0)
            return res.status(400).json({ message: "No dates provided" });

        const uniqueDates = [
            ...new Set(dates.map((d) => d.split("T")[0] + "T00:00:00.000Z")),
        ];
        const disabledDatesUrl =
            bannerType == 0
                ? `${API_BASE_URL}premium/premium-date`
                : `${API_BASE_URL}premium/trending-date-slot/${slotNo}`;

        const { data } = await axios.get(disabledDatesUrl, {
            headers: { Cookie: req.headers.cookie },
        });
        const blockedDates = data.data; // Array of blocked dates

        const isBlocked = uniqueDates.some((d) => blockedDates.includes(d));
        if (isBlocked) {
            return res
                .status(409)
                .json({ message: "Some dates are already booked" });
        }

        const rates = await getCommunityBillingDetails(communityId);
        const { amountPaise, total } = calculateAmount(
            uniqueDates,
            bannerType,
            rates,
        );

        // CHECK: community admin must be onboarded on Razorpay Route before payment
        const { rows: communityRows } = await pool.query(
            "SELECT razorpay_account_id, blob_folder_path FROM communities WHERE id = $1",
            [communityId],
        );
        if (!communityRows.length || !communityRows[0].razorpay_account_id) {
            return res.status(400).json({
                message: "Community admin has not completed Razorpay onboarding",
            });
        }
        const communityBlobFolderPath = normalizeBlobFolderPath(
            communityRows[0].blob_folder_path,
        );
        if (banner && !communityBlobFolderPath) {
            return res.status(400).json({
                message: "Community blob folder path is missing",
            });
        }

        // Calculate community-specific split for admin/platform settlement.
        const { calcSplit } = require("../services/razorpayRoute.service");
        const { adminAmount, platformAmount } = calcSplit(
            amountPaise,
            rates.commission,
        );

        const order = await razorpay.orders.create({
            amount: amountPaise, // paise!
            // amount: 100, //Test amount 1Rs
            currency: "INR",
        });
        if (banner != null && banner != undefined) {
            const azureStorageConnectionString = azure.connectionString;
            const blobServiceClient = BlobServiceClient.fromConnectionString(
                azureStorageConnectionString,
            );
            const containerName = "robizsaas";
            const containerClient =
                blobServiceClient.getContainerClient(containerName);

            await containerClient.createIfNotExists({
                access: "container",
            });

            const bannerName = `${communityBlobFolderPath}/banner/bannerPic_${Date.now()}.jpg`;
            const blockBlobClient =
                containerClient.getBlockBlobClient(bannerName);

            try {
                await blockBlobClient.uploadData(banner, {
                    blobHTTPHeaders: { blobContentType: "image/jpeg" },
                });
                bannerUrl = blockBlobClient.url;
            } catch (error) {
                console.error(error);
                return res.status(500).json({
                    message:
                        "Error uploading profile picture to Azure Blob Storage",
                });
            }
        }

        await pool.query(
            `INSERT INTO premium
            (user_id, banner_url, dates, is_premium_banner,
            is_trending_banner, amount, currency, order_id, 
            trending_banner_slot_no,
            is_successful,payment_status,created_at,updated_at,community_id,
            admin_amount, platform_amount)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE,'created',NOW(), NOW(), $10, $11, $12)
            RETURNING *`,
            [
                userId,
                bannerUrl,
                JSON.stringify(uniqueDates),
                bannerType == 0, // isPremiumBanner
                bannerType == 1, // isTrendingBanner
                total, // store rupees
                "INR",
                order.id,
                bannerType == 1 ? slotNo : null,
                communityId,
                adminAmount / 100,
                platformAmount / 100,
            ],
        );

        return res.json({
            message: "Order created successfully",
            razorpay: order, // id, amount, currency
        });
    } catch (err) {
        console.error("creating banner order failed:", err);
        res.status(err.statusCode || 500).json({
            message: err.statusCode ? err.message : "Failed to create order",
        });
    }
};

//create a profile boost order for the community
exports.createBoostOrder = async (req, res) => {
    try {
        const userId = req.user.id;

        //retrieve community id from cookie
        const rawCommunityId = req.user?.community_id;
        const communityId = Number.parseInt(rawCommunityId, 10);
        const { dates, type } = req.body;

        if (!dates || !Array.isArray(dates) || dates.length === 0 || !type) {
            return res
                .status(400)
                .json({ success: false, error: "Missing required fields" });
        }

        const uniqueDates = [
            ...new Set(dates.map((d) => d.split("T")[0] + "T00:00:00.000Z")),
        ];

        let disabledDatesUrl;
        if (type === "featured_profile") {
            disabledDatesUrl = `${API_BASE_URL}premium/featured-date`;
        } else if (type === "search_preference") {
            disabledDatesUrl = `${API_BASE_URL}premium/search-date`;
        } else {
            return res
                .status(400)
                .json({ success: false, error: "Invalid boost type" });
        }

        // Fetch blocked dates
        const { data } = await axios.get(disabledDatesUrl, {
            headers: { Cookie: req.headers.cookie }, // Pass auth cookie if needed
        });
        const blockedDates = data.data;

        // Check if any requested date is blocked
        const isBlocked = uniqueDates.some((d) => blockedDates.includes(d));
        if (isBlocked) {
            return res.status(409).json({
                success: false,
                error: "Some dates are already booked",
            });
        }
        // Calculate amount
        const days = uniqueDates.length;
        const rates = await getCommunityBillingDetails(communityId);
        let rate = 0;
        if (type === "search_preference") {
            rate = rates.searchPreference;
        } else if (type === "featured_profile") {
            rate = rates.featuredProfiles;
        } else {
            return res
                .status(400)
                .json({ success: false, error: "Invalid boost type" });
        }
        const amount = Number((days * rate).toFixed(2));

        const is_featured_profile = type === "featured_profile";
        const is_search_preference = type === "search_preference";

        const amountPaise = Math.round(amount * 100);

        // CHECK: community admin must be onboarded on Razorpay Route before payment
        const { rows: communityRows } = await pool.query(
            "SELECT razorpay_account_id FROM communities WHERE id = $1",
            [communityId],
        );
        if (!communityRows.length || !communityRows[0].razorpay_account_id) {
            return res.status(400).json({
                success: false,
                message: "Community admin has not completed Razorpay onboarding",
            });
        }

        // Calculate community-specific split for admin/platform settlement.
        const { calcSplit } = require("../services/razorpayRoute.service");
        const { adminAmount, platformAmount } = calcSplit(
            amountPaise,
            rates.commission,
        );

        const order = await razorpay.orders.create({
            amount: amountPaise, // paise!
            // amount:100 //test amount 1RS
            currency: "INR",
        });

        const insertQuery = `
            INSERT INTO premium (
                user_id,
                dates,
                is_successful,
                is_featured_profile,
                is_search_preference,
                amount,
                currency,
                order_id,
                payment_status,
                "created_at", 
                "updated_at",
                community_id,
                admin_amount,
                platform_amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8,'created',NOW(), NOW(), $9, $10, $11)
            RETURNING premium_id
            `;
        await pool.query(insertQuery, [
            userId,
            JSON.stringify(uniqueDates),
            false,
            is_featured_profile,
            is_search_preference,
            amount,
            "INR",
            order.id,
            communityId,
            adminAmount / 100,
            platformAmount / 100,
        ]);

        return res.status(200).json({ razorpay: order });
    } catch (err) {
        console.error("boost-profile booking failed:", err);
        return res
            .status(err.statusCode || 500)
            .json({
                success: false,
                error: err.statusCode ? err.message : "Internal server error",
            });
    }
};
//update payment status for client
exports.updatePayment = async (req, res) => {
    try {
        const { orderId, paymentId, paymentSignature } = req.body;
        //error status for missing fields
        if (!orderId || !paymentId || !paymentSignature) {
            return res.status(400).json({ message: "Missing payment details" });
        }
        //payment signature verification
        const body = orderId + "|" + paymentId;
        const expected = crypto
            .createHmac("sha256", process.env.RAZOR_SECRET)
            .update(body)
            .digest("hex");
        //error status for signature mismatch
        if (expected !== paymentSignature) {
            return res.status(400).json({ message: "Invalid Payment" });
        }
        //fetch actual payment details from razorpay
        const payment = await razorpay.payments.fetch(paymentId);

        //order id validation
        if (payment.order_id && payment.order_id !== orderId) {
            return res.status(400).json({ message: "Invalid Order" });
        }

        // 3.store payment id if not already exists and payment signature if db payment id and fetched payment id match
        //removed updated_at change from here
        const dbRes = await pool.query(
            `UPDATE premium
             SET payment_id = 
                    CASE 
                        WHEN payment_status = 'captured' 
                        THEN payment_id ELSE $1 
                        END,
                 payment_signature =
                     CASE
                       WHEN payment_id IS NULL OR payment_id = $1 THEN $2
                       ELSE payment_signature
                     END
             WHERE order_id = $3
             RETURNING payment_id, payment_status, is_successful`,
            [paymentId, paymentSignature, orderId],
        );

        if (dbRes.rowCount === 0) {
            return res.status(404).json({ message: "Order not found" });
        }

        //if payment updated in db by webhook immediately, return 200 ok
        const row = dbRes.rows[0];
        if (row.is_successful === true && row.payment_status === "captured") {
            return res.status(200).json({
                message: "Payment captured and saved",
            });
        }
        //return error status if payment not captured in db
        else if (row.payment_status !== "captured") {
            return res.status(400).json({
                message: `Payment not received yet, status=${payment.status}`,
            });
        }
        //client status 200 response only if payment is captured
        return res.status(200).json({
            message: "Payment captured & saved",
            paymentStatus: "captured",
        });
    } catch (err) {
        console.error("PUT /premium/update-payment:", err);
        res.status(500).json({ message: "Failed to record payment" });
    }
};
