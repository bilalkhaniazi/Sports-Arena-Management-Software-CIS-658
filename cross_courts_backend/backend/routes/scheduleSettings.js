const express = require("express");
const { db } = require("../config/db");
const env = require("../config/env");
const { hasColumn, hasTable } = require("../utils/schema");
const { formatApiError } = require("../utils/formatApiError");
const {
  getDefaultSlotTemplateFromFirestore,
  getSlotsRangeFromFirestore,
  bulkApplySlotsFromFirestore,
  updateCustomSlotInFirestore,
  deleteCustomSlotInFirestore,
  resetDayToDefaultInFirestore,
} = require("../services/firestore/courts");

const router = express.Router();

function enumerateDateRange(fromStr, toStr) {
  const out = [];
  const [y1, m1, d1] = fromStr.split("-").map(Number);
  const [y2, m2, d2] = toStr.split("-").map(Number);
  let cur = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  while (cur <= end) {
    const y = cur.getFullYear();
    const mo = String(cur.getMonth() + 1).padStart(2, "0");
    const da = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${mo}-${da}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function normalizeTime(t) {
  if (t == null || t === "") return null;
  const s = String(t).trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) {
    const parts = s.split(":");
    const hh = String(parts[0]).padStart(2, "0");
    const mm = String(parts[1]).padStart(2, "0");
    const ss = parts[2] != null ? String(parts[2]).padStart(2, "0") : "00";
    return `${hh}:${mm}:${ss}`;
  }
  return s;
}

async function getCourtArenaId(courtId) {
  if (!(await hasColumn(db, "courts", "arena_id"))) return null;
  const [rows] = await db.query("SELECT arena_id FROM courts WHERE id = ?", [
    courtId,
  ]);
  return rows[0]?.arena_id ?? null;
}

async function arenaHolidaysEnabled() {
  return hasTable(db, "arena_holidays");
}

/** Default slot template rows for a court */
const defaultSlotTemplateHandler = async (req, res) => {
  try {
    const courtId = parseInt(req.params.courtId, 10);
    if (Number.isNaN(courtId) || courtId <= 0) {
      return res.status(400).json({ error: "Invalid court id" });
    }
    if (env.features.useFirebaseCourts) {
      const template = await getDefaultSlotTemplateFromFirestore(courtId);
      return res.json({ template });
    }

    const [rows] = await db.query(
      "SELECT id, start_time, end_time FROM default_slots WHERE court_id = ? ORDER BY start_time ASC",
      [courtId],
    );
    return res.json({ template: rows });
  } catch (error) {
    console.error("defaultSlotTemplateHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

/** Custom + default-mode dates + holidays in range */
const slotsRangeHandler = async (req, res) => {
  try {
    const courtId = parseInt(req.params.courtId, 10);
    let { from, to } = req.query;
    if (Number.isNaN(courtId) || courtId <= 0) {
      return res.status(400).json({ error: "Invalid court id" });
    }
    if (!from || !to) {
      return res.status(400).json({ error: "from and to (YYYY-MM-DD) are required" });
    }
    from = new Date(from).toISOString().split("T")[0];
    to = new Date(to).toISOString().split("T")[0];

    if (env.features.useFirebaseCourts) {
      const payload = await getSlotsRangeFromFirestore(courtId, from, to);
      return res.json(payload);
    }

    const [customSlots] = await db.query(
      `SELECT id, court_id, slot_date, start_time, end_time, modified
       FROM custom_slots
       WHERE court_id = ? AND slot_date >= ? AND slot_date <= ?
       ORDER BY slot_date ASC, start_time ASC`,
      [courtId, from, to],
    );

    const [defaultRows] = await db.query(
      `SELECT slot_date FROM court_schedule
       WHERE court_id = ? AND default_slot = 1 AND slot_date >= ? AND slot_date <= ?
       ORDER BY slot_date ASC`,
      [courtId, from, to],
    );
    const defaultDates = defaultRows.map((r) =>
      r.slot_date instanceof Date
        ? r.slot_date.toISOString().split("T")[0]
        : String(r.slot_date).slice(0, 10),
    );

    let holidays = [];
    if (await arenaHolidaysEnabled()) {
      const arenaId = await getCourtArenaId(courtId);
      if (arenaId) {
        const [h] = await db.query(
          `SELECT id, arena_id, holiday_date, label FROM arena_holidays
           WHERE arena_id = ? AND holiday_date >= ? AND holiday_date <= ?
           ORDER BY holiday_date ASC`,
          [arenaId, from, to],
        );
        holidays = h.map((row) => ({
          ...row,
          holiday_date:
            row.holiday_date instanceof Date
              ? row.holiday_date.toISOString().split("T")[0]
              : String(row.holiday_date).slice(0, 10),
        }));
      }
    }

    const holidayDateSet = new Set(holidays.map((x) => x.holiday_date));
    const customSlotsEnriched = customSlots.map((row) => {
      const slotDate =
        row.slot_date instanceof Date
          ? row.slot_date.toISOString().split("T")[0]
          : String(row.slot_date).slice(0, 10);
      return {
        ...row,
        slot_date: slotDate,
        is_arena_holiday: holidayDateSet.has(slotDate),
      };
    });

    return res.json({
      customSlots: customSlotsEnriched,
      defaultDates,
      holidays,
    });
  } catch (error) {
    console.error("slotsRangeHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const bulkApplySlotsHandler = async (req, res) => {
  let connection;
  try {
    const courtId = parseInt(req.params.courtId, 10);
    if (Number.isNaN(courtId) || courtId <= 0) {
      return res.status(400).json({ error: "Invalid court id" });
    }

    let { from_date, to_date, slots: slotList, skip_holidays } = req.body;
    if (!from_date || !to_date || !Array.isArray(slotList) || slotList.length === 0) {
      return res.status(400).json({
        error:
          "from_date, to_date, and non-empty slots [{ start_time, end_time }, ...] are required",
      });
    }

    if (env.features.useFirebaseCourts) {
      const normalized = slotList.map((s) => ({
        start_time: normalizeTime(s.start_time),
        end_time: normalizeTime(s.end_time),
      }));
      if (normalized.some((s) => !s.start_time || !s.end_time)) {
        return res.status(400).json({ error: "Each slot needs start_time and end_time" });
      }
      const result = await bulkApplySlotsFromFirestore(
        courtId,
        from_date,
        to_date,
        normalized,
        Boolean(skip_holidays),
      );
      return res.json({
        message: `Applied ${result.patterns} slot pattern(s) on ${result.appliedDays} day(s)${
          result.skippedDays ? ` (${result.skippedDays} holiday day(s) skipped)` : ""
        }.`,
        daysSkippedForHolidays: result.skippedDays,
        daysUpdated: result.appliedDays,
      });
    }

    from_date = new Date(from_date).toISOString().split("T")[0];
    to_date = new Date(to_date).toISOString().split("T")[0];

    if (from_date > to_date) {
      return res.status(400).json({ error: "from_date must be on or before to_date" });
    }

    const normalized = slotList.map((s) => ({
      start_time: normalizeTime(s.start_time),
      end_time: normalizeTime(s.end_time),
    }));

    if (normalized.some((s) => !s.start_time || !s.end_time)) {
      return res.status(400).json({ error: "Each slot needs start_time and end_time" });
    }

    const dates = enumerateDateRange(from_date, to_date);
    if (dates.length > 366) {
      return res.status(400).json({ error: "Date range cannot exceed 366 days" });
    }

    const holidaySet = new Set();
    if (skip_holidays && (await arenaHolidaysEnabled())) {
      const arenaId = await getCourtArenaId(courtId);
      if (arenaId) {
        const [hs] = await db.query(
          `SELECT holiday_date FROM arena_holidays
           WHERE arena_id = ? AND holiday_date >= ? AND holiday_date <= ?`,
          [arenaId, from_date, to_date],
        );
        for (const row of hs) {
          const d =
            row.holiday_date instanceof Date
              ? row.holiday_date.toISOString().split("T")[0]
              : String(row.holiday_date).slice(0, 10);
          holidaySet.add(d);
        }
      }
    }

    const valuesToInsert = [];
    let skippedDays = 0;
    connection = await db.getConnection();
    await connection.beginTransaction();

    for (const date of dates) {
      if (holidaySet.has(date)) {
        skippedDays += 1;
        continue;
      }

      await connection.query(
        `INSERT INTO court_schedule (court_id, slot_date, default_slot)
         VALUES (?, ?, 0)
         ON DUPLICATE KEY UPDATE default_slot = 0`,
        [courtId, date],
      );

      await connection.query(
        `DELETE FROM custom_slots WHERE court_id = ? AND slot_date = ?`,
        [courtId, date],
      );

      for (const slot of normalized) {
        valuesToInsert.push([
          courtId,
          date,
          slot.start_time,
          slot.end_time,
          "Yes",
        ]);
      }
    }

    if (valuesToInsert.length > 0) {
      await connection.query(
        `INSERT INTO custom_slots (court_id, slot_date, start_time, end_time, modified)
         VALUES ?`,
        [valuesToInsert],
      );
    }

    await connection.commit();
    const appliedDays = dates.length - skippedDays;
    return res.json({
      message: `Applied ${normalized.length} slot pattern(s) on ${appliedDays} day(s)${
        skippedDays ? ` (${skippedDays} holiday day(s) skipped)` : ""
      }.`,
      daysSkippedForHolidays: skippedDays,
      daysUpdated: appliedDays,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("bulkApplySlotsHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  } finally {
    if (connection) connection.release();
  }
};

const updateCustomSlotHandler = async (req, res) => {
  try {
    const slotId = parseInt(req.params.slotId, 10);
    if (Number.isNaN(slotId)) {
      return res.status(400).json({ error: "Invalid slot id" });
    }
    let { start_time, end_time } = req.body;
    const st = normalizeTime(start_time);
    const et = normalizeTime(end_time);
    if (!st || !et) {
      return res.status(400).json({ error: "start_time and end_time required" });
    }

    if (env.features.useFirebaseCourts) {
      const changed = await updateCustomSlotInFirestore(slotId, st, et);
      if (!changed) {
        return res.status(404).json({ error: "Slot not found" });
      }
      return res.json({ message: "Slot updated" });
    }

    const [rows] = await db.query(
      "SELECT court_id, slot_date FROM custom_slots WHERE id = ?",
      [slotId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Slot not found" });
    }

    await db.query(
      "UPDATE custom_slots SET start_time = ?, end_time = ? WHERE id = ?",
      [st, et, slotId],
    );

    await db.query(
      `INSERT INTO court_schedule (court_id, slot_date, default_slot)
       VALUES (?, ?, 0)
       ON DUPLICATE KEY UPDATE default_slot = 0`,
      [rows[0].court_id, rows[0].slot_date, 0],
    );

    return res.json({ message: "Slot updated" });
  } catch (error) {
    console.error("updateCustomSlotHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const deleteCustomSlotHandler = async (req, res) => {
  try {
    const slotId = parseInt(req.params.slotId, 10);
    if (Number.isNaN(slotId)) {
      return res.status(400).json({ error: "Invalid slot id" });
    }

    if (env.features.useFirebaseCourts) {
      const removed = await deleteCustomSlotInFirestore(slotId);
      if (!removed) {
        return res.status(404).json({ error: "Slot not found" });
      }
      return res.json({ message: "Slot deleted" });
    }

    const [rows] = await db.query(
      "SELECT court_id, slot_date FROM custom_slots WHERE id = ?",
      [slotId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Slot not found" });
    }

    const { court_id: courtId, slot_date: slotDate } = rows[0];
    const dateStr =
      slotDate instanceof Date
        ? slotDate.toISOString().split("T")[0]
        : String(slotDate).slice(0, 10);

    await db.query("DELETE FROM custom_slots WHERE id = ?", [slotId]);

    const [remaining] = await db.query(
      "SELECT COUNT(*) AS c FROM custom_slots WHERE court_id = ? AND slot_date = ?",
      [courtId, dateStr],
    );
    if (remaining[0].c === 0) {
      await db.query(
        `INSERT INTO court_schedule (court_id, slot_date, default_slot)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE default_slot = 1`,
        [courtId, dateStr],
      );
    }

    return res.json({ message: "Slot deleted" });
  } catch (error) {
    console.error("deleteCustomSlotHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const resetDayToDefaultHandler = async (req, res) => {
  try {
    const courtId = parseInt(req.params.courtId, 10);
    let { date } = req.body;
    if (Number.isNaN(courtId) || !date) {
      return res.status(400).json({ error: "court id and date required" });
    }
    date = new Date(date).toISOString().split("T")[0];

    if (env.features.useFirebaseCourts) {
      await resetDayToDefaultInFirestore(courtId, date);
      return res.json({ message: "That day now uses the default slot template." });
    }

    await db.query(
      `INSERT INTO court_schedule (court_id, slot_date, default_slot)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE default_slot = 1`,
      [courtId, date],
    );
    await db.query(
      "DELETE FROM custom_slots WHERE court_id = ? AND slot_date = ?",
      [courtId, date],
    );

    return res.json({ message: "That day now uses the default slot template." });
  } catch (error) {
    console.error("resetDayToDefaultHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

router.get("/operator/courts/:courtId/default-slot-template", defaultSlotTemplateHandler);
router.get("/admin/courts/:courtId/default-slot-template", defaultSlotTemplateHandler);

router.get("/operator/courts/:courtId/slots-range", slotsRangeHandler);
router.get("/admin/courts/:courtId/slots-range", slotsRangeHandler);

router.post("/operator/courts/:courtId/slots/bulk-apply", bulkApplySlotsHandler);
router.post("/admin/courts/:courtId/slots/bulk-apply", bulkApplySlotsHandler);

router.put("/operator/custom-slots/:slotId", updateCustomSlotHandler);
router.put("/admin/custom-slots/:slotId", updateCustomSlotHandler);

router.delete("/operator/custom-slots/:slotId", deleteCustomSlotHandler);
router.delete("/admin/custom-slots/:slotId", deleteCustomSlotHandler);

router.post("/operator/courts/:courtId/slots/reset-day", resetDayToDefaultHandler);
router.post("/admin/courts/:courtId/slots/reset-day", resetDayToDefaultHandler);

module.exports = router;
