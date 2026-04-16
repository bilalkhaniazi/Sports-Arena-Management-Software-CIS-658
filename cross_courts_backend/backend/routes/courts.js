const express = require("express");

const { db } = require("../config/db");
const { hasColumn, hasTable } = require("../utils/schema");
const { formatApiError } = require("../utils/formatApiError");
const env = require("../config/env");
const {
  normalizeBookingDate,
  findArenaHolidayLabelForCourtOnDate,
} = require("../utils/arenaHolidays");
const {
  listCourtsByCategoryFromFirestore,
  getSlotsFromFirestore,
  upsertCourtSchedule,
  replaceCustomSlots,
  getGeneratedSlotsFromFirestore,
  listCourtsFromFirestore,
  listArenaCourtsFromFirestore,
  createCourtInFirestore,
  updateCourtInFirestore,
  deleteCourtInFirestore,
} = require("../services/firestore/courts");

const router = express.Router();

const getCourtsByCategoryHandler = async (req, res) => {
  try {
    const { cat_id } = req.body;

    if (!cat_id) {
      return res
        .status(400)
        .json({ success: false, error: "cat_id is required." });
    }

    if (env.features.useFirebaseCourts) {
      const courts = await listCourtsByCategoryFromFirestore(cat_id);
      if (courts.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No courts found for the provided cat_id.",
        });
      }
      return res.json({ success: true, courts });
    }

    const [courts] = await db.query("SELECT * FROM courts WHERE cat_id = ?", [
      cat_id,
    ]);

    if (courts.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No courts found for the provided cat_id.",
      });
    }

    return res.json({ success: true, courts });
  } catch (error) {
    console.error("Error fetching courts:", error);
    return res
      .status(500)
      .json({ success: false, error: formatApiError(error) });
  }
};

const slotsHandler = async (req, res) => {
  try {
    let { court_id, date } = req.query;

    court_id = court_id ? parseInt(court_id, 10) : 1;
    date = normalizeBookingDate(
      date ? date : new Date().toISOString().split("T")[0],
    );

    if (env.features.useFirebaseCourts) {
      const payload = await getSlotsFromFirestore(court_id, date);
      return res.json(payload);
    }

    if (isNaN(court_id) || court_id <= 0) {
      return res
        .status(400)
        .json({ error: "Invalid court_id. It must be a positive number." });
    }

    const holidayInfo = await findArenaHolidayLabelForCourtOnDate(db, court_id, date);
    if (holidayInfo) {
      return res.json({
        slots: [],
        holiday: true,
        label: holidayInfo.label,
        message: holidayInfo.label
          ? `Closed: ${holidayInfo.label}`
          : "Closed for arena holiday",
        source: "holiday",
      });
    }

    const [customSlots] = await db.query(
      "SELECT * FROM custom_slots WHERE court_id = ? AND slot_date = ?",
      [court_id, date],
    );

    if (customSlots.length > 0) {
      return res.json({
        slots: customSlots,
        source: "custom",
        message: "Custom slots found.",
      });
    }

    const [defaultSlots] = await db.query(
      "SELECT * FROM default_slots WHERE court_id = ?",
      [court_id],
    );

    if (defaultSlots.length === 0) {
      return res.json({
        slots: [],
        source: "none",
        message:
          "No default slot template for this court. Configure slots in Booking Settings or add default_slots rows.",
      });
    }

    return res.json({
      slots: defaultSlots,
      source: "default",
      message: "Returning default slots.",
    });
  } catch (error) {
    console.error("Error fetching slots:", error);
    return res
      .status(500)
      .json({ error: formatApiError(error) });
  }
};

