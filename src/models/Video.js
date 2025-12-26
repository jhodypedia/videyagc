const { DataTypes } = require("sequelize");

module.exports = (sequelize) =>
  sequelize.define("Video", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(160), allowNull: false },
    slug: { type: DataTypes.STRING(200), unique: true, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    tags: { type: DataTypes.STRING(500), allowNull: true }, // "tag1,tag2"
    filename: { type: DataTypes.STRING(255), allowNull: false },
    mime: { type: DataTypes.STRING(60), allowNull: false },
    size_bytes: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    is_published: { type: DataTypes.BOOLEAN, defaultValue: true },
    views: { type: DataTypes.INTEGER, defaultValue: 0 }
  }, { tableName: "videos" });
