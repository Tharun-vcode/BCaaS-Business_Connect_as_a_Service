const { DataTypes } = require("sequelize");
const db = require("../database");

const BcaasUserMapping = db.define("BcaasUserMapping", {
    mapping_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
    },
    bcaas_client_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    external_user_id: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    internal_user_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    last_sso_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: "bcaas_user_mappings",
    timestamps: true
});

module.exports = BcaasUserMapping;