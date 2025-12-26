require("dotenv").config();
const path = require("path");
const express = require("express");
const morgan = require("morgan");
const compression = require("compression");
const layouts = require("express-ejs-layouts");

const { applySecurity } = require("./src/middleware/security");
const { sequelize, initModels } = require("./src/models");

const publicRoutes = require("./src/routes/public");
const adminRoutes = require("./src/routes/admin");

const app = express();

if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));
app.use(layouts);
app.set("layout", false);

app.use(morgan("dev"));
app.use(compression());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));

applySecurity(app);

// Routes
app.use("/", publicRoutes);
app.use(process.env.ADMIN_PATH || "/admin", adminRoutes);

// 404
app.use((req, res) => res.status(404).send("Not Found"));

(async () => {
  await sequelize.authenticate();
  initModels();
  await sequelize.sync();

  // Seed admin pertama kalau belum ada
  const { Admin } = require("./src/models");
  const count = await Admin.count();
  if (count === 0) {
    const bcrypt = require("bcrypt");
    const hash = await bcrypt.hash("admin12345", 12);
    await Admin.create({ username: "admin", password_hash: hash });
    console.log("✅ Seed admin dibuat: admin / admin12345 (WAJIB GANTI!)");
  }

  // Seed default settings & ad slots
  const { Setting, AdSlot } = require("./src/models");
  const sCount = await Setting.count();
  if (sCount === 0) {
    await Setting.bulkCreate([
      { key: "site_name", value: "VideyLite" },
      { key: "logo_text", value: "VideyLite" },
      { key: "brand_color", value: "#22c55e" }
    ]);
  }
  const aCount = await AdSlot.count();
  if (aCount === 0) {
    await AdSlot.bulkCreate([
      { key: "header", name: "Header Banner", script: "", is_enabled: false },
      { key: "in_player", name: "In Player (overlay)", script: "", is_enabled: false },
      { key: "below_player", name: "Below Player", script: "", is_enabled: false },
      { key: "sidebar", name: "Sidebar", script: "", is_enabled: false },
      { key: "floating", name: "Floating Sticky", script: "", is_enabled: false }
    ]);
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log("🚀 Running on port", port));
})();
