const e = require("express");
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

router.post("/update-price", async function (req, res, next) {
  try {
    const price = req.body.price;
    const type = req.body.type;
    const method = req.body.method;
    const placeId = req.body.placeId;
    const placeName = req.body.name;
    const placeAddress = req.body.vicinity;
    const username = req.body.username;
    const time = new Date();

    const userCollection = await gasDB().collection("users");
    const stationCollection = await gasDB().collection("stations");
    const user = await userCollection.findOne({ username });
    const station = await stationCollection.findOne({ id: placeId });

    //update user log
    if (!user.data) {
      await userCollection.updateOne(
        { username },
        {
          $set: {
            data: [
              { placeId, placeName, placeAddress, price, type, method, time },
            ],
          },
        }
      );
    } else {
      await userCollection.updateOne(
        { username },
        {
          $push: {
            data: {
              placeId,
              placeName,
              placeAddress,
              price,
              type,
              method,
              time,
            },
          },
        }
      );
    }

    //update station data
    if (!station) {
      await stationCollection.insertOne({
        id: placeId,
        [type]: { [method]: { price, updatedBy: username, updateTime: time } },
      });
    } else if (!station[type]) {
      await stationCollection.updateOne(
        {
          id: placeId,
        },
        {
          $set: {
            [type]: {
              [method]: { price, updatedBy: username, updateTime: time },
            },
          },
        }
      );
    } else {
      const typemethod = `${type}.${method}`;
      await stationCollection.updateOne(
        {
          id: placeId,
        },
        {
          $set: {
            [typemethod]: { price, updatedBy: username, updateTime: time },
          },
        }
      );
    }

    res.json({ success: true, message: "price updated" });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

module.exports = router;
