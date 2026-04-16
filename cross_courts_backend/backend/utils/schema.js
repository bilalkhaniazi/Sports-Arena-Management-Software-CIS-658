let hasUsersRoleColumnCache = null;
const tableCache = new Map();
const columnCache = new Map();

const hasUsersRoleColumn = async (db) => {
  if (hasUsersRoleColumnCache !== null) {
    return hasUsersRoleColumnCache;
  }

  const [rows] = await db.query("SHOW COLUMNS FROM users LIKE 'role'");
  hasUsersRoleColumnCache = rows.length > 0;
  return hasUsersRoleColumnCache;
};

const hasTable = async (db, tableName) => {
  if (tableCache.has(tableName)) {
    return tableCache.get(tableName);
  }

  const [rows] = await db.query("SHOW TABLES LIKE ?", [tableName]);
  const exists = rows.length > 0;
  tableCache.set(tableName, exists);
  return exists;
};

const hasColumn = async (db, tableName, columnName) => {
  const cacheKey = `${tableName}.${columnName}`;

  if (columnCache.has(cacheKey)) {
    return columnCache.get(cacheKey);
  }

  const [rows] = await db.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [
    columnName,
  ]);
  const exists = rows.length > 0;
  columnCache.set(cacheKey, exists);
  return exists;
};

module.exports = {
  hasUsersRoleColumn,
  hasTable,
  hasColumn,
};
