var express = require("express");
const { gasDB } = require("../mongo");
var router = express.Router();
const { uuid } = require("uuidv4");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sgMail = require("@sendgrid/mail");
const generator = require("generate-password");

const isUniqueEmail = async (email) => {
  const collection = await gasDB().collection("users");
  const existingEmail = await collection.find({ email }).toArray();
  if (existingEmail.length > 0) {
    return false;
  }
  return true;
};

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

const createUser = async (email, username, password, userType) => {
  try {
    const collection = await gasDB().collection("users");
    const user = {
      email,
      username,
      password,
      access: userType,
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

router.post("/register", async function (req, res, next) {
  try {
    const email = req.body.email.toLowerCase();
    const username = req.body.username.toLowerCase();
    const password = req.body.password;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.json({
        message: "Enter a valid email.",
        success: false,
      });
      return;
    }
    if (username.length < 5) {
      res.json({
        message: "Username must be at least 5 characters long.",
        success: false,
      });
      return;
    }

    const uniqueEmail = await isUniqueEmail(email);
    if (!uniqueEmail) {
      res.json({
        message: "This email address already has an existing account.",
        success: false,
      });
      return;
    }
    const uniqueUser = await isUniqueUser(username);
    if (!uniqueUser) {
      res.json({ message: "Username not available.", success: false });
      return;
    }
    const valid = isValidPass(password);
    if (!valid) {
      res.json({
        message:
          "Password must be at least 8 characters long, must not include spaces and must include at least 1 letter, number and special character.",
        success: false,
      });
      return;
    }

    const userType = username === "admin" ? "admin" : "user";

    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(password, salt);
    const userId = await createUser(email, username, hash, userType);

    const jwtSecretKey = process.env.JWT_SECRET_KEY;
    const data = {
      time: new Date(),
      userId,
      scope: userType,
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
    const username = req.body.username.toLowerCase();
    const password = req.body.password;

    const collection = await gasDB().collection("users");
    const user = await collection.findOne({ username });
    if (!user) {
      res.json({ message: "User does not exist.", success: false });
      return;
    }

    const match = await bcrypt.compare(password, user.password);

    const jwtSecretKey = process.env.JWT_SECRET_KEY;
    const data = {
      time: new Date(),
      userId: user.id,
      scope: user.access,
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

router.put("/change-password", async function (req, res, next) {
  try {
    const id = req.body.userId;
    const password = req.body.password;

    const valid = isValidPass(password);
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

    const collection = await gasDB().collection("users");
    await collection.updateOne(
      { id },
      {
        $set: {
          password: hash,
        },
      }
    );

    res.json({ success: true, message: "Password successfully changed." });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

router.post("/forget-password", async function (req, res, next) {
  try {
    const email = req.body.email;

    const collection = await gasDB().collection("users");
    const user = await collection.findOne(
      { email },
      { projection: { favorites: 0, log: 0 } }
    );

    if (!user) {
      res.json({
        success: false,
        message: "No user associated with this email address.",
      });
      return;
    }

    const password = generator.generate({
      length: 10,
      numbers: true,
    });
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(password, salt);

    await collection.updateOne(
      { email },
      {
        $set: {
          password: hash,
        },
      }
    );

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = {
      to: email,
      from: "mygas.auto@gmail.com",
      subject: "myGas Temporary Password",
      text: `Your temporary password is ${password}.  You may change your password once you are signed in to your account.`,
    };
    sgMail
      .send(msg)
      .then(() => {
        res.json({
          success: true,
          message:
            "A temporary password has been created for you and will be sent to your email in the next few minutes.",
        });
      })
      .catch((e) => {
        console.error(e);
        res.json({ success: false });
      });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

router.get("/user", async function (req, res, next) {
  const id = req.query.id;
  const filter = req.query.filter;
  const sort = req.query.sort;
  const page = Number(req.query.page);
  const limit = Number(req.query.limit);
  const skip = (page - 1) * limit;

  const filterType = () => {
    if (filter === "fav") {
      return {
        $or: [
          {
            "log.activity": "add-fav",
          },
          {
            "log.activity": "remove-fav",
          },
        ],
      };
    } else if (filter === "price") {
      return {
        "log.activity": "price-update",
      };
    } else return {};
  };

  const sortType = () => {
    if (sort === "asc") {
      return { "log.time": 1 };
    } else return { "log.time": -1 };
  };

  const collection = await gasDB().collection("users");

  const user = await collection
    .aggregate([
      {
        $match: { id },
      },
      {
        $unwind: { path: "$log", preserveNullAndEmptyArrays: true },
      },
      {
        $match: filterType(),
      },
      {
        $sort: sortType(),
      },
      {
        $group: {
          _id: "$_id",
          username: { $first: "$username" },
          favorites: { $first: "$favorites" },
          log: { $push: "$log" },
        },
      },
      {
        $project: {
          username: 1,
          favorites: 1,
          totalLogs: {
            $size: "$log",
          },
          log: {
            $slice: ["$log", skip, limit ? limit : 10],
          },
        },
      },
    ])
    .toArray();

  res.json({ success: true, message: user[0] });
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
      if (verified.scope === "admin") {
        return res.json({
          success: true,
          message: verified.userId,
          isAdmin: true,
        });
      } else {
        return res.json({
          success: true,
          message: verified.userId,
          isAdmin: false,
        });
      }
    }
    return res.json({ success: false });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

module.exports = {
  usersRouter: router,
  isUniqueEmail,
  isUniqueUser,
  isValidPass,
  createUser,
};
