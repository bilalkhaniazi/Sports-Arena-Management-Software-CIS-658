const mysql = require("./cross_courts_backend/backend/node_modules/mysql2/promise");
const bcrypt = require("./cross_courts_backend/backend/node_modules/bcryptjs");

async function ensureColumn(db, table, column, definition) {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
  if (rows.length === 0) {
    await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
  }
}

async function ensureTable(db, name, ddl) {
  const [rows] = await db.query("SHOW TABLES LIKE ?", [name]);
  if (rows.length === 0) {
    await db.query(ddl);
  }
}

async function main() {
  const db = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "crosscourts",
    multipleStatements: true,
  });

  await ensureColumn(db, "users", "role", "`role` enum('admin','operator','customer') NOT NULL DEFAULT 'customer' AFTER `title`");
  await ensureColumn(db, "courts", "arena_id", "`arena_id` int(11) DEFAULT NULL AFTER `cat_id`");
  await ensureColumn(db, "courts", "sport_id", "`sport_id` int(11) DEFAULT NULL AFTER `arena_id`");
  await ensureColumn(db, "courts", "price", "`price` decimal(10,2) NOT NULL DEFAULT 0.00 AFTER `sport_id`");
  await ensureColumn(db, "courts", "cash_price", "`cash_price` decimal(10,2) NOT NULL DEFAULT 0.00 AFTER `price`");
  await ensureColumn(db, "courts", "is_deleted", "`is_deleted` tinyint(1) NOT NULL DEFAULT 0 AFTER `cash_price`");
  await ensureColumn(db, "courts", "deleted_at", "`deleted_at` datetime DEFAULT NULL AFTER `is_deleted`");
  await ensureColumn(db, "bookings", "arena_id", "`arena_id` int(11) DEFAULT NULL AFTER `court_id`");
  await ensureColumn(db, "bookings", "sport_id", "`sport_id` int(11) DEFAULT NULL AFTER `arena_id`");

  await ensureTable(
    db,
    "sports",
    `CREATE TABLE sports (
      id int(11) NOT NULL AUTO_INCREMENT,
      name varchar(100) NOT NULL,
      slug varchar(120) NOT NULL,
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id),
      UNIQUE KEY slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  await ensureTable(
    db,
    "arenas",
    `CREATE TABLE arenas (
      id int(11) NOT NULL AUTO_INCREMENT,
      name varchar(255) NOT NULL,
      slug varchar(255) NOT NULL,
      description text DEFAULT NULL,
      city varchar(120) DEFAULT NULL,
      status enum('draft','active','inactive') NOT NULL DEFAULT 'active',
      created_at timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (id),
      UNIQUE KEY slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
  );

  const hash = bcrypt.hashSync("password123", 12);

  await db.query("DELETE FROM custom_slots");
  await db.query("DELETE FROM court_schedule");
  await db.query("DELETE FROM default_slots");
  await db.query("DELETE FROM bookings");
  await db.query("DELETE FROM courts");
  await db.query("DELETE FROM custom_message");
  await db.query("DELETE FROM users");
  await db.query("DELETE FROM arenas");
  await db.query("DELETE FROM sports");

  await db.query(`
    INSERT INTO sports (id, name, slug) VALUES
    (1, 'Cricket', 'cricket'),
    (2, 'Football', 'football'),
    (3, 'Padel', 'padel'),
    (4, 'Basketball', 'basketball'),
    (5, 'Baseball', 'baseball')
  `);

  await db.query(`
    INSERT INTO arenas (id, name, slug, description, city, status) VALUES
    (1, 'Cross Courts Brooklyn', 'cross-courts-brooklyn', 'Flagship venue with premium cricket, football, and padel facilities.', 'Brooklyn, NY', 'active'),
    (2, 'Cross Courts Austin', 'cross-courts-austin', 'Operator-ready venue for basketball, baseball, and community sports.', 'Austin, TX', 'active'),
    (3, 'Cross Courts Seattle', 'cross-courts-seattle', 'Draft expansion venue used to test multi-arena backoffice workflows.', 'Seattle, WA', 'draft')
  `);

  await db.query(`
    INSERT INTO courts (id, name, cat_id, arena_id, sport_id, price, cash_price, is_deleted, deleted_at, created_at) VALUES
    (1, 'Brooklyn Cricket Ground A', 1, 1, 1, 120.00, 135.00, 0, NULL, NOW()),
    (2, 'Brooklyn Cricket Ground B', 1, 1, 1, 110.00, 125.00, 0, NULL, NOW()),
    (3, 'Brooklyn Football Pitch', 2, 1, 2, 95.00, 110.00, 0, NULL, NOW()),
    (4, 'Brooklyn Padel Court', 3, 1, 3, 85.00, 95.00, 0, NULL, NOW()),
    (5, 'Austin Basketball Court', 4, 2, 4, 70.00, 80.00, 0, NULL, NOW()),
    (6, 'Austin Baseball Field', 5, 2, 5, 130.00, 145.00, 0, NULL, NOW()),
    (7, 'Legacy Brooklyn Cricket Turf', 1, 1, 1, 90.00, 105.00, 1, NOW(), NOW())
  `);

  await db.query(`
    INSERT INTO bookings (id, court_id, arena_id, sport_id, start_time, end_time, name, phone, email, online_price, cash_price, add_on, add_on_price, booking_date, created_at) VALUES
    (1, 1, 1, 1, '09:00:00', '10:00:00', 'Alex Carter', '9175550101', 'alex.carter@example.com', 120.00, 0.00, 'Bat Rental', 15.00, '2026-03-03', NOW()),
    (2, 2, 1, 1, '11:00:00', '12:00:00', 'Alex Carter', '9175550101', 'alex.carter@example.com', 110.00, 0.00, 'Extra Nets', 12.00, '2026-03-08', NOW()),
    (3, 3, 1, 2, '15:00:00', '16:00:00', 'Morgan Lee', '6465550142', 'morgan.lee@example.com', 95.00, 10.00, 'Coach Add-on', 20.00, '2026-02-12', NOW()),
    (4, 4, 1, 3, '17:00:00', '18:00:00', 'Taylor Brooks', '3475550188', 'taylor.brooks@example.com', 85.00, 0.00, 'Racket Rental', 8.00, '2026-01-22', NOW()),
    (5, 5, 2, 4, '10:00:00', '11:00:00', 'Jordan Rivera', '7185550188', 'jordan.rivera@example.com', 70.00, 15.00, 'Scoreboard', 10.00, '2026-03-15', NOW()),
    (6, 6, 2, 5, '13:00:00', '14:30:00', 'Sam Nguyen', '5125550123', 'sam.nguyen@example.com', 130.00, 0.00, 'Field Prep', 18.00, '2026-02-20', NOW()),
    (7, 7, 1, 1, '18:00:00', '19:00:00', 'Casey Hall', '9295550144', 'casey.hall@example.com', 90.00, 0.00, 'Lighting', 14.00, '2026-01-05', NOW()),
    (8, 1, 1, 1, '08:00:00', '09:00:00', 'Jamie Stone', '9175550177', 'jamie.stone@example.com', 120.00, 0.00, 'Water Pack', 6.00, '2026-02-28', NOW()),
    (9, 3, 1, 2, '19:00:00', '20:00:00', 'Riley Chen', '6465550166', 'riley.chen@example.com', 95.00, 0.00, 'Training Bibs', 9.00, '2026-03-21', NOW()),
    (10, 5, 2, 4, '16:00:00', '17:00:00', 'Drew Foster', '7375550199', 'drew.foster@example.com', 70.00, 10.00, 'Equipment Storage', 11.00, '2026-03-11', NOW())
  `);

  await db.query(`
    INSERT INTO default_slots (court_id, start_time, end_time) VALUES
    (1, '08:00:00', '09:00:00'),
    (1, '09:00:00', '10:00:00'),
    (1, '10:00:00', '11:00:00'),
    (2, '11:00:00', '12:00:00'),
    (3, '15:00:00', '16:00:00'),
    (4, '17:00:00', '18:00:00'),
    (5, '10:00:00', '11:00:00'),
    (6, '13:00:00', '14:30:00')
  `);

  await db.query(`
    INSERT INTO custom_message (id, message) VALUES
    (1, 'Your booking is confirmed. The operator team will reach out with any updates before your slot.')
  `);

  await db.query(`
    INSERT INTO users (name, email, password, title, role) VALUES
    ('Admin User', 'admin@crosscourtsusa.com', ?, 'Admin', 'admin'),
    ('Operator User', 'operator@crosscourtsusa.com', ?, 'Operator', 'operator'),
    ('Customer User', 'customer@crosscourtsusa.com', ?, 'Customer', 'customer')
  `, [hash, hash, hash]);

  const [summary] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM arenas) AS arenas,
      (SELECT COUNT(*) FROM courts WHERE is_deleted = 0) AS activeCourts,
      (SELECT COUNT(*) FROM courts WHERE is_deleted = 1) AS deletedCourts,
      (SELECT COUNT(*) FROM bookings) AS bookings
  `);

  console.log(JSON.stringify(summary[0]));
  await db.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
