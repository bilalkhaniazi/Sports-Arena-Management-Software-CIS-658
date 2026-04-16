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

const loadRows = async (name) => {
  const firestore = getFirestore();
  const snap = await firestore.collection(getCollectionName(name)).get();
  return snap.docs.map((doc) => doc.data());
};

const getNextId = async (name) => {
  const rows = await loadRows(name);
  let maxId = 0;
  rows.forEach((row) => {
    const id = Number(row.id);
    if (Number.isFinite(id) && id > maxId) maxId = id;
  });
  return maxId + 1;
};

const findHolidayForCourtDate = async (courtId, bookingDate) => {
  const courts = await loadRows("courts");
  const holidays = await loadRows("arena_holidays");
  const court = courts.find((c) => Number(c.id) === Number(courtId));
  if (!court) return null;
  const arenaId = Number(court.arena_id);
  return (
    holidays.find(
      (h) =>
        Number(h.arena_id) === arenaId && normalizeDate(h.holiday_date) === normalizeDate(bookingDate),
    ) || null
  );
};

const createBookingInFirestore = async (payload) => {
  const firestore = getFirestore();
  const collection = firestore.collection(getCollectionName("bookings"));

  const bookingDateNorm = normalizeDate(payload.booking_date);
  const startTime = normalizeTime(payload.start_time);
  const endTime = normalizeTime(payload.end_time);

  const holiday = await findHolidayForCourtDate(payload.court_id, bookingDateNorm);
  if (holiday) {
    const err = new Error(
      "This date is an arena holiday. Bookings are not available—choose another day.",
    );
    err.status = 400;
    throw err;
  }

  const existing = await loadRows("bookings");
  const conflict = existing.find(
    (b) =>
      Number(b.court_id) === Number(payload.court_id) &&
      normalizeTime(b.start_time) === startTime &&
      normalizeTime(b.end_time) === endTime &&
      normalizeDate(b.booking_date) === bookingDateNorm,
  );
  if (conflict) {
    const err = new Error("Slot already booked.");
    err.status = 400;
    throw err;
  }

  const id = await getNextId("bookings");
  const online = Number(payload.online_price) || 0;
  const cash = Number(payload.cash_price) || 0;
  const addOn = payload.add_on_price === null || payload.add_on_price === undefined ? 0 : Number(payload.add_on_price) || 0;
  const paymentMethod = payload.payment_method === "cash" ? "cash" : "online";
  const totalPrice = paymentMethod === "cash" ? Math.round((cash + addOn) * 100) / 100 : Math.round((online + addOn) * 100) / 100;

  await collection.doc(String(id)).set({
    id,
    court_id: Number(payload.court_id),
    arena_id: payload.arena_id !== undefined ? Number(payload.arena_id) : null,
    sport_id: payload.sport_id !== undefined ? Number(payload.sport_id) : null,
    start_time: startTime,
    end_time: endTime,
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    online_price: online,
    cash_price: cash,
    add_on: payload.add_on,
    add_on_price: payload.add_on_price,
    payment_method: paymentMethod,
    total_price: totalPrice,
    booking_date: bookingDateNorm,
    created_at: new Date().toISOString(),
    _sourceTable: "bookings",
    _migratedAt: new Date().toISOString(),
  });

  return { id, bookingDateNorm, startTime, endTime };
};

const updateBookingInFirestore = async (id, payload) => {
  const firestore = getFirestore();
  const docRef = firestore.collection(getCollectionName("bookings")).doc(String(Number(id)));
  const existing = await docRef.get();
  if (!existing.exists) {
    const err = new Error("Booking not found.");
    err.status = 404;
    throw err;
  }

  await docRef.set(
    {
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      online_price: Number(payload.online_price) || 0,
      cash_price: Number(payload.cash_price) || 0,
      add_on: payload.add_on,
      add_on_price: payload.add_on_price,
    },
    { merge: true },
  );
};

const deleteBookingInFirestore = async (id) => {
  const firestore = getFirestore();
  const numericId = Number(id);
  const docRef = firestore.collection(getCollectionName("bookings")).doc(String(numericId));
  const existing = await docRef.get();
  if (!existing.exists) return false;
  await docRef.delete();
  return true;
};

const getBookingEmailFromFirestore = async (id) => {
  const firestore = getFirestore();
  const doc = await firestore.collection(getCollectionName("bookings")).doc(String(Number(id))).get();
  if (!doc.exists) return null;
  const row = doc.data();
  return row.email || null;
};

module.exports = {
  createBookingInFirestore,
  updateBookingInFirestore,
  deleteBookingInFirestore,
  getBookingEmailFromFirestore,
};
