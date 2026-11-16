const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const { auth, adminOnly } = require("../middleware/auth");
const wrap = require("../middleware/wrap");

const router = express.Router();

function checkId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid product id." });
  next();
}

// Takes only the allowed fields and checks them
function readBody(b, partial) {
  const out = {};
  const need = (k) => !partial || b[k] !== undefined;
  if (need("name")) {
    if (typeof b.name !== "string" || !b.name.trim()) return { error: "Name is required." };
    if (b.name.length > 120) return { error: "Name is too long." };
    out.name = b.name.trim();
  }
  if (need("price")) {
    const p = Number(b.price);
    if (b.price === "" || b.price === null || !Number.isFinite(p) || p < 0) {
      return { error: "Price must be a number, 0 or more." };
    }
    out.price = Math.round(p * 100) / 100;
  }
  if (need("stock")) {
    const s = Number(b.stock);
    if (b.stock === "" || b.stock === null || !Number.isInteger(s) || s < 0) {
      return { error: "Stock must be a whole number, 0 or more." };
    }
    out.stock = s;
  }
  if (b.description !== undefined) {
    if (typeof b.description !== "string" || b.description.length > 1000) return { error: "Description is too long." };
    out.description = b.description.trim();
  }
  if (b.category !== undefined) {
    if (typeof b.category !== "string" || b.category.length > 50) return { error: "Category is too long." };
    out.category = b.category.trim() || "General";
  }
  if (b.emoji !== undefined) {
    if (typeof b.emoji !== "string" || b.emoji.length > 8) return { error: "Emoji is too long." };
    out.emoji = b.emoji.trim() || "🛍️";
  }
  if (b.imageUrl !== undefined) {
    if (typeof b.imageUrl !== "string" || b.imageUrl.length > 500) return { error: "Image link is too long." };
    const u = b.imageUrl.trim();
    if (u && !/^https?:\/\//i.test(u)) return { error: "Image link must start with http:// or https://" };
    out.imageUrl = u;
  }
  return { data: out };
}

// Public: list and search products
router.get(
  "/",
  wrap(async (req, res) => {
    const filter = {};
    if (typeof req.query.category === "string" && req.query.category) filter.category = req.query.category;
    if (typeof req.query.q === "string" && req.query.q.trim()) {
      const safe = req.query.q.trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.name = new RegExp(safe, "i");
    }
    res.json(await Product.find(filter).sort({ createdAt: -1 }).limit(200));
  })
);

router.get(
  "/categories",
  wrap(async (req, res) => {
    const cats = await Product.distinct("category");
    res.json(cats.sort());
  })
);

router.get(
  "/:id",
  checkId,
  wrap(async (req, res) => {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: "Product not found." });
    res.json(p);
  })
);

// Admin only: create, update, delete
router.post(
  "/",
  auth,
  adminOnly,
  wrap(async (req, res) => {
    const { data, error } = readBody(req.body || {}, false);
    if (error) return res.status(400).json({ error });
    res.status(201).json(await Product.create(data));
  })
);

router.put(
  "/:id",
  auth,
  adminOnly,
  checkId,
  wrap(async (req, res) => {
    const { data, error } = readBody(req.body || {}, true);
    if (error) return res.status(400).json({ error });
    const p = await Product.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!p) return res.status(404).json({ error: "Product not found." });
    res.json(p);
  })
);

router.delete(
  "/:id",
  auth,
  adminOnly,
  checkId,
  wrap(async (req, res) => {
    const p = await Product.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ error: "Product not found." });
    res.json({ ok: true });
  })
);

module.exports = router;
