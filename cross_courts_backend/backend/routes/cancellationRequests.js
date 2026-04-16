const express = require("express");

const { db } = require("../config/db");
const env = require("../config/env");
const { hasTable } = require("../utils/schema");
const { formatApiError } = require("../utils/formatApiError");
const {
  createCancellationRequestInFirestore,
  listCancellationRequestsFromFirestore,
  getPendingCancellationCountFromFirestore,
  updateCancellationRequestStatusInFirestore,
} = require("../services/firestore/cancellationRequests");

const router = express.Router();

const normalizeEmail = (e) => String(e || "").trim().toLowerCase();

const customerCreateCancellationRequest = async (req, res) => {
  try {
    if (env.features.useFirebaseBookingReads) {
      const bookingId = parseInt(req.params.id, 10);
      if (isNaN(bookingId) || bookingId <= 0) {
        return res.status(400).json({ error: "Invalid booking id." });
      }

      const emailRaw = req.body?.email ?? req.query?.email;
      const customerNote =
        typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 2000) : null;

      if (!emailRaw || String(emailRaw).trim() === "") {
        return res.status(400).json({ error: "email is required." });
      }

      await createCancellationRequestInFirestore({ bookingId, emailRaw, customerNote });
      return res.status(201).json({
        success: true,
        message: "Cancellation request submitted. An operator will review it shortly.",
      });
    }

    if (!(await hasTable(db, "cancellation_requests"))) {
      return res.status(503).json({
        error: "Cancellation requests are not available yet. Try again shortly.",
      });
    }

    const bookingId = parseInt(req.params.id, 10);
    if (isNaN(bookingId) || bookingId <= 0) {
      return res.status(400).json({ error: "Invalid booking id." });
    }

    const emailRaw = req.body?.email ?? req.query?.email;
    const customerNote =
      typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 2000) : null;

    if (!emailRaw || String(emailRaw).trim() === "") {
      return res.status(400).json({ error: "email is required." });
    }

    const [bookings] = await db.query(
      `SELECT b.*, c.name AS court_name, c.arena_id AS court_arena_id,
              COALESCE(b.arena_id, c.arena_id) AS resolved_arena_id,
              a.name AS arena_name
       FROM bookings b
       LEFT JOIN courts c ON c.id = b.court_id
       LEFT JOIN arenas a ON a.id = COALESCE(b.arena_id, c.arena_id)
       WHERE b.id = ?`,
      [bookingId],
    );

    if (bookings.length === 0) {
      return res.status(404).json({ error: "Booking not found." });
    }

    const b = bookings[0];
    if (normalizeEmail(b.email) !== normalizeEmail(emailRaw)) {
      return res.status(403).json({ error: "This booking does not belong to the signed-in email." });
    }

    const [pending] = await db.query(
      "SELECT id FROM cancellation_requests WHERE booking_id = ? AND status = 'pending'",
      [bookingId],
    );
    if (pending.length > 0) {
      return res.status(409).json({
        error: "A cancellation request is already pending for this booking.",
      });
    }

    await db.query(
      `INSERT INTO cancellation_requests
        (booking_id, arena_id, customer_email, customer_name, court_name, arena_name,
         booking_date, start_time, end_time, customer_note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        bookingId,
        b.resolved_arena_id ?? null,
        b.email,
        b.name ?? null,
        b.court_name ?? null,
        b.arena_name ?? null,
        b.booking_date,
        b.start_time,
        b.end_time,
        customerNote,
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Cancellation request submitted. An operator will review it shortly.",
    });
  } catch (error) {
    console.error("customerCreateCancellationRequest:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const listCancellationRequests = async (req, res) => {
  try {
    if (env.features.useFirebaseBookingReads) {
      const payload = await listCancellationRequestsFromFirestore({
        status: req.query.status,
        arenaIdRaw: req.query.arena_id,
      });
      return res.json(payload);
    }

    if (!(await hasTable(db, "cancellation_requests"))) {
      return res.json({ requests: [], pendingCount: 0 });
    }

    const status = req.query.status ? String(req.query.status).trim() : "pending";
    const arenaIdRaw = req.query.arena_id;

    const conditions = [];
    const params = [];

    if (status === "all") {
      /* no status filter */
    } else if (["pending", "approved", "denied"].includes(status)) {
      conditions.push("cr.status = ?");
      params.push(status);
    } else {
      conditions.push("cr.status = 'pending'");
    }

    if (arenaIdRaw != null && String(arenaIdRaw).trim() !== "" && String(arenaIdRaw) !== "all") {
      const aid = parseInt(String(arenaIdRaw), 10);
      if (!isNaN(aid) && aid > 0) {
        conditions.push("cr.arena_id = ?");
        params.push(aid);
      }
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [rows] = await db.query(
      `SELECT cr.*,
              b.email AS booking_email_live,
              b.name AS booking_name_live
       FROM cancellation_requests cr
       LEFT JOIN bookings b ON b.id = cr.booking_id
       ${whereSql}
       ORDER BY cr.created_at DESC, cr.id DESC`,
      params,
    );

    const [countRows] = await db.query(
      "SELECT COUNT(*) AS c FROM cancellation_requests WHERE status = 'pending'",
    );
    const pendingCount = countRows[0]?.c ?? 0;

    return res.json({ requests: rows, pendingCount });
  } catch (error) {
    console.error("listCancellationRequests:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const pendingCountHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseBookingReads) {
      const count = await getPendingCancellationCountFromFirestore();
      return res.json({ count });
    }

    if (!(await hasTable(db, "cancellation_requests"))) {
      return res.json({ count: 0 });
    }
    const [rows] = await db.query(
      "SELECT COUNT(*) AS c FROM cancellation_requests WHERE status = 'pending'",
    );
    return res.json({ count: rows[0]?.c ?? 0 });
  } catch (error) {
    console.error("pendingCountHandler:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const approveCancellationRequest = async (req, res) => {
  try {
    if (env.features.useFirebaseBookingReads) {
      const requestId = parseInt(req.params.requestId, 10);
      if (isNaN(requestId) || requestId <= 0) {
        return res.status(400).json({ error: "Invalid request id." });
      }
      await updateCancellationRequestStatusInFirestore({
        requestId,
        status: "approved",
      });
      return res.json({
        success: true,
        message: "Booking cancelled and request approved.",
      });
    }

    if (!(await hasTable(db, "cancellation_requests"))) {
      return res.status(503).json({ error: "Cancellation requests table missing." });
    }

    const requestId = parseInt(req.params.requestId, 10);
    if (isNaN(requestId) || requestId <= 0) {
      return res.status(400).json({ error: "Invalid request id." });
    }

    const [reqRows] = await db.query(
      "SELECT * FROM cancellation_requests WHERE id = ? AND status = 'pending'",
      [requestId],
    );
    if (reqRows.length === 0) {
      return res.status(404).json({ error: "Pending request not found." });
    }

    const cr = reqRows[0];
    const bookingId = cr.booking_id;

    await db.query("DELETE FROM bookings WHERE id = ?", [bookingId]);
    await db.query(
      `UPDATE cancellation_requests
       SET status = 'approved', resolved_at = NOW()
       WHERE id = ?`,
      [requestId],
    );

    return res.json({
      success: true,
      message: "Booking cancelled and request approved.",
    });
  } catch (error) {
    console.error("approveCancellationRequest:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const denyCancellationRequest = async (req, res) => {
  try {
    if (env.features.useFirebaseBookingReads) {
      const requestId = parseInt(req.params.requestId, 10);
      if (isNaN(requestId) || requestId <= 0) {
        return res.status(400).json({ error: "Invalid request id." });
      }
      const operatorNote =
        typeof req.body?.operator_note === "string"
          ? req.body.operator_note.trim().slice(0, 2000)
          : null;
      await updateCancellationRequestStatusInFirestore({
        requestId,
        status: "denied",
        operatorNote,
      });
      return res.json({ success: true, message: "Cancellation request denied." });
    }

    if (!(await hasTable(db, "cancellation_requests"))) {
      return res.status(503).json({ error: "Cancellation requests table missing." });
    }

    const requestId = parseInt(req.params.requestId, 10);
    if (isNaN(requestId) || requestId <= 0) {
      return res.status(400).json({ error: "Invalid request id." });
    }

    const operatorNote =
      typeof req.body?.operator_note === "string"
        ? req.body.operator_note.trim().slice(0, 2000)
        : null;

    const [result] = await db.query(
      `UPDATE cancellation_requests
       SET status = 'denied', resolved_at = NOW(), operator_note = ?
       WHERE id = ? AND status = 'pending'`,
      [operatorNote, requestId],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Pending request not found." });
    }

    return res.json({ success: true, message: "Cancellation request denied." });
  } catch (error) {
    console.error("denyCancellationRequest:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

router.get("/operator/cancellation-requests", listCancellationRequests);
router.get("/admin/cancellation-requests", listCancellationRequests);
router.get("/operator/cancellation-requests/pending-count", pendingCountHandler);
router.get("/admin/cancellation-requests/pending-count", pendingCountHandler);

router.post(
  "/operator/cancellation-requests/:requestId/approve",
  approveCancellationRequest,
);
router.post("/admin/cancellation-requests/:requestId/approve", approveCancellationRequest);

router.post("/operator/cancellation-requests/:requestId/deny", denyCancellationRequest);
router.post("/admin/cancellation-requests/:requestId/deny", denyCancellationRequest);

module.exports = router;
module.exports.customerCreateCancellationRequest = customerCreateCancellationRequest;
