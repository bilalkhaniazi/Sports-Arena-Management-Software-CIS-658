/**
 * One-time migration script: MySQL -> Firestore
 *
 * Usage:
 *   npm run db:migrate:firebase
 *
 * Optional env:
 *   FIREBASE_COLLECTION_PREFIX=dev_
 */
const { db } = require("../config/db");
const { getFirestore } = require("../config/firebase");

const TABLES = [
  "users",
  "sports",
  "arenas",
  "arena_operators",
  "arena_holidays",
  "courts",
  "default_slots",
  "custom_slots",
  "court_schedule",
  "court_add_ons",
  "custom_message",
  "bookings",
  "cancellation_requests",
];

const BATCH_LIMIT = 400;

const toSerializable = (value) => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return Number(value);
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return value;
};

const normalizeRow = (row) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, toSerializable(v)]));

const tableExists = async (tableName) => {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName],
  );
  return Number(rows?.[0]?.c || 0) > 0;
};

const fetchRows = async (tableName) => {
  const [rows] = await db.query(`SELECT * FROM \`${tableName}\``);
  return rows;
};

const flushBatch = async (batch) => {
  await batch.commit();
};

const migrateTable = async (firestore, tableName, collectionPrefix) => {
  const exists = await tableExists(tableName);
  if (!exists) {
    console.log(`Skipping ${tableName}: table does not exist in current database.`);
    return { tableName, migrated: 0, skipped: true };
  }

  const rows = await fetchRows(tableName);
  const collectionName = `${collectionPrefix}${tableName}`;
  console.log(`Migrating ${tableName} -> ${collectionName} (${rows.length} rows)`);

  let migrated = 0;
  let batch = firestore.batch();
  let batchCount = 0;

  for (const row of rows) {
    const normalized = normalizeRow(row);
    const docId =
      normalized.id !== null && normalized.id !== undefined
        ? String(normalized.id)
        : `${tableName}-${migrated + 1}`;

    const ref = firestore.collection(collectionName).doc(docId);
    batch.set(ref, {
      ...normalized,
      _sourceTable: tableName,
      _migratedAt: new Date().toISOString(),
    });

    batchCount += 1;
    migrated += 1;

    if (batchCount >= BATCH_LIMIT) {
      await flushBatch(batch);
      batch = firestore.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await flushBatch(batch);
  }

  return { tableName, migrated, skipped: false };
};

const main = async () => {
  const firestore = getFirestore();
  const collectionPrefix = process.env.FIREBASE_COLLECTION_PREFIX || "";
  const results = [];

  try {
    for (const tableName of TABLES) {
      const result = await migrateTable(firestore, tableName, collectionPrefix);
      results.push(result);
    }
  } finally {
    await db.end();
  }

  const total = results.reduce((sum, r) => sum + (r.migrated || 0), 0);
  console.log("\nMigration completed.");
  for (const result of results) {
    if (result.skipped) {
      console.log(`- ${result.tableName}: skipped`);
      continue;
    }
    console.log(`- ${result.tableName}: ${result.migrated} documents`);
  }
  console.log(`Total migrated documents: ${total}`);
};

main().catch((err) => {
  console.error("MySQL -> Firestore migration failed:", err.message || err);
  process.exit(1);
});
