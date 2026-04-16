const express = require("express");

const { db } = require("../config/db");
const env = require("../config/env");
const { hasTable, hasColumn } = require("../utils/schema");
const { formatApiError } = require("../utils/formatApiError");
const {
  listArenasFromFirestore,
  listArenaCourtsFromFirestore,
  listArenaHolidaysFromFirestore,
  upsertArenaHolidayInFirestore,
  deleteArenaHolidayInFirestore,
  createArenaInFirestore,
  updateArenaInFirestore,
} = require("../services/firestore/arenaReads");

const router = express.Router();

const getFallbackArenaList = async () => {
  const [courtRows] = await db.query("SELECT COUNT(*) AS totalCourts FROM courts");

  return [
    {
      id: 1,
      name: "Cross Courts Brooklyn",
      slug: "cross-courts-brooklyn",
      city: "Brooklyn, NY",
      description:
        "USA mock arena used while legacy single-location data is still being migrated.",
      status: "migration",
      courtCount: courtRows[0]?.totalCourts ?? 0,
    },
  ];
};

const getFallbackArenaCourts = async () => {
  const hasPriceColumn = await hasColumn(db, "courts", "price");
  const hasCashPriceColumn = await hasColumn(db, "courts", "cash_price");

  const [courts] = await db.query(`
    SELECT
      id,
      name,
      cat_id,
      CASE
        WHEN cat_id = 1 THEN 1
        WHEN cat_id = 2 THEN 2
        WHEN cat_id = 3 THEN 3
        WHEN cat_id = 4 THEN 4
        ELSE NULL
      END AS sport_id,
      CASE
        WHEN cat_id = 1 THEN 'Cricket'
        WHEN cat_id = 2 THEN 'Football'
        WHEN cat_id = 3 THEN 'Padel'
        WHEN cat_id = 4 THEN 'Baseball'
        ELSE 'Court Sport'
      END AS sport_name,
      ${hasPriceColumn ? "price" : "0"} AS online_price,
      ${hasCashPriceColumn ? "cash_price" : "0"} AS cash_price
    FROM courts
    ORDER BY name ASC
  `);

  return courts;
};

const getFallbackArenaManagementList = async () => {
  const arenas = await getFallbackArenaList();

  return arenas.map((arena) => ({
    ...arena,
    description:
      arena.description ||
      "Fallback arena record while the multi-arena tables are being phased in.",
  }));
};

const getArenaListFromMySql = async () => {
  const [arenas] = await db.query(`
      SELECT
        a.id,
        a.name,
        a.slug,
        a.description,
        a.status,
        a.city,
        COUNT(c.id) AS courtCount
      FROM arenas a
      LEFT JOIN courts c ON c.arena_id = a.id
      GROUP BY a.id, a.name, a.slug, a.description, a.status, a.city
      ORDER BY a.name ASC
    `);
  return arenas;
};

