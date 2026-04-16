const env = require("../../config/env");
const { getFirestore } = require("../../config/firebase");

const getCollectionName = (baseName) => `${env.firebase.collectionPrefix || ""}${baseName}`;

const loadUsers = async () => {
  const snap = await getFirestore().collection(getCollectionName("users")).get();
  return snap.docs.map((doc) => doc.data());
};

const findUserByEmailInFirestore = async (email) => {
  const needle = String(email || "").trim().toLowerCase();
  const users = await loadUsers();
  return users.find((u) => String(u.email || "").trim().toLowerCase() === needle) || null;
};

const findUserByIdInFirestore = async (id) => {
  const snap = await getFirestore().collection(getCollectionName("users")).doc(String(Number(id))).get();
  if (!snap.exists) return null;
  return snap.data();
};

const getNextUserId = async () => {
  const users = await loadUsers();
  let maxId = 0;
  users.forEach((u) => {
    const id = Number(u.id);
    if (Number.isFinite(id) && id > maxId) maxId = id;
  });
  return maxId + 1;
};

const createUserInFirestore = async ({ name, email, hashedPassword }) => {
  const existing = await findUserByEmailInFirestore(email);
  if (existing) {
    const err = new Error("User already exists");
    err.status = 400;
    throw err;
  }

  const id = await getNextUserId();
  await getFirestore()
    .collection(getCollectionName("users"))
    .doc(String(id))
    .set({
      id,
      name,
      email,
      password: hashedPassword,
      title: "Customer",
      role: "customer",
      created_at: new Date().toISOString(),
      _sourceTable: "users",
      _migratedAt: new Date().toISOString(),
    });
};

module.exports = {
  findUserByEmailInFirestore,
  findUserByIdInFirestore,
  createUserInFirestore,
};
