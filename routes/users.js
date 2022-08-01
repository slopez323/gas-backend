var express = require("express");
const { gasDB } = require("../mongo");
var router = express.Router();

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});

router.get("/user/:userId", async function (req, res, next) {
  try {
    const id = req.params.userId;
    const collection = await gasDB().collection("users");
    const user = await collection.findOne({ id });

    const { username, favorites, data } = user;

    res.json({ success: true, username, favorites, data });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: e });
  }
});

module.exports = router;
