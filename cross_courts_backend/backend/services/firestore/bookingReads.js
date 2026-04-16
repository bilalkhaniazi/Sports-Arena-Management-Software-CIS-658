const env = require("../../config/env");
const { getFirestore } = require("../../config/firebase");

const getCollectionName = (baseName) => `${env.firebase.collectionPrefix || ""}${baseName}`;

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).slice(0, 10);
};

const normalizeTime = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{1,2}:\d{2}$/.test(raw)) return `${raw}:00`;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(raw)) return raw;
  return raw;
};

const loadCollectionRows = async (name) => {
  const firestore = getFirestore();
  const snap = await firestore.collection(getCollectionName(name)).get();
  return snap.docs.map((doc) => doc.data());
};

const getBookedSlotsFromFirestore = async ({ courtId, date }) => {
  const numericCourtId = Number(courtId);
  const normalizedDate = normalizeDate(date);
  if (!Number.isFinite(numericCourtId) || !normalizedDate) return [];

  const bookings = await loadCollectionRows("bookings");
  return bookings
    .filter(
      (row) =>
        Number(row.court_id) === numericCourtId && normalizeDate(row.booking_date) === normalizedDate,
    )
    .map((row) => ({
      start_time: normalizeTime(row.start_time),
      end_time: normalizeTime(row.end_time),
    }));
};

