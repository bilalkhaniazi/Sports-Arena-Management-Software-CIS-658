const express = require("express");
const { db } = require("../config/db");
const env = require("../config/env");
const { hasColumn, hasUsersRoleColumn } = require("../utils/schema");
const { formatApiError } = require("../utils/formatApiError");
const { listCustomersFromFirestore } = require("../services/firestore/operations");

const router = express.Router();

/** For operator booking: list users (customers) to auto-fill name/email/phone. */
const listCustomersForBookingHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseOperations) {
      const users = await listCustomersFromFirestore();
      return res.json({ users });
    }

    const hasPhone = await hasColumn(db, "users", "phone");
    const hasRole = await hasUsersRoleColumn(db);
    const fields = ["id", "name", "email"];
    if (hasPhone) fields.push("phone");

    let sql = `SELECT ${fields.join(", ")} FROM users`;
    if (hasRole) {
      sql += " WHERE role = 'customer'";
    }
    sql += " ORDER BY name ASC LIMIT 500";

    const [users] = await db.query(sql);
    return res.json({ users });
  } catch (error) {
    console.error("listCustomersForBookingHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

router.get("/operator/customers", listCustomersForBookingHandler);
router.get("/admin/customers", listCustomersForBookingHandler);

module.exports = router;
