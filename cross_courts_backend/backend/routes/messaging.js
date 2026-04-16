const express = require("express");
const axios = require("axios");

const { db } = require("../config/db");
const env = require("../config/env");
const { formatApiError } = require("../utils/formatApiError");
const {
  getCustomMessageFromFirestore,
  setCustomMessageInFirestore,
} = require("../services/firestore/operations");

const router = express.Router();

const INSTANCE_ID = "instance125491";
const TOKEN = "aetxzpbrn6ssb7ym";

const customMessageHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseOperations) {
      const message = await getCustomMessageFromFirestore();
      return res.json({ message });
    }

    const [rows] = await db.query("SELECT message FROM custom_message LIMIT 1");

    if (rows.length === 0) {
      return res.json({ message: "" });
    }

    return res.json({ message: rows[0].message });
  } catch (err) {
    console.error("Error fetching custom message:", err);
    return res.status(500).json({ error: formatApiError(err) });
  }
};

const updateCustomMessageHandler = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.length < 10) {
      return res.status(400).json({
        error: "Message must be at least 10 characters long.",
      });
    }

    if (env.features.useFirebaseOperations) {
      await setCustomMessageInFirestore(message);
      return res.json({
        success: true,
        message: "Message updated successfully!",
      });
    }

    const [rows] = await db.query("SELECT id FROM custom_message LIMIT 1");

    if (rows.length === 0) {
      await db.query("INSERT INTO custom_message (message) VALUES (?)", [message]);
    } else {
      const rowId = rows[0].id;
      await db.query("UPDATE custom_message SET message = ? WHERE id = ?", [
        message,
        rowId,
      ]);
    }

    return res.json({
      success: true,
      message: "Message updated successfully!",
    });
  } catch (err) {
    console.error("Error updating custom message:", err);
    return res.status(500).json({ error: formatApiError(err) });
  }
};

const sendWhatsappHandler = async (req, res) => {
  const { phone } = req.body;

  try {
    let msg = "";
    if (env.features.useFirebaseOperations) {
      msg = await getCustomMessageFromFirestore();
    } else {
      const [rows] = await db.query(`SELECT message FROM custom_message WHERE id = 1`);
      msg = rows.length ? rows[0].message : "";
    }

    if (!msg) {
      return res
        .status(404)
        .json({ success: false, error: "Message not found." });
    }

    const response = await axios.post(
      `https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`,
      {
        token: TOKEN,
        to: `+${phone}`,
        body: msg,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error("Error sending WhatsApp message:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

router.get("/custom-message", customMessageHandler);
router.get("/operator/messages/custom-message", customMessageHandler);
router.get("/admin/messages/custom-message", customMessageHandler);

router.put("/custom-message", updateCustomMessageHandler);
router.put("/operator/messages/custom-message", updateCustomMessageHandler);
router.put("/admin/messages/custom-message", updateCustomMessageHandler);

router.post("/send-whatsapp", sendWhatsappHandler);
router.post("/operator/messages/send-whatsapp", sendWhatsappHandler);
router.post("/admin/messages/send-whatsapp", sendWhatsappHandler);

module.exports = router;
