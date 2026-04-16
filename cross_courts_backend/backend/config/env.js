require("dotenv").config();

const env = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || "your-secret-key",
  features: {
    useFirebaseArenaReads: String(process.env.USE_FIREBASE_ARENA_READS || "").toLowerCase() === "true",
    useFirebaseBookingReads:
      String(process.env.USE_FIREBASE_BOOKING_READS || "").toLowerCase() === "true",
    useFirebaseAuth: String(process.env.USE_FIREBASE_AUTH || "").toLowerCase() === "true",
    useFirebaseCourts: String(process.env.USE_FIREBASE_COURTS || "").toLowerCase() === "true",
    useFirebaseOperations:
      String(process.env.USE_FIREBASE_OPERATIONS || "").toLowerCase() === "true",
    useFirebaseOnly: String(process.env.USE_FIREBASE_ONLY || "").toLowerCase() === "true",
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    databaseURL: process.env.FIREBASE_DATABASE_URL || "",
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "",
    collectionPrefix: process.env.FIREBASE_COLLECTION_PREFIX || "",
  },
  db: {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "crosscourts",
  },
};

module.exports = env;
