const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define("ViewLog", {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    video_id: { type: DataTypes.INTEGER, allowNull: false },
    ip_hash: { type: DataTypes.STRING(64), allowNull: false },
    ua: { type: DataTypes.STRING(255), allowNull: true }
  }, { tableName: "view_logs" });
