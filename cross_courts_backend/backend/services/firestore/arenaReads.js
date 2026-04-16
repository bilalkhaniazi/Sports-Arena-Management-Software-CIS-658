const env = require("../../config/env");
const { getFirestore } = require("../../config/firebase");

const getCollectionName = (baseName) => `${env.firebase.collectionPrefix || ""}${baseName}`;

const toArenaView = (arenaDoc, courtCount) => ({
  id: Number(arenaDoc.id),
  name: arenaDoc.name || "",
  slug: arenaDoc.slug || "",
  description: arenaDoc.description || null,
  status: arenaDoc.status || "active",
  city: arenaDoc.city || null,
  courtCount,
});

const listArenasFromFirestore = async () => {
  const firestore = getFirestore();
  const arenasSnap = await firestore.collection(getCollectionName("arenas")).get();
  const courtsSnap = await firestore.collection(getCollectionName("courts")).get();

  const courtCounts = new Map();
  courtsSnap.docs.forEach((doc) => {
    const row = doc.data();
    const arenaId = Number(row.arena_id);
    if (!Number.isFinite(arenaId)) return;
    courtCounts.set(arenaId, (courtCounts.get(arenaId) || 0) + 1);
  });

  const arenas = arenasSnap.docs
    .map((doc) => {
      const arena = doc.data();
      const arenaId = Number(arena.id);
      return toArenaView(arena, courtCounts.get(arenaId) || 0);
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return arenas;
};

const listArenaCourtsFromFirestore = async (arenaId) => {
  const numericArenaId = Number(arenaId);
  if (!Number.isFinite(numericArenaId)) {
    return [];
  }

  const firestore = getFirestore();
  const courtsSnap = await firestore.collection(getCollectionName("courts")).get();
  const sportsSnap = await firestore.collection(getCollectionName("sports")).get();

  const sportsById = new Map();
  sportsSnap.docs.forEach((doc) => {
    const row = doc.data();
    const id = Number(row.id);
    if (Number.isFinite(id)) {
      sportsById.set(id, row.name || null);
    }
  });

  const courts = courtsSnap.docs
    .map((doc) => doc.data())
    .filter((row) => Number(row.arena_id) === numericArenaId)
    .map((row) => ({
      id: Number(row.id),
      name: row.name || "",
      cat_id: row.cat_id !== undefined ? Number(row.cat_id) : null,
      arena_id: row.arena_id !== undefined ? Number(row.arena_id) : null,
      sport_id: row.sport_id !== undefined ? Number(row.sport_id) : null,
      sport_name: sportsById.get(Number(row.sport_id)) || null,
      online_price: Number(row.price || 0),
      cash_price: Number(row.cash_price || 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return courts;
};

const normalizeHolidayDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).slice(0, 10);
};

const listArenaHolidaysFromFirestore = async (arenaId) => {
  const numericArenaId = Number(arenaId);
  if (!Number.isFinite(numericArenaId)) {
    return [];
  }

  const firestore = getFirestore();
  const holidaysSnap = await firestore.collection(getCollectionName("arena_holidays")).get();

  const holidays = holidaysSnap.docs
    .map((doc) => doc.data())
    .filter((row) => Number(row.arena_id) === numericArenaId)
    .map((row) => ({
      id: Number(row.id),
      arena_id: Number(row.arena_id),
      holiday_date: normalizeHolidayDate(row.holiday_date),
      label: row.label || null,
    }))
    .sort((a, b) => String(b.holiday_date).localeCompare(String(a.holiday_date)));

  return holidays;
};

const getNextArenaHolidayId = async (firestore, collectionName) => {
  const holidaysSnap = await firestore.collection(collectionName).get();
  let maxId = 0;
  holidaysSnap.docs.forEach((doc) => {
    const row = doc.data();
    const numericId = Number(row.id);
    if (Number.isFinite(numericId) && numericId > maxId) {
      maxId = numericId;
    }
  });
  return maxId + 1;
};

const upsertArenaHolidayInFirestore = async (arenaId, holidayDate, label) => {
  const numericArenaId = Number(arenaId);
  if (!Number.isFinite(numericArenaId)) {
    throw new Error("Invalid arena id");
  }

  const normalizedDate = normalizeHolidayDate(holidayDate);
  if (!normalizedDate) {
    throw new Error("Invalid holiday date");
  }

  const firestore = getFirestore();
  const collectionName = getCollectionName("arena_holidays");
  const holidaysRef = firestore.collection(collectionName);
  const holidaysSnap = await holidaysRef.get();

  let existingDoc = null;
  holidaysSnap.docs.forEach((doc) => {
    const row = doc.data();
    if (
      Number(row.arena_id) === numericArenaId &&
      normalizeHolidayDate(row.holiday_date) === normalizedDate
    ) {
      existingDoc = { id: doc.id, row };
    }
  });

  if (existingDoc) {
    await holidaysRef.doc(existingDoc.id).set(
      {
        ...existingDoc.row,
        label: label || null,
        holiday_date: normalizedDate,
      },
      { merge: true },
    );
    return Number(existingDoc.row.id);
  }

  const nextId = await getNextArenaHolidayId(firestore, collectionName);
  await holidaysRef.doc(String(nextId)).set({
    id: nextId,
    arena_id: numericArenaId,
    holiday_date: normalizedDate,
    label: label || null,
    _sourceTable: "arena_holidays",
    _migratedAt: new Date().toISOString(),
  });

  return nextId;
};

const deleteArenaHolidayInFirestore = async (arenaId, holidayId) => {
  const numericArenaId = Number(arenaId);
  const numericHolidayId = Number(holidayId);
  if (!Number.isFinite(numericArenaId) || !Number.isFinite(numericHolidayId)) {
    throw new Error("Invalid arena id or holiday id");
  }

  const firestore = getFirestore();
  const holidaysRef = firestore.collection(getCollectionName("arena_holidays"));
  const doc = await holidaysRef.doc(String(numericHolidayId)).get();
  if (!doc.exists) {
    return false;
  }

  const row = doc.data();
  if (Number(row.arena_id) !== numericArenaId) {
    return false;
  }

  await holidaysRef.doc(String(numericHolidayId)).delete();
  return true;
};

const getNextArenaId = async (firestore, collectionName) => {
  const snap = await firestore.collection(collectionName).get();
  let maxId = 0;
  snap.docs.forEach((doc) => {
    const row = doc.data();
    const id = Number(row.id);
    if (Number.isFinite(id) && id > maxId) {
      maxId = id;
    }
  });
  return maxId + 1;
};

const getArenasCollection = () => {
  const firestore = getFirestore();
  const collectionName = getCollectionName("arenas");
  return { firestore, collectionName, ref: firestore.collection(collectionName) };
};

const findArenaBySlugInFirestore = async (slug) => {
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  const { ref } = getArenasCollection();
  const snap = await ref.get();
  const match = snap.docs.find((doc) => {
    const row = doc.data();
    return String(row.slug || "").trim().toLowerCase() === normalizedSlug;
  });
  return match ? { docId: match.id, data: match.data() } : null;
};

const createArenaInFirestore = async ({ name, slug, city, description, status }) => {
  const existing = await findArenaBySlugInFirestore(slug);
  if (existing) {
    const err = new Error("Arena slug already exists");
    err.status = 409;
    throw err;
  }

  const { firestore, collectionName, ref } = getArenasCollection();
  const nextId = await getNextArenaId(firestore, collectionName);
  const row = {
    id: nextId,
    name: name || "",
    slug: slug || "",
    city: city || null,
    description: description || null,
    status: status || "active",
    created_at: new Date().toISOString(),
    _sourceTable: "arenas",
    _migratedAt: new Date().toISOString(),
  };
  await ref.doc(String(nextId)).set(row);
  return nextId;
};

const updateArenaInFirestore = async (arenaId, { name, slug, city, description, status }) => {
  const numericArenaId = Number(arenaId);
  if (!Number.isFinite(numericArenaId)) {
    const err = new Error("Invalid arena id");
    err.status = 400;
    throw err;
  }

  const { ref } = getArenasCollection();
  const docRef = ref.doc(String(numericArenaId));
  const existingDoc = await docRef.get();
  if (!existingDoc.exists) {
    const err = new Error("Arena not found");
    err.status = 404;
    throw err;
  }

  const existing = existingDoc.data();
  const targetSlug = String(slug || "").trim().toLowerCase();
  const duplicate = await findArenaBySlugInFirestore(slug);
  if (duplicate && Number(duplicate.data.id) !== numericArenaId && targetSlug.length > 0) {
    const err = new Error("Arena slug already exists");
    err.status = 409;
    throw err;
  }

  const nextRow = {
    ...existing,
    name: name || "",
    slug: slug || "",
    city: city || null,
    description: description || null,
    status: status || "active",
  };
  await docRef.set(nextRow, { merge: true });
};

module.exports = {
  listArenasFromFirestore,
  listArenaCourtsFromFirestore,
  listArenaHolidaysFromFirestore,
  upsertArenaHolidayInFirestore,
  deleteArenaHolidayInFirestore,
  createArenaInFirestore,
  updateArenaInFirestore,
};
