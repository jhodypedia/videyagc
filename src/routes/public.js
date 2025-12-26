const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const sanitizeHtml = require("sanitize-html");

const { Video, AdSlot, Setting, ViewLog } = require("../models");

const router = express.Router();

async function getSettingsMap() {
  const rows = await Setting.findAll();
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

async function getAdsMap() {
  const rows = await AdSlot.findAll();
  const map = {};
  for (const r of rows) {
    map[r.key] = r.is_enabled ? (r.script || "") : "";
  }
  return map;
}

function safeAdScript(script) {
  // Hardcore mode tapi aman: tetap allow script/ins/iframe, blok event handler aneh.
  return sanitizeHtml(script || "", {
    allowedTags: ["script", "ins", "iframe", "div", "span"],
    allowedAttributes: {
      "*": ["class", "style"],
      "script": ["src", "async", "data-cfasync", "type"],
      "iframe": ["src", "width", "height", "loading", "referrerpolicy", "sandbox", "allow", "allowfullscreen"],
      "ins": ["class", "style", "data-*"]
    },
    allowVulnerableTags: true
  });
}

// Home
router.get("/", async (req, res) => {
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = 24;
  const offset = (page - 1) * limit;

  const settings = await getSettingsMap();
  const ads = await getAdsMap();

  const { rows, count } = await Video.findAndCountAll({
    where: { is_published: true },
    order: [["createdAt", "DESC"]],
    limit, offset
  });

  const totalPages = Math.ceil(count / limit);

  res.render("public_home", {
    settings,
    ads: Object.fromEntries(Object.entries(ads).map(([k,v]) => [k, safeAdScript(v)])),
    videos: rows,
    page,
    totalPages,
    baseUrl: process.env.BASE_URL
  });
});

// Watch page
router.get("/v/:slug", async (req, res) => {
  const settings = await getSettingsMap();
  const ads = await getAdsMap();

  const video = await Video.findOne({ where: { slug: req.params.slug, is_published: true } });
  if (!video) return res.status(404).send("Video not found");

  // anti spam view: 1 IP hash per 6 jam per video
  const ip = (req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString();
  const ipHash = crypto.createHash("sha256").update(ip + "||" + video.id).digest("hex");

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const exists = await ViewLog.findOne({ where: { video_id: video.id, ip_hash: ipHash, createdAt: { ["$gte$"]: sixHoursAgo } } })
    .catch(() => null);

  if (!exists) {
    await ViewLog.create({ video_id: video.id, ip_hash: ipHash, ua: (req.headers["user-agent"] || "").slice(0, 255) });
    await Video.update({ views: video.views + 1 }, { where: { id: video.id } });
    video.views += 1;
  }

  res.render("public_watch", {
    settings,
    ads: Object.fromEntries(Object.entries(ads).map(([k,v]) => [k, safeAdScript(v)])),
    video,
    baseUrl: process.env.BASE_URL
  });
});

// Stream (Range request)
router.get("/stream/:id", async (req, res) => {
  const video = await Video.findOne({ where: { id: req.params.id, is_published: true } });
  if (!video) return res.status(404).end();

  const filePath = path.resolve(process.env.UPLOAD_DIR || "./uploads/videos", video.filename);
  if (!fs.existsSync(filePath)) return res.status(404).end();

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader("Content-Type", video.mime);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "public, max-age=86400");

  if (!range) {
    res.setHeader("Content-Length", fileSize);
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const parts = range.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1024 * 1024 * 2, fileSize - 1);

  if (start >= fileSize) {
    res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
    return;
  }

  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
  res.setHeader("Content-Length", end - start + 1);

  fs.createReadStream(filePath, { start, end }).pipe(res);
});

// SEO files
router.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(
`User-agent: *
Allow: /
Sitemap: ${process.env.BASE_URL}/sitemap.xml
`
  );
});

router.get("/sitemap.xml", async (req, res) => {
  const vids = await Video.findAll({ where: { is_published: true }, order: [["updatedAt", "DESC"]] });
  res.type("application/xml");
  const urls = vids.map(v => `
  <url>
    <loc>${process.env.BASE_URL}/v/${v.slug}</loc>
    <lastmod>${new Date(v.updatedAt).toISOString()}</lastmod>
  </url>`).join("\n");

  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${process.env.BASE_URL}/</loc></url>
  ${urls}
</urlset>`);
});

router.get("/rss.xml", async (req, res) => {
  const vids = await Video.findAll({ where: { is_published: true }, order: [["createdAt", "DESC"]], limit: 50 });
  res.type("application/xml");
  const items = vids.map(v => `
  <item>
    <title><![CDATA[${v.title}]]></title>
    <link>${process.env.BASE_URL}/v/${v.slug}</link>
    <guid>${process.env.BASE_URL}/v/${v.slug}</guid>
    <pubDate>${new Date(v.createdAt).toUTCString()}</pubDate>
    <description><![CDATA[${(v.description||"").slice(0, 300)}]]></description>
  </item>`).join("\n");

  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${process.env.CANONICAL_DOMAIN}</title>
  <link>${process.env.BASE_URL}</link>
  <description>Latest videos</description>
  ${items}
</channel></rss>`);
});

module.exports = router;
