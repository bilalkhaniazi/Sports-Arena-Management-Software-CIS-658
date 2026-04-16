const express = require("express");

const { db } = require("../config/db");
const env = require("../config/env");
const { hasTable } = require("../utils/schema");
const { formatApiError } = require("../utils/formatApiError");
const {
  listCourtAddOnsFromFirestore,
  createCourtAddOnInFirestore,
  updateCourtAddOnInFirestore,
  deleteCourtAddOnInFirestore,
} = require("../services/firestore/operations");

const router = express.Router();

const courtExists = async (courtId) => {
  const [rows] = await db.query("SELECT id FROM courts WHERE id = ? LIMIT 1", [
    courtId,
  ]);
  return rows.length > 0;
};

const listAddOnsHandler = async (req, res) => {
  try {
    const courtId = parseInt(req.params.courtId, 10);
    if (isNaN(courtId) || courtId <= 0) {
      return res.status(400).json({ error: "Invalid court id." });
    }

    if (env.features.useFirebaseOperations) {
      const includeInactive =
        req.query.include_inactive === "1" || req.query.include_inactive === "true";
      const addOns = await listCourtAddOnsFromFirestore(courtId, includeInactive);
      return res.json({ addOns, source: "firestore" });
    }

    if (!(await hasTable(db, "court_add_ons"))) {
      return res.json({ addOns: [], source: "no_table" });
    }

    const includeInactive =
      req.query.include_inactive === "1" || req.query.include_inactive === "true";

    const where = includeInactive
      ? "court_id = ?"
      : "court_id = ? AND is_active = 1";

    const [rows] = await db.query(
      `SELECT id, court_id, label, price, sort_order, is_active, created_at
       FROM court_add_ons
       WHERE ${where}
       ORDER BY sort_order ASC, id ASC`,
      [courtId],
    );

    return res.json({ addOns: rows, source: "db" });
  } catch (error) {
    console.error("listAddOnsHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const createAddOnHandler = async (req, res) => {
  try {
    const courtId = parseInt(req.params.courtId, 10);
    if (isNaN(courtId) || courtId <= 0) {
      return res.status(400).json({ error: "Invalid court id." });
    }

    if (env.features.useFirebaseOperations) {
      const { label, price, sort_order, is_active } = req.body;
      const trimmed = typeof label === "string" ? label.trim() : "";
      if (!trimmed) {
        return res.status(400).json({ error: "label is required." });
      }
      const priceNum = price === null || price === undefined || price === "" ? 0 : Number(price);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: "price must be a non-negative number." });
      }
      const sortNum =
        sort_order === undefined || sort_order === null || sort_order === ""
          ? 0
          : parseInt(sort_order, 10);
      const active =
        is_active === undefined || is_active === null
          ? true
          : is_active === true || is_active === 1 || is_active === "1";
      const addOn = await createCourtAddOnInFirestore(courtId, {
        label: trimmed,
        price: priceNum,
        sort_order: Number.isNaN(sortNum) ? 0 : sortNum,
        is_active: active,
      });
      return res.status(201).json({ addOn });
    }

    if (!(await courtExists(courtId))) {
      return res.status(404).json({ error: "Court not found." });
    }

    const { label, price, sort_order, is_active } = req.body;
    const trimmed = typeof label === "string" ? label.trim() : "";
    if (!trimmed) {
      return res.status(400).json({ error: "label is required." });
    }

    const priceNum =
      price === null || price === undefined || price === ""
        ? 0
        : Number(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      return res.status(400).json({ error: "price must be a non-negative number." });
    }

    const sortNum =
      sort_order === undefined || sort_order === null || sort_order === ""
        ? 0
        : parseInt(sort_order, 10);
    const active =
      is_active === undefined || is_active === null
        ? 1
        : is_active === true || is_active === 1 || is_active === "1"
          ? 1
          : 0;

    const [result] = await db.query(
      `INSERT INTO court_add_ons (court_id, label, price, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [courtId, trimmed, priceNum, Number.isNaN(sortNum) ? 0 : sortNum, active],
    );

    const [inserted] = await db.query(
      `SELECT id, court_id, label, price, sort_order, is_active, created_at
       FROM court_add_ons WHERE id = ?`,
      [result.insertId],
    );

    return res.status(201).json({ addOn: inserted[0] });
  } catch (error) {
    console.error("createAddOnHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const updateAddOnHandler = async (req, res) => {
  try {
    const courtId = parseInt(req.params.courtId, 10);
    const id = parseInt(req.params.addOnId, 10);
    if (isNaN(courtId) || courtId <= 0 || isNaN(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid court or add-on id." });
    }

    if (env.features.useFirebaseOperations) {
      const { label, price, sort_order, is_active } = req.body;
      const patch = {};
      if (label !== undefined) {
        const trimmed = typeof label === "string" ? label.trim() : "";
        if (!trimmed) {
          return res.status(400).json({ error: "label cannot be empty." });
        }
        patch.label = trimmed;
      }
      if (price !== undefined) {
        const priceNum = Number(price);
        if (Number.isNaN(priceNum) || priceNum < 0) {
          return res.status(400).json({ error: "price must be a non-negative number." });
        }
        patch.price = priceNum;
      }
      if (sort_order !== undefined) {
        const sortNum = parseInt(sort_order, 10);
        patch.sort_order = Number.isNaN(sortNum) ? 0 : sortNum;
      }
      if (is_active !== undefined) {
        patch.is_active = is_active === true || is_active === 1 || is_active === "1" ? 1 : 0;
      }
      if (Object.keys(patch).length === 0) {
        return res.status(400).json({ error: "No fields to update." });
      }
      const updated = await updateCourtAddOnInFirestore(id, patch);
      if (!updated || Number(updated.court_id) !== Number(courtId)) {
        return res.status(404).json({ error: "Add-on not found for this court." });
      }
      return res.json({ addOn: updated });
    }

    const [existing] = await db.query(
      "SELECT id FROM court_add_ons WHERE id = ? AND court_id = ?",
      [id, courtId],
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: "Add-on not found for this court." });
    }

    const { label, price, sort_order, is_active } = req.body;
    const updates = [];
    const values = [];

    if (label !== undefined) {
      const trimmed = typeof label === "string" ? label.trim() : "";
      if (!trimmed) {
        return res.status(400).json({ error: "label cannot be empty." });
      }
      updates.push("label = ?");
      values.push(trimmed);
    }
    if (price !== undefined) {
      const priceNum = Number(price);
      if (Number.isNaN(priceNum) || priceNum < 0) {
        return res.status(400).json({ error: "price must be a non-negative number." });
      }
      updates.push("price = ?");
      values.push(priceNum);
    }
    if (sort_order !== undefined) {
      const sortNum = parseInt(sort_order, 10);
      updates.push("sort_order = ?");
      values.push(Number.isNaN(sortNum) ? 0 : sortNum);
    }
    if (is_active !== undefined) {
      const active =
        is_active === true || is_active === 1 || is_active === "1" ? 1 : 0;
      updates.push("is_active = ?");
      values.push(active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update." });
    }

    values.push(id, courtId);
    await db.query(
      `UPDATE court_add_ons SET ${updates.join(", ")} WHERE id = ? AND court_id = ?`,
      values,
    );

    const [rows] = await db.query(
      `SELECT id, court_id, label, price, sort_order, is_active, created_at
       FROM court_add_ons WHERE id = ?`,
      [id],
    );

    return res.json({ addOn: rows[0] });
  } catch (error) {
    console.error("updateAddOnHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const deleteAddOnHandler = async (req, res) => {
  try {
    const courtId = parseInt(req.params.courtId, 10);
    const id = parseInt(req.params.addOnId, 10);
    if (isNaN(courtId) || courtId <= 0 || isNaN(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid court or add-on id." });
    }

    if (env.features.useFirebaseOperations) {
      const removed = await deleteCourtAddOnInFirestore(id);
      if (!removed) {
        return res.status(404).json({ error: "Add-on not found." });
      }
      return res.json({ message: "Add-on removed." });
    }

    const [result] = await db.query(
      "DELETE FROM court_add_ons WHERE id = ? AND court_id = ?",
      [id, courtId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Add-on not found." });
    }

    return res.json({ message: "Add-on removed." });
  } catch (error) {
    console.error("deleteAddOnHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

router.get("/courts/:courtId/add-ons", listAddOnsHandler);
router.get("/operator/courts/:courtId/add-ons", listAddOnsHandler);
router.get("/admin/courts/:courtId/add-ons", listAddOnsHandler);

router.post("/operator/courts/:courtId/add-ons", createAddOnHandler);
router.post("/admin/courts/:courtId/add-ons", createAddOnHandler);

router.put("/operator/courts/:courtId/add-ons/:addOnId", updateAddOnHandler);
router.put("/admin/courts/:courtId/add-ons/:addOnId", updateAddOnHandler);

router.delete("/operator/courts/:courtId/add-ons/:addOnId", deleteAddOnHandler);
router.delete("/admin/courts/:courtId/add-ons/:addOnId", deleteAddOnHandler);

module.exports = router;
