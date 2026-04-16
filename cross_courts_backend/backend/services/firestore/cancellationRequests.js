const env = require("../../config/env");
const { getFirestore } = require("../../config/firebase");

const getCollectionName = (baseName) => `${env.firebase.collectionPrefix || ""}${baseName}`;

const normalizeDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).slice(0, 10);
};

const normalizeEmail = (e) => String(e || "").trim().toLowerCase();

const loadRows = async (name) => {
  const snap = await getFirestore().collection(getCollectionName(name)).get();
  return snap.docs.map((doc) => doc.data());
};

const getNextId = async () => {
  const rows = await loadRows("cancellation_requests");
  let maxId = 0;
  rows.forEach((r) => {
    const id = Number(r.id);
    if (Number.isFinite(id) && id > maxId) maxId = id;
  });
  return maxId + 1;
};

const createCancellationRequestInFirestore = async ({ bookingId, emailRaw, customerNote }) => {
  const firestore = getFirestore();
  const bookings = await loadRows("bookings");
  const courts = await loadRows("courts");
  const arenas = await loadRows("arenas");
  const requests = await loadRows("cancellation_requests");

  const booking = bookings.find((b) => Number(b.id) === Number(bookingId));
  if (!booking) {
    const err = new Error("Booking not found.");
    err.status = 404;
    throw err;
  }

  if (normalizeEmail(booking.email) !== normalizeEmail(emailRaw)) {
    const err = new Error("This booking does not belong to the signed-in email.");
    err.status = 403;
    throw err;
  }

  const pending = requests.find(
    (r) => Number(r.booking_id) === Number(bookingId) && String(r.status) === "pending",
  );
  if (pending) {
    const err = new Error("A cancellation request is already pending for this booking.");
    err.status = 409;
    throw err;
  }

  const court = courts.find((c) => Number(c.id) === Number(booking.court_id));
  const resolvedArenaId =
    booking.arena_id != null ? Number(booking.arena_id) : court?.arena_id != null ? Number(court.arena_id) : null;
  const arena = arenas.find((a) => Number(a.id) === Number(resolvedArenaId));
  const id = await getNextId();

  await firestore.collection(getCollectionName("cancellation_requests")).doc(String(id)).set({
    id,
    booking_id: Number(bookingId),
    arena_id: resolvedArenaId,
    customer_email: booking.email,
    customer_name: booking.name || null,
    court_name: court?.name || null,
    arena_name: arena?.name || null,
    booking_date: normalizeDate(booking.booking_date),
    start_time: booking.start_time || null,
    end_time: booking.end_time || null,
    customer_note: customerNote || null,
    status: "pending",
    operator_note: null,
    created_at: new Date().toISOString(),
    resolved_at: null,
    _sourceTable: "cancellation_requests",
    _migratedAt: new Date().toISOString(),
  });
};

const listCancellationRequestsFromFirestore = async ({ status, arenaIdRaw }) => {
  const [requests, bookings] = await Promise.all([
    loadRows("cancellation_requests"),
    loadRows("bookings"),
  ]);
  const bookingById = new Map(bookings.map((b) => [Number(b.id), b]));

  let rows = requests.map((cr) => ({
    ...cr,
    booking_email_live: bookingById.get(Number(cr.booking_id))?.email || null,
    booking_name_live: bookingById.get(Number(cr.booking_id))?.name || null,
  }));

  const statusFilter = status ? String(status).trim() : "pending";
  if (statusFilter !== "all") {
    const allowed = ["pending", "approved", "denied"];
    const target = allowed.includes(statusFilter) ? statusFilter : "pending";
    rows = rows.filter((r) => String(r.status) === target);
  }

  if (arenaIdRaw != null && String(arenaIdRaw).trim() !== "" && String(arenaIdRaw) !== "all") {
    const aid = Number(arenaIdRaw);
    if (Number.isFinite(aid) && aid > 0) {
      rows = rows.filter((r) => Number(r.arena_id) === aid);
    }
  }

  rows.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")) || Number(b.id) - Number(a.id));
  const pendingCount = requests.filter((r) => String(r.status) === "pending").length;
  return { requests: rows, pendingCount };
};

const getPendingCancellationCountFromFirestore = async () => {
  const requests = await loadRows("cancellation_requests");
  return requests.filter((r) => String(r.status) === "pending").length;
};

const updateCancellationRequestStatusInFirestore = async ({ requestId, status, operatorNote }) => {
  const firestore = getFirestore();
  const requestsRef = firestore.collection(getCollectionName("cancellation_requests"));
  const requestDoc = await requestsRef.doc(String(Number(requestId))).get();
  if (!requestDoc.exists || String(requestDoc.data().status) !== "pending") {
    const err = new Error("Pending request not found.");
    err.status = 404;
    throw err;
  }

  const row = requestDoc.data();
  const patch = {
    status,
    resolved_at: new Date().toISOString(),
  };
  if (status === "denied") {
    patch.operator_note = operatorNote || null;
  }
  await requestsRef.doc(String(Number(requestId))).set(patch, { merge: true });

  if (status === "approved") {
    await firestore.collection(getCollectionName("bookings")).doc(String(Number(row.booking_id))).delete();
  }
};

module.exports = {
  createCancellationRequestInFirestore,
  listCancellationRequestsFromFirestore,
  getPendingCancellationCountFromFirestore,
  updateCancellationRequestStatusInFirestore,
};
