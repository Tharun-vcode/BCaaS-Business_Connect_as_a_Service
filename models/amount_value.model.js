const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const AmountValue = sequelize.define(
    "AmountValue",
    {
      amount_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      services: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      community_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
    },
    {
      tableName: "amount_values",
      timestamps: true, // Configures Sequelize to handle created_at / updated_at automatically
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return AmountValue;
};
