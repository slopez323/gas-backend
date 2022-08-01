var express = require("express");
const { gasDB } = require("../mongo");
var router = express.Router();
const { uuid } = require("uuidv4");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const isUniqueUser = async (username) => {
  const collection = await gasDB().collection("users");
  const existingUser = await collection.find({ username: username }).toArray();
  if (existingUser.length > 0) {
    return false;
  }
  return true;
};

const isValidPass = (password) => {
  if (
    !/\d/.test(password) ||
    !/[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/.test(password) ||
    !/[a-zA-Z]/.test(password) ||
    password.length < 8 ||
    password.includes(" ")
  )
    return false;
  return true;
};

const createUser = async (username, password) => {
  try {
    const collection = await gasDB().collection("users");
    const user = {
      username,
      password,
      id: uuid(),
    };
    collection.insertOne(user);
    return user.id;
  } catch (e) {
    console.error(e);
    return false;
  }
};

/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});

router.post("/register", async function (req, res, next) {
  try {
    const username = req.body.username;
    const password = req.body.password;

    const unique = await isUniqueUser(username);
    if (!unique) {
      res.json({ message: "Username not available", success: false });
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
    const userId = await createUser(username, hash);

    const jwtSecretKey = process.env.JWT_SECRET_KEY;
    const data = {
      time: new Date(),
      userId,
    };
    const token = jwt.sign(data, jwtSecretKey);

    if (userId) {
      res.json({ success: true, id: userId, token });
      return;
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e, success: false });
  }
});

router.post("/login", async function (req, res, next) {
  try {
    const collection = await gasDB().collection("users");
    const user = await collection.findOne({ username: req.body.username });
    if (!user) {
      res.json({ message: "User does not exist", success: false });
      return;
    }

    const match = await bcrypt.compare(req.body.password, user.password);

    const jwtSecretKey = process.env.JWT_SECRET_KEY;
    const data = {
      time: new Date(),
      userId: user.id,
      // scope: user.username.includes("codeimmersives.com") ? "admin" : "user",
    };
    const token = jwt.sign(data, jwtSecretKey);

    if (match) {
      res.json({ success: true, id: user.id, token });
      return;
    } else {
      res.json({ message: "Incorrect Password", success: false });
      return;
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e, success: false });
  }
});

module.exports = router;
