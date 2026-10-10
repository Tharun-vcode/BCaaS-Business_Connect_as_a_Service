const db = require("../database");
const DataTypes = require("sequelize");
const Testimonial = require("./testimonial.model");

// Define the User model
const User = db.define(
    "User",
    {
        userId: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        firstname: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        lastname: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        districtId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        clubName: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        rotaryId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        email: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
        },
        mobileNumber: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true,
        },
        otpExpiryTime: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        countryCode: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        emailOtp: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        mobileOtp: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        forgotPasswordOtp: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        isRegistered: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        fcmToken: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        singleNotification: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        storeNotification: {
            type: DataTypes.ARRAY(DataTypes.JSONB),
            allowNull: true,
            defaultValue: [],
        },
        sound: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: "System",
        },
        notification: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: "Show",
        },
        tempEmail: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        tempMobileNumber: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: "NEW",
        },
        alert: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
        },
        customerId: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        communityId: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        organizationId: {
            type: DataTypes.BIGINT,
            field: "organization_id",
            allowNull: true,
            defaultValue: null,
        },
        orgUnitHierarchy: {
            type: DataTypes.JSONB,
            field: "org_unit_hierarchy",
            allowNull: true,
            defaultValue: null,
        },
        resetPasswordToken: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        resetPasswordExpires: {
            type: DataTypes.DATE,
            allowNull: true,    
        },
    },
    {
        tableName: "users",
        underscored: true,
    },
);

User.hasMany(Testimonial, {
    foreignKey: "userId",
    as: "testimonials",
    onDelete: "CASCADE",
});

User.hasMany(Testimonial, {
    foreignKey: "referredUserId",
    as: "testimonialsBy",
    onDelete: "CASCADE",
});

module.exports = User;