const getBookingAvailabilityFromFirestore = async ({ courtId, date }) => {
  const numericCourtId = Number(courtId);
  const normalizedDate = normalizeDate(date);
  if (!Number.isFinite(numericCourtId) || numericCourtId <= 0) {
    const err = new Error("Invalid court_id. It must be a positive number.");
    err.status = 400;
    throw err;
  }

  const [bookings, customSlots, defaultSlots, courts, holidays] = await Promise.all([
    loadCollectionRows("bookings"),
    loadCollectionRows("custom_slots"),
    loadCollectionRows("default_slots"),
    loadCollectionRows("courts"),
    loadCollectionRows("arena_holidays"),
  ]);

  const court = courts.find((c) => Number(c.id) === numericCourtId);
  const arenaId = court ? Number(court.arena_id) : null;
  const holiday = holidays.find(
    (h) =>
      Number(h.arena_id) === arenaId &&
      normalizeDate(h.holiday_date) === normalizedDate,
  );
  if (holiday) {
    const label = holiday.label || null;
    return {
      slots: [],
      holiday: true,
      label,
      message: label ? `Closed: ${label}` : "Closed for arena holiday",
      source: "holiday",
    };
  }

  const dayBookings = bookings.filter(
    (b) =>
      Number(b.court_id) === numericCourtId &&
      normalizeDate(b.booking_date) === normalizedDate,
  );

  const customForDay = customSlots.filter(
    (s) =>
      Number(s.court_id) === numericCourtId && normalizeDate(s.slot_date) === normalizedDate,
  );
  const fallbackDefaults = defaultSlots.filter((s) => Number(s.court_id) === numericCourtId);
  const chosenSlots = customForDay.length > 0 ? customForDay : fallbackDefaults;

  if (chosenSlots.length === 0) {
    return {
      slots: [],
      source: "none",
      message:
        "No schedule for this court yet. Add a default template or apply custom slots in Booking Settings.",
    };
  }

  const slots = chosenSlots.map((slot) => {
    const slotStart = normalizeTime(slot.start_time);
    const slotEnd = normalizeTime(slot.end_time);
    const conflictingBooking = dayBookings.find((booking) => {
      const bookingStart = normalizeTime(booking.start_time);
      const bookingEnd = normalizeTime(booking.end_time);
      return (
        (slotStart >= bookingStart && slotStart < bookingEnd) ||
        (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
        (slotStart <= bookingStart && slotEnd >= bookingEnd)
      );
    });

    return {
      ...slot,
      start_time: slotStart,
      end_time: slotEnd,
      booked: conflictingBooking ? 1 : 0,
      booking_id: conflictingBooking ? conflictingBooking.id : -1,
      booking_details: conflictingBooking
        ? {
            name: conflictingBooking.name,
            online_price: conflictingBooking.online_price,
            cash_price: conflictingBooking.cash_price,
            add_on: conflictingBooking.add_on,
            add_on_price: conflictingBooking.add_on_price,
            email: conflictingBooking.email,
            phone: conflictingBooking.phone,
          }
        : {
            name: "",
            online_price: "",
            cash_price: "",
            add_on: "",
            add_on_price: "",
            email: "",
            phone: "",
          },
    };
  });

  return {
    slots,
    source: customForDay.length > 0 ? "custom" : "default",
    message: "Returning slots with booking status.",
  };
};

const getBookingHistoryFromFirestore = async (query) => {
  const bookings = await loadCollectionRows("bookings");
  const courts = await loadCollectionRows("courts");
  const arenas = await loadCollectionRows("arenas");

  const courtsById = new Map(courts.map((c) => [Number(c.id), c]));
  const arenasById = new Map(arenas.map((a) => [Number(a.id), a]));

  const searchQ = query.q != null ? String(query.q).trim().toLowerCase() : "";
  const arenaFilter = query.arena_id != null ? String(query.arena_id) : "";
  const courtFilter = query.court_id != null ? String(query.court_id) : "";
  const dateFrom = query.date_from ? normalizeDate(query.date_from) : null;
  const dateTo = query.date_to ? normalizeDate(query.date_to) : null;
  const timeFrom = query.time_from ? normalizeTime(query.time_from) : null;
  const timeTo = query.time_to ? normalizeTime(query.time_to) : null;

  const rows = bookings
    .map((b) => {
      const court = courtsById.get(Number(b.court_id));
      const arenaId = b.arena_id != null ? Number(b.arena_id) : Number(court?.arena_id);
      const arena = arenasById.get(arenaId);
      return {
        ...b,
        court_name: court?.name || null,
        court_arena_id: court?.arena_id != null ? Number(court.arena_id) : null,
        arena_name: arena?.name || null,
        booking_date: normalizeDate(b.booking_date),
        start_time: normalizeTime(b.start_time),
      };
    })
    .filter((row) => {
      if (arenaFilter && arenaFilter !== "all") {
        const aid = Number(arenaFilter);
        const rowArena = row.court_arena_id != null ? Number(row.court_arena_id) : Number(row.arena_id);
        if (!Number.isFinite(aid) || rowArena !== aid) return false;
      }
      if (courtFilter && courtFilter !== "all") {
        const cid = Number(courtFilter);
        if (!Number.isFinite(cid) || Number(row.court_id) !== cid) return false;
      }
      if (dateFrom && String(row.booking_date) < dateFrom) return false;
      if (dateTo && String(row.booking_date) > dateTo) return false;
      if (timeFrom && String(row.start_time) < timeFrom) return false;
      if (timeTo && String(row.start_time) > timeTo) return false;
      if (searchQ) {
        const bag = [row.name, row.phone, row.email, row.add_on]
          .map((v) => String(v || "").toLowerCase())
          .join(" ");
        if (!bag.includes(searchQ)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (String(a.booking_date) !== String(b.booking_date)) {
        return String(b.booking_date).localeCompare(String(a.booking_date));
      }
      if (String(a.start_time) !== String(b.start_time)) {
        return String(b.start_time).localeCompare(String(a.start_time));
      }
      return Number(b.id) - Number(a.id);
    });

  return rows;
};

const getCustomerBookingsFromFirestore = async ({ email, search, fromDate, toDate }) => {
  const bookings = await loadCollectionRows("bookings");
  const courts = await loadCollectionRows("courts");
  const arenas = await loadCollectionRows("arenas");
  let cancellationRequests = [];
  try {
    cancellationRequests = await loadCollectionRows("cancellation_requests");
  } catch (_err) {
    cancellationRequests = [];
  }

  const courtsById = new Map(courts.map((c) => [Number(c.id), c]));
  const arenasById = new Map(arenas.map((a) => [Number(a.id), a]));

  const pendingByBookingId = new Map();
  const denialByBookingId = new Map();
  cancellationRequests.forEach((row) => {
    const bookingId = Number(row.booking_id);
    if (!Number.isFinite(bookingId)) return;
    if (row.status === "pending" && !pendingByBookingId.has(bookingId)) {
      pendingByBookingId.set(bookingId, row.status);
    }
    if (row.status === "denied") {
      const prev = denialByBookingId.get(bookingId);
      if (!prev || Number(row.id) > Number(prev.id)) {
        denialByBookingId.set(bookingId, { id: Number(row.id), operator_note: row.operator_note || null });
      }
    }
  });

  const needle = String(search || "").trim().toLowerCase();
  const from = fromDate ? normalizeDate(fromDate) : null;
  const to = toDate ? normalizeDate(toDate) : null;

  const rows = bookings
    .filter((b) => String(b.email || "").toLowerCase() === String(email || "").toLowerCase())
    .map((b) => {
      const court = courtsById.get(Number(b.court_id));
      const arena = arenasById.get(Number(b.arena_id));
      const denial = denialByBookingId.get(Number(b.id));
      return {
        ...b,
        booking_date: normalizeDate(b.booking_date),
        court_name: court?.name || null,
        arena_name: arena?.name || null,
        arena_city: arena?.city || null,
        cancellation_pending_status: pendingByBookingId.get(Number(b.id)) || null,
        cancellation_last_denial_note: denial?.operator_note || null,
      };
    })
    .filter((row) => {
      if (from && String(row.booking_date) < from) return false;
      if (to && String(row.booking_date) > to) return false;
      if (needle) {
        const bag = [row.arena_name, row.court_name, row.add_on, row.name]
          .map((v) => String(v || "").toLowerCase())
          .join(" ");
        if (!bag.includes(needle)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (String(a.booking_date) !== String(b.booking_date)) {
        return String(b.booking_date).localeCompare(String(a.booking_date));
      }
      return Number(b.id) - Number(a.id);
    });

  return rows;
};

module.exports = {
  getBookingAvailabilityFromFirestore,
  getBookedSlotsFromFirestore,
  getBookingHistoryFromFirestore,
  getCustomerBookingsFromFirestore,
};
