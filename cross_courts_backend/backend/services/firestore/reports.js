const env = require("../../config/env");
const { getFirestore } = require("../../config/firebase");

const getCollectionName = (baseName) => `${env.firebase.collectionPrefix || ""}${baseName}`;

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).slice(0, 10);
};

const toNum = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const loadRows = async (name) => {
  const snap = await getFirestore().collection(getCollectionName(name)).get();
  return snap.docs.map((doc) => doc.data());
};

const applyBookingFilters = (bookings, courts, query) => {
  const arenaRaw = query.arena_id;
  const courtRaw = query.court_id;

  const courtsById = new Map(courts.map((c) => [toNum(c.id), c]));

  return bookings.filter((b) => {
    if (courtRaw != null && String(courtRaw).trim() !== "" && String(courtRaw) !== "all") {
      const cid = parseInt(String(courtRaw), 10);
      if (!Number.isNaN(cid) && cid > 0 && toNum(b.court_id) !== cid) return false;
    }

    if (arenaRaw != null && String(arenaRaw).trim() !== "" && String(arenaRaw) !== "all") {
      const aid = parseInt(String(arenaRaw), 10);
      if (!Number.isNaN(aid) && aid > 0) {
        const court = courtsById.get(toNum(b.court_id));
        const resolvedArenaId = court?.arena_id != null ? toNum(court.arena_id) : toNum(b.arena_id, -1);
        if (resolvedArenaId !== aid) return false;
      }
    }
    return true;
  });
};

const bookingLineTotal = (b) => {
  if (b.total_price !== undefined && b.total_price !== null && b.total_price !== "") {
    return toNum(b.total_price);
  }
  return toNum(b.online_price) + toNum(b.add_on_price);
};

const getSummaryFromFirestore = async (query) => {
  const [bookings, courts, arenas] = await Promise.all([
    loadRows("bookings"),
    loadRows("courts"),
    loadRows("arenas"),
  ]);
  const filtered = applyBookingFilters(bookings, courts, query);

  const totalPrice = filtered.reduce((sum, b) => sum + bookingLineTotal(b), 0);
  const totalBookings = filtered.length;
  const uniqueUsers = new Set(filtered.map((b) => String(b.email || "").toLowerCase()).filter(Boolean)).size;

  const arenaRaw = query.arena_id;
  let filteredCourts = courts.filter((c) => !toNum(c.is_deleted, 0));
  if (arenaRaw != null && String(arenaRaw).trim() !== "" && String(arenaRaw) !== "all") {
    const aid = parseInt(String(arenaRaw), 10);
    if (!Number.isNaN(aid) && aid > 0) {
      filteredCourts = filteredCourts.filter((c) => toNum(c.arena_id) === aid);
    }
  }

  return {
    totalPrice,
    totalBookings,
    totalUsers: uniqueUsers,
    totalCourts: filteredCourts.length,
    totalArenas: arenas.length,
  };
};

const getUniqueBookingCustomersFromFirestore = async (query) => {
  const [bookings, courts] = await Promise.all([loadRows("bookings"), loadRows("courts")]);
  const filtered = applyBookingFilters(bookings, courts, query);
  const grouped = new Map();
  filtered.forEach((b) => {
    const email = String(b.email || "").toLowerCase();
    if (!email) return;
    const prev = grouped.get(email) || { email, name: b.name || "", booking_count: 0 };
    prev.booking_count += 1;
    if (!prev.name && b.name) prev.name = b.name;
    grouped.set(email, prev);
  });
  return Array.from(grouped.values()).sort(
    (a, b) => b.booking_count - a.booking_count || a.email.localeCompare(b.email),
  );
};

const getRecentBookingsFromFirestore = async (query) => {
  const [bookings, courts] = await Promise.all([loadRows("bookings"), loadRows("courts")]);
  const filtered = applyBookingFilters(bookings, courts, query);
  const courtsById = new Map(courts.map((c) => [toNum(c.id), c]));

  return filtered
    .map((b) => {
      const court = courtsById.get(toNum(b.court_id));
      const courtDeleted = !court || Boolean(toNum(court.is_deleted, 0));
      return {
        id: toNum(b.id),
        name: b.name || "",
        start_time: b.start_time || null,
        end_time: b.end_time || null,
        booking_date: normalizeDate(b.booking_date),
        price: bookingLineTotal(b),
        court_name: court?.name || `Deleted court #${toNum(b.court_id)}`,
        court_deleted: courtDeleted ? 1 : 0,
        created_at: b.created_at || "",
      };
    })
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 10);
};

const getBookingsPerMonthFromFirestore = async (query) => {
  const [bookings, courts] = await Promise.all([loadRows("bookings"), loadRows("courts")]);
  const filtered = applyBookingFilters(bookings, courts, query).filter((b) => normalizeDate(b.booking_date));
  const courtsById = new Map(courts.map((c) => [toNum(c.id), c]));
  const grouped = new Map();

  filtered.forEach((b) => {
    const iso = normalizeDate(b.booking_date);
    const d = new Date(`${iso}T00:00:00Z`);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const key = `${toNum(b.court_id)}:${y}:${m}`;
    const prev = grouped.get(key) || {
      court_id: toNum(b.court_id),
      court_name: courtsById.get(toNum(b.court_id))?.name || `Deleted court #${toNum(b.court_id)}`,
      month: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      month_num: m,
      year: y,
      totalBookings: 0,
    };
    prev.totalBookings += 1;
    grouped.set(key, prev);
  });

  return Array.from(grouped.values()).sort(
    (a, b) => a.court_id - b.court_id || a.year - b.year || a.month_num - b.month_num,
  );
};

module.exports = {
  getSummaryFromFirestore,
  getUniqueBookingCustomersFromFirestore,
  getRecentBookingsFromFirestore,
  getBookingsPerMonthFromFirestore,
};
