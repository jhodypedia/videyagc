const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const csurf = require("csurf");
const { sequelize } = require("../models");

function applySecurity(app) {
  app.use(helmet({
    contentSecurityPolicy: false // karena Adsterra butuh script inline; kita kontrol via DB + sanitize
  }));

  app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 300
  }));

  const store = new SequelizeStore({ db: sequelize });
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 12
    }
  }));
  store.sync();

  // CSRF untuk admin (dipakai di routes/admin)
  app.use((req, res, next) => {
    res.locals.ADMIN_PATH = process.env.ADMIN_PATH || "/admin";
    next();
  });
}

function csrfForAdmin() {
  return csurf({ cookie: false });
}

module.exports = { applySecurity, csrfForAdmin };
