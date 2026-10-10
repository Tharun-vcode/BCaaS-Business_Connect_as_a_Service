const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
    const Community = sequelize.define(
        "Community",
        {
            id: {
                type: DataTypes.BIGINT,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING(120),
                allowNull: false,
            },
            code: {
                type: DataTypes.STRING(32),
                allowNull: false,
            },
            logo_url: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            feature_flags: {
                type: DataTypes.JSONB,
                allowNull: false,
                defaultValue: {},
            },
            status: {
                type: DataTypes.STRING(24),
                allowNull: false,
                defaultValue: "active",
            },
            created_at: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW, // Fallback to Sequelize current timestamp if not using database default directly
            },
            razorpay_account_id: {
                type: DataTypes.STRING(64),
                allowNull: true,
            },
            kyc_status: {
                type: DataTypes.STRING(20),
                allowNull: false,
                defaultValue: "pending",
            },
            billing_details: {
                type: DataTypes.JSONB,
                allowNull: false,
                defaultValue: {},
            },
        },
        {
            tableName: "communities",
            timestamps: false, // Explicitly disabling default timestamps since we manually defined created_at (and updated_at is not visible)
        },
    );

    return Community;
};
