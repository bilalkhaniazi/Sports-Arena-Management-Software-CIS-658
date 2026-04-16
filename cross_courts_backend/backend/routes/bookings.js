const express = require("express");
const nodemailer = require("nodemailer");

const { db } = require("../config/db");
const env = require("../config/env");
const { formatApiError } = require("../utils/formatApiError");
const { hasColumn, hasTable } = require("../utils/schema");
const {
  normalizeBookingDate,
  findArenaHolidayLabelForCourtOnDate,
} = require("../utils/arenaHolidays");
const {
  getBookingAvailabilityFromFirestore,
  getBookedSlotsFromFirestore,
  getBookingHistoryFromFirestore,
  getCustomerBookingsFromFirestore,
} = require("../services/firestore/bookingReads");
const {
  createBookingInFirestore,
  updateBookingInFirestore,
  deleteBookingInFirestore,
  getBookingEmailFromFirestore,
} = require("../services/firestore/bookingWrites");

const router = express.Router();

// In-memory OTP store for demonstration (use a proper persistence layer in production)
const otpStore = {}; // { [bookingId]: { otp: string, expires: number } }

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const bookingAvailabilityHandler = async (req, res) => {
  try {
    let { court_id, date } = req.query;

    court_id = court_id ? parseInt(court_id, 10) : 1;
    date = normalizeBookingDate(date ? date : new Date().toISOString().split("T")[0]);

    if (env.features.useFirebaseBookingReads) {
      const payload = await getBookingAvailabilityFromFirestore({
        courtId: court_id,
        date,
      });
      return res.json(payload);
    }

    if (isNaN(court_id) || court_id <= 0) {
      return res
        .status(400)
        .json({ error: "Invalid court_id. It must be a positive number." });
    }

    const holidayInfo = await findArenaHolidayLabelForCourtOnDate(db, court_id, date);
    if (holidayInfo) {
      return res.json({
        slots: [],
        holiday: true,
        label: holidayInfo.label,
        message: holidayInfo.label
          ? `Closed: ${holidayInfo.label}`
          : "Closed for arena holiday",
        source: "holiday",
      });
    }

    const [bookings] = await db.query(
      `SELECT 
         id, 
         start_time, 
         end_time, 
         name, 
         online_price, 
         cash_price, 
         add_on, 
         add_on_price, 
         email, 
         phone 
       FROM bookings 
       WHERE court_id = ? 
         AND booking_date = ?`,
      [court_id, date],
    );

    const [customSlots] = await db.query(
      "SELECT * FROM custom_slots WHERE court_id = ? AND slot_date = ?",
      [court_id, date],
    );

    let slots = [];
    if (customSlots.length > 0) {
      slots = customSlots;
    } else {
      const [defaultSlots] = await db.query(
        "SELECT * FROM default_slots WHERE court_id = ?",
        [court_id],
      );
      slots = defaultSlots;
    }

    if (slots.length === 0) {
      return res.json({
        slots: [],
        source: "none",
        message:
          "No schedule for this court yet. Add a default template or apply custom slots in Booking Settings.",
      });
    }

    slots = slots.map((slot) => {
      const conflictingBooking = bookings.find(
        (booking) =>
          (slot.start_time >= booking.start_time &&
            slot.start_time < booking.end_time) ||
          (slot.end_time > booking.start_time &&
            slot.end_time <= booking.end_time) ||
          (slot.start_time <= booking.start_time &&
            slot.end_time >= booking.end_time),
      );

      return {
        ...slot,
        booked: conflictingBooking ? 1 : 0,
        booking_id: conflictingBooking ? conflictingBooking.id : -1,
        booking_details: conflictingBooking
          ? {
              name: conflictingBooking.name,
              online_price: conflictingBooking.online_price,
              cash_price: conflictingBooking.cash_price,
              add_on: conflictingBooking.add_on,
              add_on_price: conflictingBooking.add_on_price,
              email: conflictingBooking.email,
              phone: conflictingBooking.phone,
            }
          : {
              name: "",
              online_price: "",
              cash_price: "",
              add_on: "",
              add_on_price: "",
              email: "",
              phone: "",
            },
      };
    });

    return res.json({
      slots,
      source: customSlots.length > 0 ? "custom" : "default",
      message: "Returning slots with booking status.",
    });
  } catch (error) {
    console.error("Error fetching slots:", error);
    return res
      .status(500)
      .json({ error: formatApiError(error) });
  }
};

