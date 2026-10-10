const db = require("../database");
const { DataTypes } = require("sequelize");
const User = require("./user.model");

const Premium = db.define(
    "Premium",
    {
        premiumId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },

        dates: {
            type: DataTypes.JSONB,
            allowNull: false,
        },
        isPremiumBanner: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        isTrendingBanner: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        isSearchPreference: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        isFeaturedProfile: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        orderId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        amount: {
            type: DataTypes.DECIMAL,
            allowNull: false,
        },
        currency: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        isSuccessful: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        paymentId: {
            type: DataTypes.STRING,
        },
        paymentSignature: {
            type: DataTypes.STRING,
        },
        bannerUrl: {
            type: DataTypes.STRING,
        },
        trendingBannerSlotNo: {
            type: DataTypes.INTEGER,
            field: "trending_banner_slot_no",
        },
        paymentStatus: {
            type: DataTypes.STRING,
            field: "payment_status",
        },
        invoiceSentAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "invoice_sent_at",
        },
        pendingNotifiedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: "pending_notified_at",
        },
        communityId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: "community_id",
        },
    },
    {
        tableName: "premium",
        underscored: true,
    },
);
User.hasMany(Premium, { foreignKey: "userId" });
Premium.belongsTo(User, { foreignKey: "userId" });

module.exports = Premium;
