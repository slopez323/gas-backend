var express = require("express");
const { gasDB } = require("../mongo");
var router = express.Router();
const { uuid } = require("uuidv4");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const isUniqueUser = async (username) => {
  const collection = await gasDB().collection("users");
  const existingUser = await collection.find({ username }).toArray();
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
      favorites: [],
      log: [],
    };
    collection.insertOne(user);
    return user.id;
  } catch (e) {
    console.error(e);
    return false;
  }
};

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

router.post("/register", async function (req, res, next) {
  try {
    const username = req.body.username;
    const password = req.body.password;

    if (username.length < 5) {
      res.json({
        message: "Username must be at least 5 characters long.",
        success: false,
      });
      return;
    }

    const unique = await isUniqueUser(username.toLowerCase());
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
    const userId = await createUser(username.toLowerCase(), hash);

    const jwtSecretKey = process.env.JWT_SECRET_KEY;
    const data = {
      time: new Date(),
      userId,
    };
    const token = jwt.sign(data, jwtSecretKey, { expiresIn: "15m" });

    if (userId) {
      res.json({ success: true, token });
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
      res.json({ message: "User does not exist.", success: false });
      return;
    }

    const match = await bcrypt.compare(req.body.password, user.password);

    const jwtSecretKey = process.env.JWT_SECRET_KEY;
    const data = {
      time: new Date(),
      userId: user.id,
      // scope: user.username.includes("codeimmersives.com") ? "admin" : "user",
    };
    const token = jwt.sign(data, jwtSecretKey, { expiresIn: "15m" });

    if (match) {
      res.json({ success: true, token });
      return;
    } else {
      res.json({ message: "Incorrect Password.", success: false });
      return;
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e, success: false });
  }
});

router.get("/user/:userId", async function (req, res, next) {
  try {
    const id = req.params.userId;
    const collection = await gasDB().collection("users");
    const user = await collection.findOne({ id });

    const { username, favorites, log } = user;

    res.json({ success: true, username, favorites, log });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: e });
  }
});

router.put("/add-fav", async function (req, res, next) {
  try {
    const userId = req.body.userId;
    const placeId = req.body.placeId;
    const placeName = req.body.name;
    const placeAddress = req.body.vicinity;
    const time = new Date();

    const FAV_LOG = {
      activity: "add-fav",
      placeId,
      placeName,
      placeAddress,
      time,
    };

    const collection = await gasDB().collection("users");
    await collection.updateOne(
      { id: userId },
      {
        $push: {
          favorites: FAV_LOG,
          log: FAV_LOG,
        },
      }
    );

    res.json({ success: true, message: "Updated user favorites" });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

router.put("/remove-fav", async function (req, res, next) {
  try {
    const userId = req.body.userId;
    const placeId = req.body.placeId;
    const placeName = req.body.name;
    const placeAddress = req.body.vicinity;
    const time = new Date();

    const FAV_LOG = {
      activity: "remove-fav",
      placeId,
      placeName,
      placeAddress,
      time,
    };

    const collection = await gasDB().collection("users");
    await collection.updateOne(
      { id: userId },
      {
        $push: {
          log: FAV_LOG,
        },
        $pull: {
          favorites: { placeId },
        },
      }
    );

    res.json({ success: true, message: "Updated user favorites" });
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

router.get("/validate-token", function (req, res, next) {
  try {
    const tokenHeaderKey = process.env.TOKEN_HEADER_KEY;
    const jwtSecretKey = process.env.JWT_SECRET_KEY;

    const token = req.header(tokenHeaderKey);
    const verified = jwt.verify(token, jwtSecretKey);

    if (verified) {
      return res.json({ success: true, message: verified.userId });
    }
    return res.json({ success: false });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

module.exports = router;
