const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    category: { type: String, trim: true, maxlength: 50, default: "General" },
    emoji: { type: String, trim: true, maxlength: 8, default: "🛍️" },
    imageUrl: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
