// Adds sample products if the shop is empty. Run with:  npm run seed
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./models/Product");

const samples = [
  { name: "Wireless Headphones", description: "Bluetooth over-ear headphones with 30 hour battery.", price: 2499, stock: 25, category: "Electronics", emoji: "🎧" },
  { name: "Smart Watch", description: "Fitness tracking, heart rate and sleep monitor.", price: 3999, stock: 15, category: "Electronics", emoji: "⌚" },
  { name: "Power Bank 10000 mAh", description: "Slim fast-charging power bank.", price: 999, stock: 40, category: "Electronics", emoji: "🔋" },
  { name: "Laptop Backpack", description: "Water-resistant backpack with a padded laptop pocket.", price: 1299, stock: 30, category: "Fashion", emoji: "🎒" },
  { name: "Running Shoes", description: "Lightweight shoes with a cushioned sole.", price: 2199, stock: 20, category: "Fashion", emoji: "👟" },
  { name: "Ceramic Coffee Mug", description: "350 ml mug, dishwasher safe.", price: 349, stock: 60, category: "Home", emoji: "☕" },
  { name: "LED Desk Lamp", description: "Adjustable lamp with three brightness levels.", price: 899, stock: 18, category: "Home", emoji: "💡" },
  { name: "Notebook Set (3 pack)", description: "Ruled notebooks, 200 pages each.", price: 249, stock: 80, category: "Stationery", emoji: "📓" },
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    if (await Product.countDocuments()) {
      console.log("Products already exist. Nothing added.");
    } else {
      await Product.insertMany(samples);
      console.log(`Added ${samples.length} sample products.`);
    }
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  }
  await mongoose.disconnect();
})();
