const jwt = require("jsonwebtoken");

const env = require("../config/env");
const { formatApiError } = require("../utils/formatApiError");

// Temporary blacklist storage (use Redis for scalability)
const blacklistedTokens = new Set();

const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(403).json({ message: "No token provided" });

    if (blacklistedTokens.has(token)) {
      return res
        .status(401)
        .json({ message: "Token is revoked. Please log in again." });
    }

    jwt.verify(token, env.jwtSecret, (err, decoded) => {
      if (err) {
        return res
          .status(401)
          .json({ message: "Unauthorized, invalid or expired token" });
      }

      req.user = decoded;
      next();
    });
  } catch (error) {
    const text = formatApiError(error);
    return res.status(500).json({ message: text, error: text });
  }
};

const logout = (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(400).json({ message: "No token found" });

    blacklistedTokens.add(token);

    res.status(200).json({ message: "Logout successful, token revoked" });
  } catch (error) {
    const text = formatApiError(error);
    res.status(500).json({ message: text, error: text });
  }
};

module.exports = { verifyToken, logout };
