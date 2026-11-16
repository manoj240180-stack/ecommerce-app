const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const { auth, adminOnly } = require("../middleware/auth");
const wrap = require("../middleware/wrap");

const { STATUSES } = Order;
const router = express.Router();
router.use(auth); // every order route needs a logged-in user

function checkId(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Invalid order id." });
  next();
}

// Puts stock back (used when an order is cancelled or fails)
async function restoreStock(items) {
  await Promise.all(items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { stock: i.qty } })));
}

// Marks one order cancelled and restores its stock. Returns null if nothing matched.
async function cancelOrder(filter) {
  const order = await Order.findOneAndUpdate(filter, { status: "cancelled" }, { new: true });
  if (order) await restoreStock(order.items);
  return order;
}

// Place an order (checkout)
router.post(
  "/",
  wrap(async (req, res) => {
    const { items, address } = req.body || {};
    if (!Array.isArray(items) || !items.length || items.length > 30) {
      return res.status(400).json({ error: "Your cart is empty." });
    }
    if (typeof address !== "string" || address.trim().length < 5 || address.length > 300) {
      return res.status(400).json({ error: "Please enter a delivery address (5 to 300 characters)." });
    }
    const wanted = new Map();
    for (const it of items) {
      if (!it || !mongoose.isValidObjectId(it.productId)) {
        return res.status(400).json({ error: "Invalid item in your cart." });
      }
      const qty = Number(it.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
        return res.status(400).json({ error: "Quantity must be between 1 and 99." });
      }
      const key = String(it.productId);
      wanted.set(key, (wanted.get(key) || 0) + qty);
    }

    // Take the stock one product at a time. The price always comes from the database.
    const taken = [];
    const lines = [];
    for (const [id, qty] of wanted) {
      const p = await Product.findOneAndUpdate({ _id: id, stock: { $gte: qty } }, { $inc: { stock: -qty } }, { new: true });
      if (!p) {
        await restoreStock(taken);
        const known = await Product.findById(id);
        return res.status(409).json({
          error: known
            ? `Not enough stock for ${known.name}. Only ${known.stock} left.`
            : "A product in your cart is no longer available.",
        });
      }
      taken.push({ product: p._id, qty });
      lines.push({ product: p._id, name: p.name, price: p.price, qty });
    }

    const total = Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100;
    try {
      const order = await Order.create({ user: req.user._id, items: lines, total, address: address.trim() });
      res.status(201).json(order);
    } catch (err) {
      await restoreStock(taken);
      throw err;
    }
  })
);

// My orders
router.get(
  "/mine",
  wrap(async (req, res) => {
    res.json(await Order.find({ user: req.user._id }).sort({ createdAt: -1 }));
  })
);

// Admin: all orders
router.get(
  "/",
  adminOnly,
  wrap(async (req, res) => {
    res.json(await Order.find().sort({ createdAt: -1 }).limit(200).populate("user", "name email"));
  })
);

// Admin: change the status of an order
router.put(
  "/:id/status",
  adminOnly,
  checkId,
  wrap(async (req, res) => {
    const { status } = req.body || {};
    if (!STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status." });
    const filter = { _id: req.params.id, status: { $ne: "cancelled" } };
    const order =
      status === "cancelled"
        ? await cancelOrder(filter)
        : await Order.findOneAndUpdate(filter, { status }, { new: true });
    if (!order) {
      const exists = await Order.findById(req.params.id);
      return exists
        ? res.status(400).json({ error: "Cancelled orders cannot be changed." })
        : res.status(404).json({ error: "Order not found." });
    }
    res.json(order);
  })
);

// Customer: cancel my own order while it is still "placed"
router.put(
  "/:id/cancel",
  checkId,
  wrap(async (req, res) => {
    const order = await cancelOrder({ _id: req.params.id, user: req.user._id, status: "placed" });
    if (!order) return res.status(400).json({ error: "This order can't be cancelled." });
    res.json(order);
  })
);

module.exports = router;
