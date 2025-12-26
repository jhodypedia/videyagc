const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define("AdSlot", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    key: { type: DataTypes.STRING(50), unique: true, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    script: { type: DataTypes.TEXT("long"), allowNull: true },
    is_enabled: { type: DataTypes.BOOLEAN, defaultValue: false }
  }, { tableName: "ad_slots" });