router.get("/arenas", async (req, res) => {
  try {
    if (env.features.useFirebaseArenaReads) {
      const arenas = await listArenasFromFirestore();
      return res.json({
        arenas,
        source: "firestore",
      });
    }

    const arenasTableExists = await hasTable(db, "arenas");

    if (!arenasTableExists) {
      return res.json({
        arenas: await getFallbackArenaList(),
        source: "fallback",
      });
    }

    const arenas = await getArenaListFromMySql();

    return res.json({
      arenas,
      source: "arenas",
    });
  } catch (error) {
    console.error("Error fetching arenas:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
});

router.get("/arenas/:id", async (req, res) => {
  try {
    if (env.features.useFirebaseArenaReads) {
      const arenas = await listArenasFromFirestore();
      const arena = arenas.find((item) => String(item.id) === String(req.params.id));
      if (!arena) {
        return res.status(404).json({ error: "Arena not found" });
      }
      return res.json(arena);
    }

    const arenasTableExists = await hasTable(db, "arenas");

    if (!arenasTableExists) {
      const fallbackArenas = await getFallbackArenaList();
      return res.json(fallbackArenas[0]);
    }

    const { id } = req.params;
    const [rows] = await db.query(
      `
        SELECT
          a.id,
          a.name,
          a.slug,
          a.description,
          a.status,
          a.city,
          COUNT(c.id) AS courtCount
        FROM arenas a
        LEFT JOIN courts c ON c.arena_id = a.id
        WHERE a.id = ?
        GROUP BY a.id, a.name, a.slug, a.description, a.status, a.city
      `,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Arena not found" });
    }

    return res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching arena detail:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
});

router.get("/arenas/:id/courts", async (req, res) => {
  try {
    if (env.features.useFirebaseArenaReads) {
      const courts = await listArenaCourtsFromFirestore(req.params.id);
      if (courts.length === 0) {
        return res.json({
          courts: await getFallbackArenaCourts(),
          source: "fallback",
        });
      }
      return res.json({
        courts,
        source: "firestore",
      });
    }

    const arenasTableExists = await hasTable(db, "arenas");
    const courtsArenaColumnExists = await hasColumn(db, "courts", "arena_id");

    if (!arenasTableExists || !courtsArenaColumnExists) {
      return res.json({
        courts: await getFallbackArenaCourts(),
        source: "fallback",
      });
    }

    const { id } = req.params;
    const hasPriceColumn = await hasColumn(db, "courts", "price");
    const hasCashPriceColumn = await hasColumn(db, "courts", "cash_price");
    const [courts] = await db.query(
      `
        SELECT
          c.id,
          c.name,
          c.cat_id,
          c.arena_id,
          c.sport_id,
          s.name AS sport_name,
          ${hasPriceColumn ? "c.price" : "0"} AS online_price,
          ${hasCashPriceColumn ? "c.cash_price" : "0"} AS cash_price
        FROM courts c
        LEFT JOIN sports s ON s.id = c.sport_id
        WHERE c.arena_id = ?
        ORDER BY c.name ASC
      `,
      [id],
    );

    if (courts.length === 0) {
      return res.json({
        courts: await getFallbackArenaCourts(),
        source: "fallback",
      });
    }

    return res.json({
      courts,
      source: "arenas",
    });
  } catch (error) {
    console.error("Error fetching arena courts:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
});

router.get("/operator/arenas", async (req, res) => {
  try {
    if (env.features.useFirebaseArenaReads) {
      const arenas = await listArenasFromFirestore();
      return res.json({ arenas });
    }

    const arenasTableExists = await hasTable(db, "arenas");

    if (!arenasTableExists) {
      return res.json({ arenas: await getFallbackArenaManagementList() });
    }

    const arenas = await getArenaListFromMySql();

    return res.json({ arenas });
  } catch (error) {
    console.error("Error fetching operator arenas:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
});

router.get("/admin/arenas", async (req, res) => {
  try {
    if (env.features.useFirebaseArenaReads) {
      const arenas = await listArenasFromFirestore();
      return res.json({ arenas });
    }

    const arenasTableExists = await hasTable(db, "arenas");

    if (!arenasTableExists) {
      return res.json({ arenas: await getFallbackArenaManagementList() });
    }

    const arenas = await getArenaListFromMySql();

    return res.json({ arenas });
  } catch (error) {
    console.error("Error fetching admin arenas:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
});

const upsertArenaHandler = async (req, res) => {
  try {
    const { name, slug, city, description, status } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ error: "name and slug are required" });
    }

    const normalizedStatus = status || "active";

    if (env.features.useFirebaseArenaReads) {
      if (req.method === "POST") {
        const arenaId = await createArenaInFirestore({
          name,
          slug,
          city,
          description,
          status: normalizedStatus,
        });
        return res.status(201).json({
          message: "Arena created successfully",
          arenaId,
        });
      }

      const { id } = req.params;
      await updateArenaInFirestore(id, {
        name,
        slug,
        city,
        description,
        status: normalizedStatus,
      });
      return res.json({ message: "Arena updated successfully" });
    }

    const arenasTableExists = await hasTable(db, "arenas");

    if (!arenasTableExists) {
      return res.status(400).json({
        error:
          "Arena management requires the arenas table. Run the arena migrations/seed first.",
      });
    }

    if (req.method === "POST") {
      const [result] = await db.query(
        `
          INSERT INTO arenas (name, slug, city, description, status)
          VALUES (?, ?, ?, ?, ?)
        `,
        [name, slug, city || null, description || null, normalizedStatus],
      );

      return res.status(201).json({
        message: "Arena created successfully",
        arenaId: result.insertId,
      });
    }

    const { id } = req.params;

    await db.query(
      `
        UPDATE arenas
        SET name = ?, slug = ?, city = ?, description = ?, status = ?
        WHERE id = ?
      `,
      [name, slug, city || null, description || null, normalizedStatus, id],
    );

    return res.json({ message: "Arena updated successfully" });
  } catch (error) {
    console.error("Error saving arena:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

router.post("/operator/arenas", upsertArenaHandler);
router.post("/admin/arenas", upsertArenaHandler);
router.put("/operator/arenas/:id", upsertArenaHandler);
router.put("/admin/arenas/:id", upsertArenaHandler);

const arenaHolidaysEnabled = async () => hasTable(db, "arena_holidays");

const listArenaHolidaysHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseArenaReads) {
      const arenaId = parseInt(req.params.arenaId, 10);
      if (Number.isNaN(arenaId)) {
        return res.status(400).json({ error: "Invalid arena id" });
      }
      const holidays = await listArenaHolidaysFromFirestore(arenaId);
      return res.json({ holidays });
    }

    if (!(await arenaHolidaysEnabled())) {
      return res.json({ holidays: [] });
    }
    const arenaId = parseInt(req.params.arenaId, 10);
    if (Number.isNaN(arenaId)) {
      return res.status(400).json({ error: "Invalid arena id" });
    }
    const [rows] = await db.query(
      `SELECT id, arena_id, holiday_date, label FROM arena_holidays
       WHERE arena_id = ?
       ORDER BY holiday_date DESC`,
      [arenaId],
    );
    const holidays = rows.map((row) => ({
      ...row,
      holiday_date:
        row.holiday_date instanceof Date
          ? row.holiday_date.toISOString().split("T")[0]
          : String(row.holiday_date).slice(0, 10),
    }));
    return res.json({ holidays });
  } catch (error) {
    console.error("listArenaHolidaysHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const addArenaHolidayHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseArenaReads) {
      const arenaId = parseInt(req.params.arenaId, 10);
      let { holiday_date, label } = req.body;
      if (Number.isNaN(arenaId) || !holiday_date) {
        return res.status(400).json({ error: "arena id and holiday_date required" });
      }
      holiday_date = new Date(holiday_date).toISOString().split("T")[0];
      const holidayId = await upsertArenaHolidayInFirestore(arenaId, holiday_date, label);
      return res.status(201).json({ message: "Holiday saved", holidayId });
    }

    if (!(await arenaHolidaysEnabled())) {
      return res.status(500).json({
        error:
          "arena_holidays table missing. Run backend/migrations/005_arena_holidays.sql",
      });
    }
    const arenaId = parseInt(req.params.arenaId, 10);
    let { holiday_date, label } = req.body;
    if (Number.isNaN(arenaId) || !holiday_date) {
      return res.status(400).json({ error: "arena id and holiday_date required" });
    }
    holiday_date = new Date(holiday_date).toISOString().split("T")[0];

    await db.query(
      `INSERT INTO arena_holidays (arena_id, holiday_date, label)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE label = VALUES(label)`,
      [arenaId, holiday_date, label || null],
    );

    return res.status(201).json({ message: "Holiday saved" });
  } catch (error) {
    console.error("addArenaHolidayHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const deleteArenaHolidayHandler = async (req, res) => {
  try {
    const arenaId = parseInt(req.params.arenaId, 10);
    const holidayId = parseInt(req.params.holidayId, 10);
    if (Number.isNaN(arenaId) || Number.isNaN(holidayId)) {
      return res.status(400).json({ error: "Invalid ids" });
    }

    if (env.features.useFirebaseArenaReads) {
      await deleteArenaHolidayInFirestore(arenaId, holidayId);
      return res.json({ message: "Holiday removed" });
    }

    await db.query(
      "DELETE FROM arena_holidays WHERE id = ? AND arena_id = ?",
      [holidayId, arenaId],
    );
    return res.json({ message: "Holiday removed" });
  } catch (error) {
    console.error("deleteArenaHolidayHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

router.get("/operator/arenas/:arenaId/holidays", listArenaHolidaysHandler);
router.get("/admin/arenas/:arenaId/holidays", listArenaHolidaysHandler);
router.post("/operator/arenas/:arenaId/holidays", addArenaHolidayHandler);
router.post("/admin/arenas/:arenaId/holidays", addArenaHolidayHandler);
router.delete(
  "/operator/arenas/:arenaId/holidays/:holidayId",
  deleteArenaHolidayHandler,
);
router.delete(
  "/admin/arenas/:arenaId/holidays/:holidayId",
  deleteArenaHolidayHandler,
);

module.exports = router;
