# Cross Courts Backend Module Plan

## Goal

Replace the current all-in-one `cross_courts_backend/backend/index.js` server with a feature-oriented backend structure that supports:

- role-aware authentication
- arena-scoped operator access
- public browsing and booking
- platform-wide admin operations
- reporting and messaging

## Current Responsibility Map

The current `index.js` handles all of the following in one file:

- app bootstrapping and middleware
- MySQL pool creation
- JWT authentication and protected route checks
- registration and login
- custom message CRUD
- court lookup
- schedule lookup and editing
- slot reset logic
- booking lookup, booking creation, booking edit, booking delete
- OTP generation and email sending
- dashboard summary queries
- WhatsApp outbound messaging

This should be split into domain modules plus shared infrastructure.

## Target Folder Structure

```text
backend/
  src/
    app.js
    server.js
    config/
      env.js
      db.js
    middleware/
      auth.js
      errorHandler.js
      requireRole.js
      requireArenaAccess.js
    modules/
      auth/
        auth.routes.js
        auth.controller.js
        auth.service.js
        auth.repository.js
      arenas/
        arena.routes.js
        arena.controller.js
        arena.service.js
        arena.repository.js
      courts/
        court.routes.js
        court.controller.js
        court.service.js
        court.repository.js
      bookings/
        booking.routes.js
        booking.controller.js
        booking.service.js
        booking.repository.js
      reporting/
        reporting.routes.js
        reporting.controller.js
        reporting.service.js
        reporting.repository.js
      admin/
        admin.routes.js
        admin.controller.js
        admin.service.js
        admin.repository.js
      chat/
        chat.routes.js
        chat.controller.js
        chat.service.js
        chat.repository.js
    services/
      mailer.js
      whatsapp.js
      otpStore.js
```

## Shared Infrastructure

### `config/env.js`

Centralize:

- `PORT`
- `JWT_SECRET`
- DB credentials
- Twilio or WhatsApp provider credentials
- email credentials
- frontend CORS origin

### `config/db.js`

Move the MySQL pool into one module and export query helpers.

Responsibilities:

- create pool
- test connectivity on boot
- expose connection helpers for repositories

### `middleware/auth.js`

Responsibilities:

- verify JWT
- attach user to request context
- normalize auth failures

### `middleware/requireRole.js`

Responsibilities:

- enforce `admin`, `operator`, or `customer`
- support arrays like `requireRole(["admin", "operator"])`

### `middleware/requireArenaAccess.js`

Responsibilities:

- ensure the operator is assigned to the arena being modified
- prevent operators from reading or changing unrelated arena data

### `middleware/errorHandler.js`

Move the existing error middleware here and standardize the JSON error shape.

## Module Boundaries

## Auth Module

### Purpose

Own identity, login, session validation, and operator invitation flows.

### Responsibilities

- register customer accounts
- login all roles
- logout
- session validation
- password hashing
- JWT creation
- invite operator and force password setup later

### Move from current `index.js`

- `POST /api/register`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/protected`

### New target routes

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET /api/auth/me
POST /api/auth/operator-invite
POST /api/auth/password/setup
```

## Arenas Module

### Purpose

Own venue, branch, city, and media data for public browsing and admin management.

### Responsibilities

- list arenas publicly
- fetch arena detail for customers
- create and update arenas for admins
- assign operators to arenas
- manage city linkage and media

### New target routes

```text
GET /api/arenas
GET /api/arenas/:arenaId
POST /api/admin/arenas
PUT /api/admin/arenas/:arenaId
POST /api/admin/arenas/:arenaId/operators
GET /api/operator/arenas/:arenaId
```

## Courts Module

### Purpose

Own sports, courts, recurring schedules, date overrides, and availability generation.

### Responsibilities

- list courts for an arena
- manage court definitions
- read recurring schedules
- write custom schedule overrides
- generate bookable availability windows

### Move from current `index.js`

- `POST /api/get-courts`
- `GET /api/courts`
- `GET /api/slots`
- `POST /api/set-court-schedule`
- `GET /api/get-slots`
- `POST /api/reset-to-default`

### New target routes

```text
GET /api/arenas/:arenaId/courts
GET /api/courts/:courtId/availability
GET /api/operator/courts/:courtId/schedule
PUT /api/operator/courts/:courtId/schedule
POST /api/operator/courts/:courtId/overrides
DELETE /api/operator/courts/:courtId/overrides/:overrideId
GET /api/admin/sports
```

## Bookings Module

### Purpose

Own customer bookings, operator booking actions, cancellation, OTP validation, and booking timeline history.

### Responsibilities

