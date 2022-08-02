var express = require("express");
const { gasDB } = require("../mongo");
var router = express.Router();

router.get("/station/:placeId", async function (req, res, next) {
  try {
    const id = req.params.placeId;
    const collection = await gasDB().collection("stations");
    const station = await collection.findOne({ id });
    if (station) {
      res.json({ success: true, message: station });
    } else {
      res.json({ success: true, no_prices: true });
    }
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

module.exports = router;
