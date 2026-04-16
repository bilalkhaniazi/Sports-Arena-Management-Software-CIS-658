const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const env = require("./env");

let initialized = false;

const loadServiceAccount = () => {
  if (!env.firebase.serviceAccountPath) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_PATH is missing. Set it in backend/.env before running Firebase migration.",
    );
  }

  const absolutePath = path.isAbsolute(env.firebase.serviceAccountPath)
    ? env.firebase.serviceAccountPath
    : path.resolve(__dirname, "..", env.firebase.serviceAccountPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Firebase service account file not found at: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, "utf8");
  return JSON.parse(raw);
};

const initializeFirebase = () => {
  if (initialized && admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccount = loadServiceAccount();
  const options = {
    credential: admin.credential.cert(serviceAccount),
  };

  if (env.firebase.projectId) options.projectId = env.firebase.projectId;
  if (env.firebase.storageBucket) options.storageBucket = env.firebase.storageBucket;
  if (env.firebase.databaseURL) options.databaseURL = env.firebase.databaseURL;

  const app = admin.initializeApp(options);
  initialized = true;
  return app;
};

const getFirestore = () => {
  initializeFirebase();
  return admin.firestore();
};

module.exports = {
  initializeFirebase,
  getFirestore,
};
