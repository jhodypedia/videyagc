const { sequelize } = require("../config/db");

const Admin = require("./Admin")(sequelize);
const Video = require("./Video")(sequelize);
const AdSlot = require("./AdSlot")(sequelize);
const Setting = require("./Setting")(sequelize);
const ViewLog = require("./ViewLog")(sequelize);

function initModels() {
  Video.hasMany(ViewLog, { foreignKey: "video_id" });
  ViewLog.belongsTo(Video, { foreignKey: "video_id" });
}

module.exports = {
  sequelize,
  initModels,
  Admin,
  Video,
  AdSlot,
  Setting,
  ViewLog
};
