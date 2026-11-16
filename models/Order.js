const mongoose = require("mongoose");

const STATUSES = ["placed", "processing", "shipped", "delivered", "cancelled"];

// A copy of the product name and price is saved, so old orders never change
const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    items: { type: [itemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    status: { type: String, enum: STATUSES, default: "placed" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
module.exports.STATUSES = STATUSES;