const createBookingHandler = async (req, res) => {
  try {
    const {
      court_id,
      start_time,
      end_time,
      name,
      phone,
      email,
      online_price,
      cash_price,
      add_on,
      add_on_price,
      booking_date,
      payment_method: paymentMethodRaw,
    } = req.body;

    if (
      !court_id ||
      !start_time ||
      !end_time ||
      !name ||
      !phone ||
      !email ||
      online_price === undefined ||
      cash_price === undefined ||
      add_on === undefined ||
      add_on_price === undefined ||
      !booking_date
    ) {
      return res.status(400).json({ error: "All fields are required." });
    }

    let payment_method = "online";
    if (paymentMethodRaw === "cash" || paymentMethodRaw === "online") {
      payment_method = paymentMethodRaw;
    }

    const on = Number(online_price) || 0;
    const cash = Number(cash_price) || 0;
    const addOn = add_on_price === null || add_on_price === undefined ? 0 : Number(add_on_price) || 0;
    const total_price =
      payment_method === "cash" ? Math.round((cash + addOn) * 100) / 100 : Math.round((on + addOn) * 100) / 100;

    if (env.features.useFirebaseBookingReads) {
      const created = await createBookingInFirestore({
        court_id,
        start_time,
        end_time,
        name,
        phone,
        email,
        online_price: on,
        cash_price: cash,
        add_on,
        add_on_price,
        booking_date,
        payment_method,
      });

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const client = require("twilio")(accountSid, authToken);
      const messageBody = `Hello ${name}, your booking for ${created.bookingDateNorm} from ${created.startTime} to ${created.endTime} has been confirmed. Thank you for choosing us!`;
      client.messages
        .create({
          body: messageBody,
          from: "whatsapp:+14155238886",
          to: `whatsapp:${parseInt(phone)}`,
        })
        .then((message) => {
          console.log("WhatsApp message sent with SID:", message.sid);
        })
        .catch((err) => {
          console.error("Error sending WhatsApp message:", err);
        });

      return res.json({ success: true, message: "Slot booked successfully!" });
    }

    const bookingDateNorm = normalizeBookingDate(booking_date);
    const holidayBlock = await findArenaHolidayLabelForCourtOnDate(
      db,
      court_id,
      bookingDateNorm,
    );
    if (holidayBlock) {
      return res.status(400).json({
        error:
          "This date is an arena holiday. Bookings are not available—choose another day.",
      });
    }

    const [existingBooking] = await db.query(
      "SELECT * FROM bookings WHERE court_id = ? AND start_time = ? AND end_time = ? AND booking_date = ?",
      [court_id, start_time, end_time, bookingDateNorm],
    );

    if (existingBooking.length > 0) {
      return res.status(400).json({ error: "Slot already booked." });
    }

    await db.query(
      `INSERT INTO bookings
       (court_id, start_time, end_time, name, phone, email, online_price, cash_price, add_on, add_on_price, payment_method, total_price, booking_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        court_id,
        start_time,
        end_time,
        name,
        phone,
        email,
        on,
        cash,
        add_on,
        add_on_price,
        payment_method,
        total_price,
        bookingDateNorm,
      ],
    );

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require("twilio")(accountSid, authToken);

    const messageBody = `Hello ${name}, your booking for ${bookingDateNorm} from ${start_time} to ${end_time} has been confirmed. Thank you for choosing us!`;

    client.messages
      .create({
        body: messageBody,
        from: "whatsapp:+14155238886",
        to: `whatsapp:${parseInt(phone)}`,
      })
      .then((message) => {
        console.log("WhatsApp message sent with SID:", message.sid);
      })
      .catch((err) => {
        console.error("Error sending WhatsApp message:", err);
      });

    return res.json({ success: true, message: "Slot booked successfully!" });
  } catch (error) {
    console.error("Error booking slot:", error);
    return res
      .status(500)
      .json({ error: formatApiError(error) });
  }
};

const updateBookingHandler = async (req, res) => {
  try {
    const url = String(req.originalUrl || req.url || "");
    if (url.includes("/customer/bookings/")) {
      return res.status(403).json({
        error:
          "Customers cannot edit bookings. Use “Request cancellation” if you need to cancel.",
      });
    }

    const { id } = req.params;
    const {
      name,
      phone,
      email,
      online_price,
      cash_price,
      add_on,
      add_on_price,
    } = req.body;

    if (
      !name ||
      !phone ||
      !email ||
      online_price === undefined ||
      cash_price === undefined ||
      add_on === undefined ||
      add_on_price === undefined
    ) {
      return res
        .status(400)
        .json({ error: "All fields are required for update." });
    }

    if (env.features.useFirebaseBookingReads) {
      await updateBookingInFirestore(id, {
        name,
        phone,
        email,
        online_price,
        cash_price,
        add_on,
        add_on_price,
      });
    } else {
      await db.query(
        `UPDATE bookings 
         SET 
           name = ?, 
           phone = ?, 
           email = ?, 
           online_price = ?, 
           cash_price = ?, 
           add_on = ?, 
           add_on_price = ? 
         WHERE id = ?`,
        [name, phone, email, online_price, cash_price, add_on, add_on_price, id],
      );
    }

    return res.json({ success: true, message: "Booking updated successfully!" });
  } catch (error) {
    console.error("Error updating booking:", error);
    return res
      .status(500)
      .json({ error: formatApiError(error) });
  }
};

const requestBookingCancellationOtpHandler = async (req, res) => {
  try {
    const { id } = req.params;
    let email = null;
    if (env.features.useFirebaseBookingReads) {
      email = await getBookingEmailFromFirestore(id);
      if (!email) {
        return res.status(404).json({ error: "Booking not found" });
      }
    } else {
      const [bookingRows] = await db.query("SELECT email FROM bookings WHERE id = ?", [id]);
      if (bookingRows.length === 0) {
        return res.status(404).json({ error: "Booking not found" });
      }
      email = bookingRows[0].email;
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000;

    otpStore[id] = { otp, expires };

    const mailOptions = {
      from: process.env.EMAIL_USERNAME,
      to: email,
      subject: "Your OTP for Booking Cancellation",
      text: `Hello,\n\nYour OTP for canceling your booking is: ${otp}\nThis OTP is valid for 10 minutes.\n\nThank you.`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending OTP email:", error);
        return res.status(500).json({ error: "Failed to send OTP email" });
      }

      console.log("OTP email sent: " + info.response);
      return res.json({ success: true, message: "OTP sent to email" });
    });
  } catch (error) {
    console.error("Error generating OTP:", error);
    return res
      .status(500)
      .json({ error: formatApiError(error) });
  }
};

const confirmBookingCancellationHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { otp } = req.body;

    if (!otp) {
      return res.status(400).json({ error: "OTP is required" });
    }

    const stored = otpStore[id];

    if (!stored) {
      return res
        .status(400)
        .json({ error: "No OTP generated for this booking" });
    }

    if (Date.now() > stored.expires) {
      delete otpStore[id];
      return res.status(400).json({ error: "OTP expired" });
    }

    if (stored.otp !== otp) {
      return res.status(400).json({ error: "Incorrect OTP" });
    }

    if (env.features.useFirebaseBookingReads) {
      await deleteBookingInFirestore(id);
    } else {
      await db.query("DELETE FROM bookings WHERE id = ?", [id]);
    }
    delete otpStore[id];

    return res.json({ success: true, message: "Booking canceled successfully!" });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res
      .status(500)
      .json({ error: formatApiError(error) });
  }
};

const bookedSlotsHandler = async (req, res) => {
  try {
    const { court_id, date } = req.query;

    if (env.features.useFirebaseBookingReads) {
      const bookedSlots = await getBookedSlotsFromFirestore({ courtId: court_id, date });
      return res.json({ bookedSlots });
    }

    const [bookedSlots] = await db.query(
      "SELECT start_time, end_time FROM bookings WHERE court_id = ? AND booking_date = ?",
      [court_id, date],
    );

    return res.json({ bookedSlots });
  } catch (error) {
    console.error("Error fetching booked slots:", error);
    return res
      .status(500)
      .json({ error: formatApiError(error) });
  }
};

const normalizeTimeParam = (t) => {
  if (t == null || String(t).trim() === "") return null;
  const s = String(t).trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return s;
  return s;
};

const bookingHistoryHandler = async (req, res) => {
  try {
    if (env.features.useFirebaseBookingReads) {
      const bookings = await getBookingHistoryFromFirestore(req.query || {});
      return res.json(bookings);
    }

    const {
      arena_id: arenaIdRaw,
      court_id: courtIdRaw,
      date_from: dateFrom,
      date_to: dateTo,
      time_from: timeFromRaw,
      time_to: timeToRaw,
      q,
    } = req.query;

    const bookingHasArenaId = await hasColumn(db, "bookings", "arena_id");
    const arenaIdForFilter = bookingHasArenaId
      ? "COALESCE(c.arena_id, b.arena_id)"
      : "c.arena_id";
    const arenaJoinOn = bookingHasArenaId
      ? "ar.id = COALESCE(c.arena_id, b.arena_id)"
      : "ar.id = c.arena_id";

    const conditions = [];
    const params = [];

    let sql = `
      SELECT
        b.*,
        c.name AS court_name,
        c.arena_id AS court_arena_id,
        ar.name AS arena_name
      FROM bookings b
      LEFT JOIN courts c ON c.id = b.court_id
      LEFT JOIN arenas ar ON ${arenaJoinOn}
    `;

    if (arenaIdRaw != null && String(arenaIdRaw).trim() !== "" && String(arenaIdRaw) !== "all") {
      const aid = parseInt(String(arenaIdRaw), 10);
      if (!isNaN(aid) && aid > 0) {
        conditions.push(`${arenaIdForFilter} = ?`);
        params.push(aid);
      }
    }

    if (courtIdRaw != null && String(courtIdRaw).trim() !== "" && String(courtIdRaw) !== "all") {
      const cid = parseInt(String(courtIdRaw), 10);
      if (!isNaN(cid) && cid > 0) {
        conditions.push("b.court_id = ?");
        params.push(cid);
      }
    }

    if (dateFrom) {
      conditions.push("b.booking_date >= ?");
      params.push(normalizeBookingDate(String(dateFrom)));
    }
    if (dateTo) {
      conditions.push("b.booking_date <= ?");
      params.push(normalizeBookingDate(String(dateTo)));
    }

    const timeFrom = normalizeTimeParam(timeFromRaw);
    const timeTo = normalizeTimeParam(timeToRaw);
    if (timeFrom) {
      conditions.push("b.start_time >= ?");
      params.push(timeFrom);
    }
    if (timeTo) {
      conditions.push("b.start_time <= ?");
      params.push(timeTo);
    }

    const searchQ = q != null ? String(q).trim() : "";
    if (searchQ) {
      const term = `%${searchQ}%`;
      conditions.push("(b.name LIKE ? OR b.phone LIKE ? OR b.email LIKE ? OR b.add_on LIKE ?)");
      params.push(term, term, term, term);
    }

    if (conditions.length) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += " ORDER BY b.booking_date DESC, b.start_time DESC, b.id DESC";

    const [bookings] = await db.query(sql, params);
    return res.json(bookings);
  } catch (error) {
    console.error("Error fetching booking history:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const deleteBookingBackofficeHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid booking id." });
    }
    if (env.features.useFirebaseBookingReads) {
      const deleted = await deleteBookingInFirestore(id);
      if (!deleted) {
        return res.status(404).json({ error: "Booking not found." });
      }
    } else {
      const [result] = await db.query("DELETE FROM bookings WHERE id = ?", [id]);
      if (!result.affectedRows) {
        return res.status(404).json({ error: "Booking not found." });
      }
    }
    return res.json({ success: true, message: "Booking deleted." });
  } catch (error) {
    console.error("Error deleting booking:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

const customerBookingLookupHandler = async (req, res) => {
  try {
    const { email, search, fromDate, toDate } = req.query;

    if (!email) {
      return res.status(400).json({ error: "email is required for booking lookup" });
    }

    if (env.features.useFirebaseBookingReads) {
      const bookings = await getCustomerBookingsFromFirestore({
        email,
        search,
        fromDate,
        toDate,
      });
      return res.json({ bookings });
    }

    const filters = ["b.email = ?"];
    const params = [email];

    if (fromDate) {
      filters.push("b.booking_date >= ?");
      params.push(fromDate);
    }

    if (toDate) {
      filters.push("b.booking_date <= ?");
      params.push(toDate);
    }

    if (search) {
      filters.push(
        "(a.name LIKE ? OR c.name LIKE ? OR b.add_on LIKE ? OR b.name LIKE ?)",
      );
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const hasCr = await hasTable(db, "cancellation_requests");
    const crSelect = hasCr
      ? `,
          (SELECT cr2.status FROM cancellation_requests cr2
           WHERE cr2.booking_id = b.id AND cr2.status = 'pending' LIMIT 1) AS cancellation_pending_status,
          (SELECT cr3.operator_note FROM cancellation_requests cr3
           WHERE cr3.booking_id = b.id AND cr3.status = 'denied'
           ORDER BY cr3.id DESC LIMIT 1) AS cancellation_last_denial_note`
      : "";

    const [bookings] = await db.query(
      `
        SELECT
          b.*,
          c.name AS court_name,
          a.name AS arena_name,
          a.city AS arena_city
          ${crSelect}
        FROM bookings b
        LEFT JOIN courts c ON c.id = b.court_id
        LEFT JOIN arenas a ON a.id = b.arena_id
        WHERE ${filters.join(" AND ")}
        ORDER BY b.booking_date DESC, b.id DESC
      `,
      params,
    );

    return res.json({ bookings });
  } catch (error) {
    console.error("Error looking up customer bookings:", error);
    return res.status(500).json({ error: formatApiError(error) });
  }
};

router.get("/booking", bookingAvailabilityHandler);
router.get("/operator/bookings/availability", bookingAvailabilityHandler);

router.post("/book-slot", createBookingHandler);
router.post("/operator/bookings", createBookingHandler);

router.put("/edit-booking/:id", updateBookingHandler);
router.put("/operator/bookings/:id", updateBookingHandler);
router.put("/admin/bookings/:id", updateBookingHandler);
router.put("/customer/bookings/:id", updateBookingHandler);

router.post(
  "/delete-booking/:id/generate-otp",
  requestBookingCancellationOtpHandler,
);
router.post(
  "/operator/bookings/:id/cancel/request",
  requestBookingCancellationOtpHandler,
);

router.post("/delete-booking/:id/verify-otp", confirmBookingCancellationHandler);
router.post(
  "/operator/bookings/:id/cancel/confirm",
  confirmBookingCancellationHandler,
);

router.get("/booked-slots", bookedSlotsHandler);
router.get("/operator/bookings/booked-slots", bookedSlotsHandler);

router.get("/booking-history", bookingHistoryHandler);
router.get("/customer/bookings", customerBookingLookupHandler);

const cancellationRequestsRouter = require("./cancellationRequests");
router.post(
  "/customer/bookings/:id/cancellation-request",
  cancellationRequestsRouter.customerCreateCancellationRequest,
);

router.get("/operator/bookings/history", bookingHistoryHandler);
router.get("/admin/bookings/history", bookingHistoryHandler);

router.delete("/operator/bookings/:id", deleteBookingBackofficeHandler);
router.delete("/admin/bookings/:id", deleteBookingBackofficeHandler);
router.post("/operator/bookings/:id/delete", deleteBookingBackofficeHandler);
router.post("/admin/bookings/:id/delete", deleteBookingBackofficeHandler);

module.exports = router;