const setCourtScheduleHandler = async (req, res) => {
  try {
    let { court_id = 1, date, default_slot, custom_slots } = req.body;

    date = date
      ? new Date(date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];
    default_slot = Boolean(default_slot);

    if (env.features.useFirebaseCourts) {
      await upsertCourtSchedule(court_id, date, default_slot);
      if (!default_slot && custom_slots && custom_slots.length > 0) {
        await replaceCustomSlots(court_id, date, custom_slots);
      }
      return res.json({
        message: "Court schedule and custom slots updated successfully.",
      });
    }

    await db.query(
      `
        INSERT INTO court_schedule (court_id, slot_date, default_slot)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE default_slot = VALUES(default_slot)
      `,
      [court_id, date, default_slot],
    );

    if (!default_slot && custom_slots && custom_slots.length > 0) {
      await db.query(
        `DELETE FROM custom_slots WHERE court_id = ? AND slot_date = ?`,
        [court_id, date],
      );

      const slotValues = custom_slots.map((slot) => [
        court_id,
        date,
        slot.start_time,
        slot.end_time,
        "Yes",
      ]);

      await db.query(
        `
          INSERT INTO custom_slots (court_id, slot_date, start_time, end_time, modified)
          VALUES ?
        `,
        [slotValues],
      );
    }

    return res.json({
      message: "Court schedule and custom slots updated successfully.",
    });
  } catch (error) {
    console.error("Error updating court schedule:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const getGeneratedSlotsHandler = async (req, res) => {
  try {
    let { court_id = 1, date } = req.query;

    date = date
      ? new Date(date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    if (env.features.useFirebaseCourts) {
      const payload = await getGeneratedSlotsFromFirestore(court_id, date);
      return res.json(payload);
    }

    const [schedule] = await db.query(
      `SELECT default_slot FROM court_schedule WHERE court_id = ? AND slot_date = ?`,
      [court_id, date],
    );

    if (schedule.length > 0 && schedule[0].default_slot === 0) {
      const [customSlots] = await db.query(
        `
          SELECT start_time, end_time FROM custom_slots
          WHERE court_id = ? AND slot_date = ?
        `,
        [court_id, date],
      );

      return res.json({
        court_id,
        date,
        slots: customSlots,
        source: "custom",
      });
    }

    const defaultSlots = [];
    for (let hour = 0; hour < 24; hour++) {
      defaultSlots.push({
        start_time: `${String(hour).padStart(2, "0")}:00:00`,
        end_time: `${String(hour + 1).padStart(2, "0")}:00:00`,
      });
    }

    return res.json({
      court_id,
      date,
      slots: defaultSlots,
      source: "default",
    });
  } catch (error) {
    console.error("Error fetching slots:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const resetToDefaultHandler = async (req, res) => {
  try {
    let { court_id, date } = req.body;

    if (!court_id || !date) {
      return res.status(400).json({ error: "court_id and date are required." });
    }

    date = new Date(date).toISOString().split("T")[0];

    if (env.features.useFirebaseCourts) {
      await upsertCourtSchedule(court_id, date, true);
      await replaceCustomSlots(court_id, date, []);
      return res.json({ message: "Court slots reset to default." });
    }

    await db.query(
      "INSERT INTO court_schedule (court_id, slot_date, default_slot) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE default_slot = 1",
      [court_id, date],
    );

    await db.query("DELETE FROM custom_slots WHERE court_id = ? AND slot_date = ?", [
      court_id,
      date,
    ]);

    return res.json({ message: "Court slots reset to default." });
  } catch (error) {
    console.error("Error resetting slots:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const courtsListHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseCourts) {
      const courts = await listCourtsFromFirestore();
      return res.json(courts);
    }

    const hasSoftDelete = await hasColumn(db, "courts", "is_deleted");
    const hasArenaId = await hasColumn(db, "courts", "arena_id");
    const base = hasSoftDelete
      ? "SELECT id, name FROM courts WHERE is_deleted = 0"
      : "SELECT id, name FROM courts";
    const sql = hasArenaId
      ? base.replace("SELECT id, name", "SELECT id, name, arena_id")
      : base;
    const [courts] = await db.query(sql);
    return res.json(courts);
  } catch (error) {
    console.error("Error fetching courts:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const operatorArenaCourtsHandler = async (req, res) => {
  try {
    const { arenaId } = req.params;

    if (env.features.useFirebaseCourts) {
      const courts = await listArenaCourtsFromFirestore(arenaId);
      return res.json({ courts });
    }

    const hasArenaId = await hasColumn(db, "courts", "arena_id");
    const hasSportId = await hasColumn(db, "courts", "sport_id");
    const hasPrice = await hasColumn(db, "courts", "price");
    const hasCashPrice = await hasColumn(db, "courts", "cash_price");
    const hasSoftDelete = await hasColumn(db, "courts", "is_deleted");
    const sportsTableExists = await hasTable(db, "sports");

    if (!hasArenaId) {
      return res.status(400).json({ error: "arena_id is required in courts schema" });
    }

    const [courts] = await db.query(
      `
        SELECT
          c.id,
          c.name,
          c.cat_id,
          ${hasSportId ? "c.sport_id" : "NULL"} AS sport_id,
          ${sportsTableExists && hasSportId ? "s.name" : "NULL"} AS sport_name,
          ${hasPrice ? "c.price" : "0"} AS price,
          ${hasCashPrice ? "c.cash_price" : "0"} AS cash_price,
          ${hasSoftDelete ? "c.is_deleted" : "0"} AS is_deleted
        FROM courts c
        ${sportsTableExists && hasSportId ? "LEFT JOIN sports s ON s.id = c.sport_id" : ""}
        WHERE c.arena_id = ?
        ORDER BY c.name ASC
      `,
      [arenaId],
    );

    return res.json({ courts });
  } catch (error) {
    console.error("Error fetching operator arena courts:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const saveOperatorCourtHandler = async (req, res) => {
  try {
    const { arenaId } = req.params;
    const { name, cat_id, sport_id, price, cash_price } = req.body;

    if (env.features.useFirebaseCourts) {
      if (!name || !cat_id) {
        return res.status(400).json({ error: "name and cat_id are required" });
      }
      if (req.method === "POST") {
        await createCourtInFirestore({ arenaId, name, cat_id, sport_id, price, cash_price });
        return res.status(201).json({ message: "Court created successfully" });
      }
      const { courtId } = req.params;
      await updateCourtInFirestore({ courtId, name, cat_id, sport_id, price, cash_price });
      return res.json({ message: "Court updated successfully" });
    }

    const hasArenaId = await hasColumn(db, "courts", "arena_id");
    const hasSportId = await hasColumn(db, "courts", "sport_id");
    const hasPrice = await hasColumn(db, "courts", "price");
    const hasCashPrice = await hasColumn(db, "courts", "cash_price");
    const hasSoftDelete = await hasColumn(db, "courts", "is_deleted");

    if (!name || !cat_id) {
      return res.status(400).json({ error: "name and cat_id are required" });
    }

    if (req.method === "POST") {
      const columns = ["name", "cat_id"];
      const values = [name, cat_id];

      if (hasArenaId) {
        columns.push("arena_id");
        values.push(arenaId);
      }
      if (hasSportId) {
        columns.push("sport_id");
        values.push(sport_id || null);
      }
      if (hasPrice) {
        columns.push("price");
        values.push(price || 0);
      }
      if (hasCashPrice) {
        columns.push("cash_price");
        values.push(cash_price || 0);
      }
      if (hasSoftDelete) {
        columns.push("is_deleted");
        values.push(0);
      }

      await db.query(
        `INSERT INTO courts (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
        values,
      );

      return res.status(201).json({ message: "Court created successfully" });
    }

    const { courtId } = req.params;
    const updates = ["name = ?", "cat_id = ?"];
    const values = [name, cat_id];

    if (hasSportId) {
      updates.push("sport_id = ?");
      values.push(sport_id || null);
    }
    if (hasPrice) {
      updates.push("price = ?");
      values.push(price || 0);
    }
    if (hasCashPrice) {
      updates.push("cash_price = ?");
      values.push(cash_price || 0);
    }

    values.push(courtId);

    await db.query(`UPDATE courts SET ${updates.join(", ")} WHERE id = ?`, values);
    return res.json({ message: "Court updated successfully" });
  } catch (error) {
    console.error("Error saving court:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const deleteOperatorCourtHandler = async (req, res) => {
  try {
    const { courtId } = req.params;

    if (env.features.useFirebaseCourts) {
      await deleteCourtInFirestore(courtId);
      return res.json({
        message:
          "Court removed from active management. Historical bookings and revenue will still remain in reports.",
      });
    }

    const hasSoftDelete = await hasColumn(db, "courts", "is_deleted");

    if (hasSoftDelete) {
      await db.query(
        "UPDATE courts SET is_deleted = 1, deleted_at = NOW() WHERE id = ?",
        [courtId],
      );
    } else {
      await db.query("DELETE FROM courts WHERE id = ?", [courtId]);
    }

    return res.json({
      message:
        "Court removed from active management. Historical bookings and revenue will still remain in reports.",
    });
  } catch (error) {
    console.error("Error deleting court:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

router.post("/get-courts", getCourtsByCategoryHandler);
router.post("/operator/courts/by-category", getCourtsByCategoryHandler);

router.get("/slots", slotsHandler);
router.get("/operator/slots", slotsHandler);

router.post("/set-court-schedule", setCourtScheduleHandler);
router.post("/operator/courts/schedule", setCourtScheduleHandler);

router.get("/get-slots", getGeneratedSlotsHandler);
router.get("/operator/courts/generated-slots", getGeneratedSlotsHandler);

router.post("/reset-to-default", resetToDefaultHandler);
router.post("/operator/courts/reset-to-default", resetToDefaultHandler);

router.get("/courts", courtsListHandler);
router.get("/operator/courts", courtsListHandler);
router.get("/operator/arenas/:arenaId/courts", operatorArenaCourtsHandler);
router.post("/operator/arenas/:arenaId/courts", saveOperatorCourtHandler);
router.put("/operator/arenas/:arenaId/courts/:courtId", saveOperatorCourtHandler);
router.delete("/operator/arenas/:arenaId/courts/:courtId", deleteOperatorCourtHandler);
router.get("/admin/courts", courtsListHandler);
router.get("/admin/arenas/:arenaId/courts", operatorArenaCourtsHandler);
router.post("/admin/arenas/:arenaId/courts", saveOperatorCourtHandler);
router.put("/admin/arenas/:arenaId/courts/:courtId", saveOperatorCourtHandler);
router.delete("/admin/arenas/:arenaId/courts/:courtId", deleteOperatorCourtHandler);

module.exports = router;
