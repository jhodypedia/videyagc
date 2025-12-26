const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const multer = require("multer");
const slugify = require("slugify");
const sanitizeHtml = require("sanitize-html");
const { Op } = require("sequelize");

const { Admin, Video, AdSlot, Setting, ViewLog } = require("../models");
const { requireAdmin } = require("../middleware/auth");
const { csrfForAdmin } = require("../middleware/security");

const router = express.Router();

function cleanText(s) {
  return sanitizeHtml((s || "").toString(), { allowedTags: [], allowedAttributes: {} }).trim();
}

async function getSettingsMap() {
  const rows = await Setting.findAll();
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

// Multer upload
const uploadDir = path.resolve(process.env.UPLOAD_DIR || "./uploads/videos");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safe = Date.now() + "-" + Math.random().toString(16).slice(2) + ext;
    cb(null, safe);
  }
});

const maxMb = parseInt(process.env.MAX_UPLOAD_MB || "400", 10);
const upload = multer({
  storage,
  limits: { fileSize: maxMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ["video/mp4", "video/webm", "video/x-matroska", "video/quicktime"];
    if (!ok.includes(file.mimetype)) return cb(new Error("Invalid video format"));
    cb(null, true);
  }
});

// Login page
router.get("/login", csrfForAdmin(), async (req, res) => {
  const settings = await getSettingsMap();
  res.render("admin_login", { settings, csrfToken: req.csrfToken(), error: null });
});

// Login submit
router.post("/login", csrfForAdmin(), async (req, res) => {
  const username = cleanText(req.body.username);
  const password = (req.body.password || "").toString();

  const admin = await Admin.findOne({ where: { username } });
  if (!admin) {
    const settings = await getSettingsMap();
    return res.status(401).render("admin_login", { settings, csrfToken: req.csrfToken(), error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) {
    const settings = await getSettingsMap();
    return res.status(401).render("admin_login", { settings, csrfToken: req.csrfToken(), error: "Invalid credentials" });
  }

  req.session.admin_id = admin.id;
  return res.redirect((process.env.ADMIN_PATH || "/admin") + "/");
});

// Logout
router.get("/logout", requireAdmin, async (req, res) => {
  req.session.destroy(() => {
    res.redirect((process.env.ADMIN_PATH || "/admin") + "/login");
  });
});

// Dashboard
router.get("/", requireAdmin, async (req, res) => {
  const settings = await getSettingsMap();
  const totalVideos = await Video.count();
  const published = await Video.count({ where: { is_published: true } });
  const totalViews = (await Video.sum("views")) || 0;
  const last7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const views7d = await ViewLog.count({ where: { createdAt: { [Op.gte]: last7 } } });

  res.render("admin_dashboard", {
    settings,
    stats: { totalVideos, published, totalViews, views7d },
    baseUrl: process.env.BASE_URL
  });
});

// Upload page
router.get("/upload", requireAdmin, csrfForAdmin(), async (req, res) => {
  const settings = await getSettingsMap();
  res.render("admin_upload", { settings, csrfToken: req.csrfToken(), error: null, ok: null });
});

// Upload submit
router.post("/upload", requireAdmin, csrfForAdmin(), upload.single("video"), async (req, res) => {
  const settings = await getSettingsMap();
  try {
    const title = cleanText(req.body.title);
    const description = cleanText(req.body.description);
    const tags = cleanText(req.body.tags);
    const publish = req.body.is_published === "1";

    if (!req.file) throw new Error("No file");
    if (!title) throw new Error("Title required");

    let slug = cleanText(req.body.slug);
    if (!slug) slug = slugify(title, { lower: true, strict: true });
    const exists = await Video.findOne({ where: { slug } });
    if (exists) slug = slug + "-" + Date.now().toString(36);

    await Video.create({
      title,
      slug,
      description,
      tags,
      filename: req.file.filename,
      mime: req.file.mimetype,
      size_bytes: req.file.size,
      is_published: publish
    });

    return res.render("admin_upload", { settings, csrfToken: req.csrfToken(), error: null, ok: "Uploaded!" });
  } catch (e) {
    // jika error dan file sudah terupload, hapus
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).render("admin_upload", { settings, csrfToken: req.csrfToken(), error: e.message, ok: null });
  }
});

// Videos list
router.get("/videos", requireAdmin, async (req, res) => {
  const settings = await getSettingsMap();
  const videos = await Video.findAll({ order: [["createdAt", "DESC"]] });
  res.render("admin_videos", { settings, videos, baseUrl: process.env.BASE_URL });
});

router.post("/videos/:id/toggle", requireAdmin, csrfForAdmin(), async (req, res) => {
  const v = await Video.findOne({ where: { id: req.params.id } });
  if (!v) return res.status(404).send("Not found");
  await Video.update({ is_published: !v.is_published }, { where: { id: v.id } });
  res.redirect((process.env.ADMIN_PATH || "/admin") + "/videos");
});

router.post("/videos/:id/delete", requireAdmin, csrfForAdmin(), async (req, res) => {
  const v = await Video.findOne({ where: { id: req.params.id } });
  if (!v) return res.status(404).send("Not found");

  const filePath = path.resolve(uploadDir, v.filename);
  await Video.destroy({ where: { id: v.id } });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  res.redirect((process.env.ADMIN_PATH || "/admin") + "/videos");
});

// Ads
router.get("/ads", requireAdmin, csrfForAdmin(), async (req, res) => {
  const settings = await getSettingsMap();
  const slots = await AdSlot.findAll({ order: [["id", "ASC"]] });
  res.render("admin_ads", { settings, slots, csrfToken: req.csrfToken() });
});

router.post("/ads", requireAdmin, csrfForAdmin(), async (req, res) => {
  const keys = Object.keys(req.body).filter(k => k.startsWith("script__"));
  for (const k of keys) {
    const slotKey = k.replace("script__", "");
    const script = (req.body[k] || "").toString(); // simpan raw (dibersihkan saat render)
    const enabled = req.body["enabled__" + slotKey] === "1";
    await AdSlot.update({ script, is_enabled: enabled }, { where: { key: slotKey } });
  }
  res.redirect((process.env.ADMIN_PATH || "/admin") + "/ads");
});

// Settings
router.get("/settings", requireAdmin, csrfForAdmin(), async (req, res) => {
  const settings = await getSettingsMap();
  res.render("admin_settings", { settings, csrfToken: req.csrfToken() });
});

router.post("/settings", requireAdmin, csrfForAdmin(), async (req, res) => {
  const allowed = ["site_name", "logo_text", "brand_color"];
  for (const k of allowed) {
    const val = cleanText(req.body[k]);
    await Setting.update({ value: val }, { where: { key: k } });
  }
  res.redirect((process.env.ADMIN_PATH || "/admin") + "/settings");
});

module.exports = router;
