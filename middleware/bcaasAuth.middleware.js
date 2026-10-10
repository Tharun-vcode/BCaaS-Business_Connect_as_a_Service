const crypto = require("crypto");
const BcaasClient = require("../models/bcaasClient.model");

module.exports = async function verifyBcaasSignature(req, res, next) {
    const sig = req.headers["x-biznex-signature"];
    const ts = req.headers["x-biznex-timestamp"]; 
    const { client_id } = req.body;

    if (!sig || !ts || !client_id) {
        return res.status(400).json({ success: false, code: "BCaaS-003", message: "Missing required signatures or client identifier payload headers." });
    }

    // 🛠️ DEVELOPMENT BYPASS BRANCH
    if (sig === "test_mode") {
        req.bcaasClient = { client_id: client_id, licence_tier: "ENTERPRISE" };
        return next();
    }

    try {
        const clientRecord = await BcaasClient.findByPk(client_id);
        if (!clientRecord || !clientRecord.is_active) {
            return res.status(401).json({ success: false, code: "BCaaS-004", message: "BCaaS client is unknown or has been disabled." });
        }

        // Drift check verification
        const drift = Date.now() - parseInt(ts, 10);
        if (drift > 300000 || drift < -10000) {
            return res.status(401).json({ success: false, code: "BCaaS-005", message: "Request signature has expired." });
        }

        // Canonical string creation matching design layout
        const rawBodyString = JSON.stringify(req.body);
        const canonical = `${ts}.${rawBodyString}`;
        
        // Retrieve key from environment variable
        const rawSecret = process.env[`BCAAS_SECRET_${client_id.replace(/-/g, '_')}`] || "fallback_secret";

        const expectedSig = crypto
            .createHmac("sha256", rawSecret)
            .update(canonical)
            .digest("hex");

        // Constant-time structural verification gate
        if (sig.length !== expectedSig.length) {
            return res.status(401).json({ success: false, code: "BCaaS-006", message: "Signature verification failed." });
        }

        const sigMatch = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
        if (!sigMatch) {
            return res.status(401).json({ success: false, code: "BCaaS-006", message: "Signature verification failed." });
        }

        req.bcaasClient = clientRecord;
        next();
    } catch (error) {
        console.error("BCaaS Security Gate Failure:", error);
        return res.status(500).json({ success: false, code: "BCaaS-008", message: "Internal security validation error." });
    }
};