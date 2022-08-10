var express = require("express");
const { gasDB } = require("../mongo");
var router = express.Router();
const { isUniqueUser, isValidPass, createUser } = require("./users");
const bcrypt = require("bcryptjs");

router.get("/all-users", async function (req, res, next) {
  try {
    const searchType = req.query.searchType;
    const searchTerm = req.query.searchTerm;
    const filter = req.query.filter;
    const page = Number(req.query.page);
    const limit = Number(req.query.limit);
    const skip = limit * (page - 1);

    console.log("search", searchTerm);

    const find = () => {
      if (filter === "all") {
        if (searchTerm !== "none") {
          return { [searchType]: new RegExp(searchTerm, "i") };
        } else return {};
      } else {
        if (searchTerm !== "none") {
          return { [searchType]: new RegExp(searchTerm, "i"), access: filter };
        } else return { access: req.query.filter };
      }
    };

    const collection = await gasDB().collection("users");
    const users = await collection
      .find(find())
      .project({ password: 0, favorites: 0, log: 0 })
      .skip(skip)
      .limit(limit)
      .toArray();
    const count = await collection.find(find()).count();

    if (users) {
      res.json({ success: true, message: users, count });
    } else res.json({ success: false });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

router.post("/create-user", async function (req, res, next) {
  try {
    const username = req.body.username.toLowerCase();
    const password = req.body.password;
    const access = req.body.access;

    if (username.length < 5) {
      res.json({
        message: "Username must be at least 5 characters long.",
        success: false,
      });
      return;
    }

    const unique = await isUniqueUser(username);
    if (!unique) {
      res.json({ message: "Username not available.", success: false });
      return;
    }
    const valid = await isValidPass(password);
    if (!valid) {
      res.json({
        message:
          "Password must be at least 8 characters long, must not include spaces and must include at least 1 letter, number and special character.",
        success: false,
      });
      return;
    }

    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(password, salt);
    const userId = await createUser(username, hash, access);

    if (userId) {
      res.json({ success: true, message: "User created." });
      return;
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e, success: false });
  }
});

router.put("/edit-user", async function (req, res, next) {
  try {
    const id = req.body.id;
    const username = req.body.username;
    const access = req.body.access;

    const collection = await gasDB().collection("users");

    await collection.updateOne(
      { id },
      {
        $set: { username, access },
      }
    );

    res.json({ success: true, message: "User updated." });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

router.delete("/delete-user/:id", async function (req, res, next) {
  try {
    const id = req.params.id;

    const collection = await gasDB().collection("users");

    await collection.deleteOne({ id });

    res.json({ success: true, message: "User deleted" });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

module.exports = router;
