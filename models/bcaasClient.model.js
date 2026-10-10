const { DataTypes } = require("sequelize");
const db = require("../database");

const BcaasClient = db.define("BcaasClient", {
    client_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
    },
    client_name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true
    },
    shared_secret: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    allowed_origin: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    licence_tier: {
        type: DataTypes.ENUM("BASIC", "STANDARD", "ENTERPRISE"),
        defaultValue: "BASIC",
        allowNull: false
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    }
}, {
    tableName: "bcaas_clients",
    timestamps: true
});

module.exports = BcaasClient;