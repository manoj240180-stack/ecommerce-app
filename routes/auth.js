const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { auth } = require("../middleware/auth");
const wrap = require("../middleware/wrap");

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sign = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });

router.post(
  "/register",
  wrap(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (![name, email, password].every((v) => typeof v === "string" && v.trim())) {
      return res.status(400).json({ error: "Name, email and password are required." });
    }
    if (!emailPattern.test(email.trim())) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }
    const cleanEmail = email.trim().toLowerCase();
    if (await User.findOne({ email: cleanEmail })) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    // The account that registers with ADMIN_EMAIL becomes the admin
    const isAdmin = !!process.env.ADMIN_EMAIL && cleanEmail === process.env.ADMIN_EMAIL.trim().toLowerCase();
    const user = await User.create({
      name,
      email: cleanEmail,
      password: await bcrypt.hash(password, 10),
      role: isAdmin ? "admin" : "user",
    });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  })
);

router.post(
  "/login",
  wrap(async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password are required." });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    const ok = user && (await bcrypt.compare(password, user.password));
    if (!ok) return res.status(401).json({ error: "Wrong email or password." });
    res.json({ token: sign(user), user: publicUser(user) });
  })
);

router.get("/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));

module.exports = router;
