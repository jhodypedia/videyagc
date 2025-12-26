function requireAdmin(req, res, next) {
  if (req.session && req.session.admin_id) return next();
  return res.redirect((process.env.ADMIN_PATH || "/admin") + "/login");
}

module.exports = { requireAdmin };
