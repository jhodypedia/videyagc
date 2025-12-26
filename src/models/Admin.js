const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define("Admin", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING(50), unique: true, allowNull: false },
    password_hash: { type: DataTypes.STRING(255), allowNull: false }
  }, { tableName: "admins" });
