const express = require("express");
const cors = require("cors");

const authRouter = require("./routes/auth");
const arenasRouter = require("./routes/arenas");
const bookingsRouter = require("./routes/bookings");
const courtsRouter = require("./routes/courts");
const reportsRouter = require("./routes/reports");
const messagingRouter = require("./routes/messaging");
const scheduleSettingsRouter = require("./routes/scheduleSettings");
const customerDirectoryRouter = require("./routes/customerDirectory");
const courtAddOnsRouter = require("./routes/courtAddOns");
const cancellationRequestsRouter = require("./routes/cancellationRequests");
const { formatApiError } = require("./utils/formatApiError");

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use("/api", authRouter);
app.use("/api", arenasRouter);
app.use("/api", bookingsRouter);
app.use("/api", courtsRouter);
app.use("/api", reportsRouter);
app.use("/api", messagingRouter);
app.use("/api", customerDirectoryRouter);
app.use("/api", scheduleSettingsRouter);
app.use("/api", courtAddOnsRouter);
app.use("/api", cancellationRequestsRouter);

app.use("/api", (req, res) => {
  res.status(404).json({
    error: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

const errorHandler = (err, req, res, next) => {
  console.error(err);
  const text = formatApiError(err);
  res.status(err.status || 500).json({ error: text, message: text });
};

app.use(errorHandler);

module.exports = app;
