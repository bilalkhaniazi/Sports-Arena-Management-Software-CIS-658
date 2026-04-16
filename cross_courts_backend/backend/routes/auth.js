const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { db } = require("../config/db");
const env = require("../config/env");
const { verifyToken, logout } = require("../middleware/verifyToken");
const { resolveUserRole } = require("../utils/userRole");
const { hasUsersRoleColumn, hasColumn } = require("../utils/schema");
const {
  findUserByEmailInFirestore,
  findUserByIdInFirestore,
  createUserInFirestore,
} = require("../services/firestore/auth");

const router = express.Router();

const registerHandler = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (env.features.useFirebaseAuth) {
      await createUserInFirestore({ name, email, hashedPassword });
      return res.status(201).json({ message: "User registered successfully" });
    }

    const [existingUser] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    if (existingUser.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }
    const usersRoleColumnExists = await hasUsersRoleColumn(db);
    const usersCreatedAtExists = await hasColumn(db, "users", "created_at");

    if (usersRoleColumnExists && usersCreatedAtExists) {
      await db.query(
        "INSERT INTO users (name, email, password, title, role, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
        [name, email, hashedPassword, "Customer", "customer"],
      );
    } else if (usersRoleColumnExists) {
      await db.query(
        "INSERT INTO users (name, email, password, title, role) VALUES (?, ?, ?, ?, ?)",
        [name, email, hashedPassword, "Customer", "customer"],
      );
    } else if (usersCreatedAtExists) {
      await db.query(
        "INSERT INTO users (name, email, password, title, created_at) VALUES (?, ?, ?, ?, NOW())",
        [name, email, hashedPassword, "Customer"],
      );
    } else {
      await db.query(
        "INSERT INTO users (name, email, password, title) VALUES (?, ?, ?, ?)",
        [name, email, hashedPassword, "Customer"],
      );
    }

    return res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    next(error);
  }
};

const loginHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    let user = null;
    if (env.features.useFirebaseAuth) {
      user = await findUserByEmailInFirestore(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
    } else {
      const usersRoleColumnExists = await hasUsersRoleColumn(db);
      const userSelect = usersRoleColumnExists
        ? "SELECT id, name, email, title, role, password FROM users WHERE email = ?"
        : "SELECT id, name, email, title, password FROM users WHERE email = ?";
      const [users] = await db.query(userSelect, [email]);
      if (users.length === 0) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      user = users[0];
    }

    const isMatch = await bcrypt.compare(password, user.password);
    const role = resolveUserRole(user);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role },
      env.jwtSecret,
      {
        expiresIn: "1h",
      },
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        title: user.title,
        role,
      },
    });
  } catch (error) {
    next(error);
  }
};

const meHandler = async (req, res, next) => {
  try {
    let user = null;
    if (env.features.useFirebaseAuth) {
      user = await findUserByIdInFirestore(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
    } else {
      const usersRoleColumnExists = await hasUsersRoleColumn(db);
      const userSelect = usersRoleColumnExists
        ? "SELECT id, name, email, title, role FROM users WHERE id = ?"
        : "SELECT id, name, email, title FROM users WHERE id = ?";
      const [users] = await db.query(userSelect, [req.user.id]);
      if (users.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      user = users[0];
    }

    res.json({
      message: "You have access to protected data",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        title: user.title,
        role: resolveUserRole(user),
      },
    });
  } catch (error) {
    next(error);
  }
};

router.post("/register", registerHandler);
router.post("/auth/register", registerHandler);

router.post("/login", loginHandler);
router.post("/auth/login", loginHandler);

router.post("/logout", verifyToken, logout);
router.post("/auth/logout", verifyToken, logout);

router.get("/protected", verifyToken, meHandler);
router.get("/auth/me", verifyToken, meHandler);

module.exports = router;
