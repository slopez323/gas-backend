var express = require("express");
const { gasDB } = require("../mongo");
var router = express.Router();
const { uuid } = require("uuidv4");

const GAS_PAYMENT = {
  cash: [{ price: "--", updatedBy: "", updateTime: "" }],
  credit: [{ price: "--", updatedBy: "", updateTime: "" }],
};

const GAS_TYPES = {
  regular: GAS_PAYMENT,
  midgrade: GAS_PAYMENT,
  premium: GAS_PAYMENT,
  diesel: GAS_PAYMENT,
};

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
    const activityId = uuid();

    const PRICE_LOG = {
      activity: "price-update",
      placeId,
      placeName,
      placeAddress,
      price,
      type,
      method,
      time,
      activityId,
    };

    const userCollection = await gasDB().collection("users");
    const stationCollection = await gasDB().collection("stations");
    // const user = await userCollection.findOne({ username });
    const station = await stationCollection.findOne({ id: placeId });

    await userCollection.updateOne(
      { username },
      {
        $push: {
          log: PRICE_LOG,
        },
      }
    );

    //update station data
    if (!station) {
      await stationCollection.insertOne({
        id: placeId,
      });
      await stationCollection.updateOne(
        { id: placeId },
        {
          $set: GAS_TYPES,
        }
      );
    }

    const typemethod = `${type}.${method}`;
    await stationCollection.updateOne(
      {
        id: placeId,
      },
      {
        $push: {
          [typemethod]: {
            price,
            updatedBy: username,
            updateTime: time,
            activityId,
          },
        },
      }
    );

    res.json({ success: true, message: "price updated" });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

router.put("/delete-price", async function (req, res, next) {
  try {
    const username = req.body.username;
    const placeId = req.body.placeId;
    // const price = req.body.price;
    const type = req.body.type;
    const method = req.body.method;
    // const time = req.body.time;
    const activityId = req.body.activityId;

    const typemethod = `${type}.${method}`;

    const stationCollection = await gasDB().collection("stations");
    await stationCollection.updateOne(
      { id: placeId },
      {
        $pull: {
          [typemethod]: {
            activityId,
          },
        },
      }
    );

    const userCollection = await gasDB().collection("users");
    await userCollection.updateOne(
      { username },
      {
        $pull: {
          log: { activityId },
        },
      }
    );

    res.json({ success: true, message: "Price Update Deleted" });
  } catch (e) {
    console.error(e);
    res.json({ success: false });
  }
});

module.exports = router;