- create booking
- validate slot conflicts
- fetch bookings by user, arena, court, or date
- update booking details
- cancel booking
- manage OTP flow if email verification remains
- expose booking history for dashboards and reports

### Move from current `index.js`

- `GET /api/booking`
- `POST /api/book-slot`
- `PUT /api/edit-booking/:id`
- `POST /api/delete-booking/:id/generate-otp`
- `POST /api/delete-booking/:id/verify-otp`
- `GET /api/booked-slots`
- `GET /api/booking-history`

### New target routes

```text
POST /api/bookings
GET /api/bookings/:bookingId
GET /api/customer/bookings
GET /api/operator/bookings
PUT /api/operator/bookings/:bookingId
POST /api/bookings/:bookingId/cancel/request
POST /api/bookings/:bookingId/cancel/confirm
GET /api/courts/:courtId/booked-slots
```

## Reporting Module

### Purpose

Own read-only KPI and trend endpoints for operator and admin dashboards.

### Responsibilities

- total bookings
- total revenue
- total courts
- unique customers
- recent bookings
- monthly booking trends
- occupancy summaries
- sport-wise and arena-wise rollups

### Move from current `index.js`

- `GET /api/summary/total-price`
- `GET /api/summary/total-bookings`
- `GET /api/summary/unique-users`
- `GET /api/summary/total-courts`
- `GET /api/last-five-bookings`
- `GET /api/bookings-per-month`

### New target routes

```text
GET /api/operator/reports/summary
GET /api/operator/reports/bookings-by-month
GET /api/operator/reports/recent-bookings
GET /api/admin/reports/summary
GET /api/admin/reports/arenas
GET /api/admin/reports/sports
```

## Admin Module

### Purpose

Own platform-wide operational controls that do not fit neatly into booking or arena CRUD.

### Responsibilities

- operator lifecycle management
- user management
- booking issue resolution
- platform settings
- audit endpoints

### Likely target routes

```text
GET /api/admin/users
PUT /api/admin/users/:userId/status
GET /api/admin/operators
PUT /api/admin/operators/:userId/status
GET /api/admin/bookings
PUT /api/admin/bookings/:bookingId/status
GET /api/admin/audit
```

This module will coordinate across repositories rather than own one single table.

## Chat Module

### Purpose

Own customer-to-arena conversation threads and operator or admin broadcasts.

### Responsibilities

- list conversations
- send messages
- mark messages read
- send arena broadcasts
- store templates or announcement history
- integrate with external delivery providers only through service adapters

### Move from current `index.js`

- `GET /api/custom-message`
- `PUT /api/custom-message`
- `POST /send-whatsapp`

### New target routes

```text
GET /api/chat/conversations
GET /api/chat/conversations/:conversationId/messages
POST /api/chat/conversations/:conversationId/messages
POST /api/operator/broadcasts
GET /api/operator/broadcasts
```

The current single `custom_message` row should become either:

- an operator broadcast draft per arena
- or a reusable message template owned by an operator or admin

## Service Layer Responsibilities

Use controllers for request parsing, services for business rules, and repositories for SQL.

### Controller

- parse params
- validate request shape
- call service
- shape HTTP response

### Service

- role checks that depend on business meaning
- booking conflict rules
- schedule generation
- cancellation policy checks
- data composition across repositories

### Repository

- plain SQL access
- no HTTP-specific logic
- minimal mapping from rows to domain objects

## Migration Strategy From `index.js`

1. Create `src/app.js` and move middleware wiring there without changing routes yet.
2. Extract DB and env config first.
3. Move auth endpoints into `modules/auth`.
4. Move court and schedule endpoints into `modules/courts`.
5. Move booking endpoints into `modules/bookings`.
6. Move summary endpoints into `modules/reporting`.
7. Move custom message and WhatsApp behavior into `modules/chat`.
8. Add `modules/arenas` and `modules/admin` once schema changes land.
9. Reduce `index.js` to server startup only, then rename to `server.js`.

## Backward Compatibility Guidance

During migration, keep a compatibility layer for old routes where necessary.

Examples:

- keep `/api/login` and proxy to `/api/auth/login`
- keep `/api/book-slot` and proxy to `/api/bookings`
- keep `/api/custom-message` and proxy to the chat or broadcasts module

This avoids breaking the current frontend while route groups are being updated incrementally.

## Immediate Refactor Priorities

Start with modules that already have stable behaviors:

- `auth`
- `courts`
- `bookings`
- `reporting`

Defer until the domain schema is ready:

- `arenas`
- `admin`
- richer `chat`

That sequencing lets the current system keep running while the product grows into the planned architecture.
