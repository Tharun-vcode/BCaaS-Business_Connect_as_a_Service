const pool = require("../db");
exports.getAllCommunities = async (req, res) => {
    try {
        const dbRes = await pool.query(
            `SELECT id,name,code,logo_url 
            FROM communities 
            WHERE status='ACTIVE' 
            ORDER BY name ASC`,
        );
        return res.status(200).send(dbRes.rows);
    } catch (e) {
        return res.status(500).send({ message: "Internal Server Error" });
    }
};
