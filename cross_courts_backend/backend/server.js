const env = require("./config/env");
const { testConnection } = require("./config/db");
const app = require("./app");

const PORT = env.port;

(async () => {
  if (env.features.useFirebaseOnly) {
    console.log("Firebase-only mode enabled: skipping MySQL connection test.");
  } else {
    await testConnection();
  }
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})();
