const rateLimit = require("express-rate-limit");
const BcaasClient = require("../models/bcaasClient.model");

// 1. Rate Limiting: 429 Too Many Requests after threshold limits
exports.ssoRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 30, // Threshold limit set slightly below the 35 audit baseline
    handler: (req, res) => {
        return res.status(429).json({
            success: false,
            code: "BCaaS-429",
            message: "Too many authentication attempts. Please try again after 60 seconds."
        });
    }
});

// 2. Dynamic CORS Whitelist Enforcer Middleware
exports.enforceBcaasCors = async (req, res, next) => {
    const origin = req.headers["origin"];
    const { client_id } = req.body;

    // Local Postman testing bypass
    if (req.headers["x-biznex-signature"] === "test_mode" || !origin) {
        return next();
    }

    try {
        const client = await BcaasClient.findByPk(client_id);
        
        // Block if origin doesn't match the client's registered domain url record
        if (!client || client.allowed_origin !== origin) {
            return res.status(403).json({
                success: false,
                message: "CORS policy violation: Origin domain not whitelisted for this client profile."
            });
        }

        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
        next();
    } catch (error) {
        return res.status(500).json({ success: false, message: "CORS structural check failure." });
    }
};