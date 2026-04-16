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

const nextId = async (name) => {
  const rows = await loadRows(name);
  let maxId = 0;
  rows.forEach((r) => {
    const id = toNum(r.id, 0);
    if (id > maxId) maxId = id;
  });
  return maxId + 1;
};

const listCustomersFromFirestore = async () => {
  const users = await loadRows("users");
  return users
    .filter((u) => String(u.role || "").toLowerCase() === "customer")
    .map((u) => ({
      id: toNum(u.id),
      name: u.name || "",
      email: u.email || "",
      phone: u.phone || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 500);
};

const listCourtAddOnsFromFirestore = async (courtId, includeInactive) => {
  const rows = await loadRows("court_add_ons");
  return rows
    .filter((r) => toNum(r.court_id) === toNum(courtId))
    .filter((r) => (includeInactive ? true : toNum(r.is_active, 1) === 1))
    .map((r) => ({
      id: toNum(r.id),
      court_id: toNum(r.court_id),
      label: r.label || "",
      price: toNum(r.price),
      sort_order: toNum(r.sort_order),
      is_active: toNum(r.is_active, 1),
      created_at: r.created_at || null,
    }))
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
};

const createCourtAddOnInFirestore = async (courtId, payload) => {
  const firestore = getFirestore();
  const id = await nextId("court_add_ons");
  const row = {
    id,
    court_id: toNum(courtId),
    label: payload.label,
    price: toNum(payload.price, 0),
    sort_order: toNum(payload.sort_order, 0),
    is_active: payload.is_active ? 1 : 0,
    created_at: new Date().toISOString(),
    _sourceTable: "court_add_ons",
    _migratedAt: new Date().toISOString(),
  };
  await firestore.collection(getCollectionName("court_add_ons")).doc(String(id)).set(row);
  return row;
};

const updateCourtAddOnInFirestore = async (addOnId, patch) => {
  const firestore = getFirestore();
  const docRef = firestore.collection(getCollectionName("court_add_ons")).doc(String(toNum(addOnId)));
  const doc = await docRef.get();
  if (!doc.exists) return null;
  await docRef.set(patch, { merge: true });
  const next = await docRef.get();
  return next.data();
};

const deleteCourtAddOnInFirestore = async (addOnId) => {
  const firestore = getFirestore();
  const docRef = firestore.collection(getCollectionName("court_add_ons")).doc(String(toNum(addOnId)));
  const doc = await docRef.get();
  if (!doc.exists) return false;
  await docRef.delete();
  return true;
};

const getCustomMessageFromFirestore = async () => {
  const rows = await loadRows("custom_message");
  if (!rows.length) return "";
  const first = rows.sort((a, b) => toNum(a.id) - toNum(b.id))[0];
  return first.message || "";
};

const setCustomMessageInFirestore = async (message) => {
  const firestore = getFirestore();
  const col = firestore.collection(getCollectionName("custom_message"));
  const snap = await col.get();
  if (snap.docs.length === 0) {
    await col.doc("1").set({
      id: 1,
      message,
      _sourceTable: "custom_message",
      _migratedAt: new Date().toISOString(),
    });
    return;
  }
  const first = snap.docs.sort((a, b) => toNum(a.data().id) - toNum(b.data().id))[0];
  await col.doc(first.id).set({ message }, { merge: true });
};

module.exports = {
  listCustomersFromFirestore,
  listCourtAddOnsFromFirestore,
  createCourtAddOnInFirestore,
  updateCourtAddOnInFirestore,
  deleteCourtAddOnInFirestore,
  getCustomMessageFromFirestore,
  setCustomMessageInFirestore,
};
