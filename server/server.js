const express = require("express");
const cors = require("cors");
const path = require("path");

const connectDB = require("../db/db");
const User = require("../models/user");
const Promo = require("../models/promocode");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

connectDB();

app.patch("/api/users/:telegramId", async (req, res) => {
  try {
    const telegramId = Number(req.params.telegramId);
    const updateData = req.body;

    const user = await User.findOneAndUpdate({ telegramId }, updateData, {
      new: true,
    });

    if (!user) {
      return res.status(404).json({ message: "Користувача не знайдено" });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/users/:telegramId/inventory", async (req, res) => {
  try {
    const telegramId = Number(req.params.telegramId);
    const { itemId, count } = req.body;

    if (!itemId || typeof count !== "number") {
      return res.status(400).json({ error: "itemId і count обов'язкові" });
    }

    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: "Користувача не знайдено" });
    }

    const existingItem = user.inventory.find(
      (item) => item.itemId.toString() === itemId
    );

    if (existingItem) {
      existingItem.count += count;
    } else {
      user.inventory.push({ itemId, count });
    }

    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.delete("/api/promocode/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    const promo = await Promo.findOneAndDelete({ code });

    if (!promo) {
      return res.status(404).json({ error: "Промокод не знайдено" });
    }

    res.json({ message: `Промокод "${code}" успішно видалено` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/users", async (req, res) => {
  try {
    const user = new User(req.body);
    await user.save();
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/promocode/activate", async (req, res) => {
  try {
    const { telegramId, code } = req.body;
    if (!telegramId || !code) {
      return res.status(400).json({ error: "telegramId та code обов'язкові" });
    }

    const user = await User.findOne({ telegramId });
    if (!user) {
      return res.status(404).json({ error: "Користувача не знайдено" });
    }

    const upperCode = code.toUpperCase();

    const alreadyUsed = user.enteredPromocodes.some(
      (entry) => entry.code === upperCode
    );
    if (alreadyUsed) {
      return res.status(400).json({ error: "Промокод уже був використаний" });
    }

    const promocode = await Promo.findOne({ code: upperCode, isActive: true });
    if (!promocode) {
      return res
        .status(404)
        .json({ error: "Промокод не знайдено або неактивний" });
    }

    if (promocode.expiresAt && promocode.expiresAt < new Date()) {
      return res.status(400).json({ error: "Промокод сплив" });
    }

    user.balance += promocode.reward;
    user.enteredPromocodes.push({ code: upperCode });

    await user.save();

    res.json({
      message: `Промокод "${upperCode}" активовано! Баланс збільшено на ${promocode.reward}`,
      balance: user.balance,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
});
