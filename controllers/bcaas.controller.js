const BcaasUserMapping = require("../models/bcaasUserMapping.model");
const jwt = require("jsonwebtoken");

exports.ssoLogin = async (req, res) => {
    const { client_id, external_user_id, display_name, email, community_id } = req.body;

    if (!client_id || !external_user_id || !display_name || !community_id) {
        return res.status(400).json({ success: false, code: "BCaaS-003", message: "Missing structured mandatory user profile keys." });
    }

    try {
        // Sign token payload using configuration variables
        const token = jwt.sign(
            { id: "mock-uuid-999", role: "user", community_id }, 
            process.env.JWT_SECRET || "fallback_secret", 
            { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: true, 
            sameSite: "Strict", // Capitalized 'Strict' matches cookie specifications cleanly
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days lifecycle persistence
        });

        return res.status(200).json({ 
            success: true, 
            message: "SSO login successful." 
        });

    } catch (error) {
        console.error("SSO Login Controller Error:", error);
        return res.status(500).json({ success: false, code: "BCaaS-008", message: "Internal error during user onboarding runtime." });
    }
};