const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Checks the token, loads the user from the database and sets req.user
async function auth(req, res, next) {
  const header = req.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Please log in first." });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
  try {
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: "Account not found." });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

// Role-based access: use after auth
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access only." });
  }
  next();
}

module.exports = { auth, adminOnly };
