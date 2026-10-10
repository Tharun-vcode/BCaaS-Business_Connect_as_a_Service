const { DataTypes } = require("sequelize");
const db = require("../database");

const BusinessConnection = db.define("BusinessConnection", {
    connectionId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: "connection_id"
    },
    initiatorBusinessId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "initiator_business_id"
    },
    targetBusinessId: {
        type: DataTypes.STRING,
        allowNull: false,
        field: "target_business_id"
    },
    status: {
        type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED"),
        defaultValue: "PENDING",
        allowNull: false
    }
}, {
    tableName: "business_connections",
    timestamps: true,
    underscored: true
});

module.exports = BusinessConnection;