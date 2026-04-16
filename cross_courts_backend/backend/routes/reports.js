const express = require("express");

const { db } = require("../config/db");
const env = require("../config/env");
const { formatApiError } = require("../utils/formatApiError");
const { hasColumn, hasTable } = require("../utils/schema");
const {
  getSummaryFromFirestore,
  getUniqueBookingCustomersFromFirestore,
  getRecentBookingsFromFirestore,
  getBookingsPerMonthFromFirestore,
} = require("../services/firestore/reports");

const router = express.Router();

/** Same “line total” as booking history / ProductTable: total_price, else online + add-on. */
async function bookingLineTotalExpr() {
  const hasTotal = await hasColumn(db, "bookings", "total_price");
  return hasTotal
    ? "COALESCE(b.total_price, b.online_price + IFNULL(b.add_on_price, 0))"
    : "(b.online_price + IFNULL(b.add_on_price, 0))";
}

/**
 * Optional filters: arena_id, court_id (query params).
 * Joins bookings b LEFT JOIN courts c ON c.id = b.court_id
 */
async function bookingFilterClause(req) {
  const arenaRaw = req.query.arena_id;
  const courtRaw = req.query.court_id;

  const bookingHasArenaId = await hasColumn(db, "bookings", "arena_id");
  const arenaExpr = bookingHasArenaId
    ? "COALESCE(c.arena_id, b.arena_id)"
    : "c.arena_id";

  const conditions = [];
  const params = [];

  if (courtRaw != null && String(courtRaw).trim() !== "" && String(courtRaw) !== "all") {
    const cid = parseInt(String(courtRaw), 10);
    if (!isNaN(cid) && cid > 0) {
      conditions.push("b.court_id = ?");
      params.push(cid);
    }
  }

  if (arenaRaw != null && String(arenaRaw).trim() !== "" && String(arenaRaw) !== "all") {
    const aid = parseInt(String(arenaRaw), 10);
    if (!isNaN(aid) && aid > 0) {
      conditions.push(`${arenaExpr} = ?`);
      params.push(aid);
    }
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params, joinSql: "FROM bookings b LEFT JOIN courts c ON c.id = b.court_id" };
}

const totalPriceHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseBookingReads) {
      const summary = await getSummaryFromFirestore(req.query || {});
      return res.json({ totalPrice: Number(summary.totalPrice || 0) });
    }

    const line = await bookingLineTotalExpr();
    const { where, params, joinSql } = await bookingFilterClause(req);

    const [rows] = await db.query(
      `SELECT COALESCE(SUM((${line})), 0) AS totalPrice ${joinSql} ${where}`,
      params,
    );

    const n = rows[0]?.totalPrice;
    return res.json({ totalPrice: n != null ? Number(n) : 0 });
  } catch (error) {
    console.error("Error fetching total price:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const totalBookingsHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseBookingReads) {
      const summary = await getSummaryFromFirestore(req.query || {});
      return res.json({ totalBookings: Number(summary.totalBookings || 0) });
    }

    const { where, params, joinSql } = await bookingFilterClause(req);

    const [rows] = await db.query(
      `SELECT COUNT(*) AS totalBookings ${joinSql} ${where}`,
      params,
    );

    return res.json({ totalBookings: rows[0].totalBookings });
  } catch (error) {
    console.error("Error fetching total bookings:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const uniqueUsersHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseBookingReads) {
      const summary = await getSummaryFromFirestore(req.query || {});
      return res.json({ totalUsers: Number(summary.totalUsers || 0) });
    }

    const { where, params, joinSql } = await bookingFilterClause(req);

    const [rows] = await db.query(
      `SELECT COUNT(DISTINCT b.email) AS totalUsers ${joinSql} ${where}`,
      params,
    );

    return res.json({ totalUsers: rows[0].totalUsers });
  } catch (error) {
    console.error("Error fetching total users:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const totalCourtsHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseBookingReads) {
      const summary = await getSummaryFromFirestore(req.query || {});
      return res.json({ totalCourts: Number(summary.totalCourts || 0) });
    }

    const hasSoftDelete = await hasColumn(db, "courts", "is_deleted");
    const arenaRaw = req.query.arena_id;

    let sql;
    const params = [];

    if (arenaRaw != null && String(arenaRaw).trim() !== "" && String(arenaRaw) !== "all") {
      const aid = parseInt(String(arenaRaw), 10);
      if (!isNaN(aid) && aid > 0) {
        if (hasSoftDelete) {
          sql =
            "SELECT COUNT(*) AS totalCourts FROM courts WHERE is_deleted = 0 AND arena_id = ?";
        } else {
          sql = "SELECT COUNT(*) AS totalCourts FROM courts WHERE arena_id = ?";
        }
        params.push(aid);
      }
    }

    if (!sql) {
      const [columns] = await db.query("SHOW COLUMNS FROM courts LIKE 'is_deleted'");
      const hasSD = columns.length > 0;
      sql = hasSD
        ? "SELECT COUNT(*) AS totalCourts FROM courts WHERE is_deleted = 0"
        : "SELECT COUNT(*) AS totalCourts FROM courts";
    }

    const [rows] = await db.query(sql, params);
    return res.json({ totalCourts: rows[0].totalCourts });
  } catch (error) {
    console.error("Error fetching total courts:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const totalArenasHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseBookingReads) {
      const summary = await getSummaryFromFirestore(req.query || {});
      return res.json({ totalArenas: Number(summary.totalArenas || 0) });
    }

    if (!(await hasTable(db, "arenas"))) {
      return res.json({ totalArenas: 0 });
    }
    const [rows] = await db.query("SELECT COUNT(*) AS totalArenas FROM arenas");
    return res.json({ totalArenas: rows[0].totalArenas });
  } catch (error) {
    console.error("Error fetching total arenas:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const uniqueBookingCustomersHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseBookingReads) {
      const rows = await getUniqueBookingCustomersFromFirestore(req.query || {});
      return res.json(rows);
    }

    const { where, params, joinSql } = await bookingFilterClause(req);

    const [rows] = await db.query(
      `
      SELECT b.email AS email, MAX(b.name) AS name, COUNT(*) AS booking_count
      ${joinSql}
      ${where}
      GROUP BY b.email
      ORDER BY booking_count DESC, b.email ASC
    `,
      params,
    );

    return res.json(rows);
  } catch (error) {
    console.error("Error fetching unique booking customers:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const lastFiveBookingsHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseBookingReads) {
      const rows = await getRecentBookingsFromFirestore(req.query || {});
      return res.json(rows);
    }

    const line = await bookingLineTotalExpr();
    const hasCourtSoftDelete = await hasColumn(db, "courts", "is_deleted");
    const courtDeletedSql = hasCourtSoftDelete
      ? "CASE WHEN c.id IS NULL OR c.is_deleted = 1 THEN 1 ELSE 0 END"
      : "CASE WHEN c.id IS NULL THEN 1 ELSE 0 END";

    const { where, params, joinSql } = await bookingFilterClause(req);

    const [rows] = await db.query(
      `
      SELECT
        b.id,
        b.name,
        b.start_time,
        b.end_time,
        b.booking_date,
        (${line}) AS price,
        COALESCE(c.name, CONCAT('Deleted court #', b.court_id)) AS court_name,
        ${courtDeletedSql} AS court_deleted
      ${joinSql}
      ${where}
      ORDER BY b.created_at DESC
      LIMIT 10
    `,
      params,
    );

    return res.json(rows);
  } catch (error) {
    console.error("Error fetching recent bookings:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const bookingsPerMonthHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseBookingReads) {
      const rows = await getBookingsPerMonthFromFirestore(req.query || {});
      return res.json(rows);
    }

    const { where, params, joinSql } = await bookingFilterClause(req);
    const dateClause = "b.booking_date IS NOT NULL";
    const whereFull = where ? `${where} AND ${dateClause}` : `WHERE ${dateClause}`;

    const [rows] = await db.query(
      `
      SELECT
        b.court_id AS court_id,
        MAX(COALESCE(c.name, CONCAT('Deleted court #', b.court_id))) AS court_name,
        DATE_FORMAT(b.booking_date, '%b') AS month,
        MONTH(b.booking_date) AS month_num,
        COUNT(*) AS totalBookings
      ${joinSql}
      ${whereFull}
      GROUP BY b.court_id, YEAR(b.booking_date), MONTH(b.booking_date)
      ORDER BY b.court_id, YEAR(b.booking_date), month_num
    `,
      params,
    );

    return res.json(rows);
  } catch (error) {
    console.error("Error fetching monthly bookings:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

router.get("/summary/total-price", totalPriceHandler);
router.get("/operator/reports/summary/total-price", totalPriceHandler);
router.get("/admin/reports/summary/total-price", totalPriceHandler);

router.get("/summary/total-bookings", totalBookingsHandler);
router.get("/operator/reports/summary/total-bookings", totalBookingsHandler);
router.get("/admin/reports/summary/total-bookings", totalBookingsHandler);

router.get("/summary/unique-users", uniqueUsersHandler);
router.get("/operator/reports/summary/unique-users", uniqueUsersHandler);
router.get("/admin/reports/summary/unique-users", uniqueUsersHandler);

router.get("/summary/total-courts", totalCourtsHandler);
router.get("/operator/reports/summary/total-courts", totalCourtsHandler);
router.get("/admin/reports/summary/total-courts", totalCourtsHandler);

router.get("/summary/total-arenas", totalArenasHandler);
router.get("/operator/reports/summary/total-arenas", totalArenasHandler);
router.get("/admin/reports/summary/total-arenas", totalArenasHandler);

router.get("/operator/reports/unique-booking-customers", uniqueBookingCustomersHandler);
router.get("/admin/reports/unique-booking-customers", uniqueBookingCustomersHandler);

router.get("/last-five-bookings", lastFiveBookingsHandler);
router.get("/operator/reports/recent-bookings", lastFiveBookingsHandler);
router.get("/admin/reports/recent-bookings", lastFiveBookingsHandler);

router.get("/bookings-per-month", bookingsPerMonthHandler);
router.get("/operator/reports/bookings-per-month", bookingsPerMonthHandler);
router.get("/admin/reports/bookings-per-month", bookingsPerMonthHandler);

module.exports = router;
