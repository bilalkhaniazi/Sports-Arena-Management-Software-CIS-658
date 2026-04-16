const { db } = require("../config/db");
const { hasColumn, hasTable } = require("./schema");

/** Use calendar YYYY-MM-DD without UTC shifting (safe for <input type="date">). */
function normalizeBookingDate(dateInput) {
  if (dateInput == null || dateInput === "") {
    return new Date().toISOString().split("T")[0];
  }
  const s = String(dateInput).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    return s.slice(0, 10);
  }
  return d.toISOString().split("T")[0];
}

/**
 * If this court's arena has a holiday on that calendar date, returns { label }.
 * Otherwise null. label may be null when the DB row has no label.
 */
async function findArenaHolidayLabelForCourtOnDate(dbConn, courtId, dateInput) {
  const date = normalizeBookingDate(dateInput);
  try {
    if (!(await hasColumn(dbConn, "courts", "arena_id"))) {
      return null;
    }
    if (!(await hasTable(dbConn, "arena_holidays"))) {
      return null;
    }
    const [courtArena] = await dbConn.query(
      "SELECT arena_id FROM courts WHERE id = ? LIMIT 1",
      [courtId],
    );
    const arenaId = courtArena[0]?.arena_id;
    if (!arenaId) {
      return null;
    }
    const [holRows] = await dbConn.query(
      `SELECT label FROM arena_holidays
       WHERE arena_id = ? AND holiday_date = ?
       LIMIT 1`,
      [arenaId, date],
    );
    if (holRows.length === 0) {
      return null;
    }
    return { label: holRows[0].label };
  } catch (e) {
    console.error("findArenaHolidayLabelForCourtOnDate:", e);
    return null;
  }
}

module.exports = {
  normalizeBookingDate,
  findArenaHolidayLabelForCourtOnDate,
};
