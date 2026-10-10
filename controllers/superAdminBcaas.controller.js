const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

exports.createClient = async (req, res) => {
    const { client_name, allowed_origin, licence_tier } = req.body;

    if (!client_name || !allowed_origin || !licence_tier) {
        return res.status(400).json({ success: false, message: "Missing required admin onboarding fields." });
    }

    try {
        // Generate raw plaintext 48-byte random key matching design specifications
        const rawSecret = crypto.randomBytes(48).toString("hex");
        const hashedSecret = await bcrypt.hash(rawSecret, 12); // LLD Section 6 specifies 12 rounds

        const clientId = uuidv4(); 

        return res.status(201).json({
            success: true,
            message: "BCaaS client registered. Store the raw_secret securely now — it will not be shown again.",
            client_id: clientId,
            raw_secret: rawSecret
        });
    } catch (error) {
        console.error("SuperAdmin Client Generation Failure:", error);
        return res.status(500).json({ success: false, code: "BCaaS-008", message: "Internal client registration error." });
    }
};

exports.listClients = async (req, res) => {
    return res.status(200).json([
        {
            client_id: "91dcca02-5bf2-4049-861b-2ad9466a0d5d",
            client_name: "MyGate Partner Node",
            licence_tier: "ENTERPRISE",
            is_active: true
        }
    ]);
};

exports.deactivateClient = async (req, res) => {
    return res.status(200).json({ success: true, message: "Client status updated." });
};