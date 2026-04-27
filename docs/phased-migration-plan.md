# Cross Courts Phased Migration Plan

## Goal

Deliver the platform in four phases with each phase leaving the codebase in a usable state:

1. foundation
2. operator tools
3. customer app
4. admin and global controls

This sequencing matches the current codebase because the existing dashboard, booking management, booking history, booking settings, and custom messaging screens already provide a workable back-office starting point.

## Phase 1: Foundation

### Objectives

- establish roles and session shape
- define multi-arena ownership
- create route groups without fully replacing existing screens
- start breaking the backend monolith into modules
- introduce environment-based configuration

### Frontend Deliverables

- refactor `src/App.tsx` into public, operator, and admin route groups
- update `src/common/ProtectedRoute.tsx` to read authenticated user role
- add role-aware redirect after login
- keep current dashboard pages mounted under `/operator/*` first
- create placeholder pages and menus for future `/admin/*` and public routes

### Backend Deliverables

- add `users.role` and `users.status`
- introduce `arenas`, `arena_operators`, and `sports`
- add `arena_id` and `sport_id` to courts and bookings
- extract `auth`, `courts`, `bookings`, and `reporting` modules
- move secrets and URLs to env config

### Compatibility Rules

- keep old API endpoints working while new route groups are introduced
- keep current operator-facing screens functional during route reorganization
- avoid schema changes that require immediate full frontend rewrites

### Exit Criteria

- login returns role-aware user payload
- operator routes are protected and usable
- core schema supports arena-aware bookings
- backend no longer depends on one giant `index.js` for new work

## Phase 2: Operator Tools

### Objectives

- turn the current dashboard into a true arena operator workspace
- make bookings, slots, and messaging arena-scoped
- add court and sport administration

### Frontend Deliverables

- convert `ECommerce` into an operator dashboard with today bookings, occupancy, and revenue widgets
- convert `BookingManagement` into operator booking operations
- convert `BookingSettings` into slot and schedule management
- convert `BookingHistory` into filtered arena booking history
- convert `CustomMessage` into arena broadcast and inbox tooling
- add new operator pages for courts, customers, reports, and profile

### Backend Deliverables

- implement operator-scoped booking list and booking edit APIs
- implement recurring schedule and override APIs
- implement court CRUD scoped to assigned arenas
- implement broadcast template and conversation foundations
- add operator report summaries by arena and sport

### Data Migration Focus

- move existing courts into an arena
- seed sports for all existing courts
- backfill `arena_id` and `sport_id` in bookings
- convert current schedule tables into the target scheduling model

### Exit Criteria

- operator can manage one assigned arena end to end
- dashboard data is scoped by arena
- slot conflicts and booking edits work with the new schema
- messaging is no longer a single global custom message row

## Phase 3: Customer App

### Objectives

- launch the public discovery and booking experience
- let customers self-register, browse arenas, book slots, and view their history
- introduce booking-thread chat

### Frontend Deliverables

- build landing page and arena listing
- build arena detail with sports, courts, images, and availability
- build booking checkout with mock payment status
- build customer booking history and booking detail pages
- build customer inbox and profile pages

### Backend Deliverables

- public arena listing and detail APIs
- customer booking creation and cancellation APIs
- customer booking history APIs
- chat conversation and message APIs
- notification hooks for booking confirmation and updates

### UX Rules

- customer registration remains self-service
- operators cannot self-register
- customer booking states must visibly show `pending`, `confirmed`, `cancelled`, and `completed`

### Exit Criteria

- customer can discover arenas by city
- customer can book an available slot and see it in booking history
- customer can message the arena from the booking flow
- operator sees customer-created bookings in the back office

## Phase 4: Admin And Global Controls

### Objectives

- add platform-wide oversight across arenas, users, operators, bookings, and reports
- complete the split between operator-scoped and global administration

### Frontend Deliverables

- build admin dashboard on top of the existing back-office shell
- add arena management and operator assignment screens
- add user management and booking oversight screens
- add global reports and settings pages

### Backend Deliverables

- admin arena CRUD and operator assignment APIs
- admin user lifecycle endpoints
- global booking oversight endpoints
- cross-arena reporting endpoints
- audit and messaging oversight endpoints

### Exit Criteria

- admin can create arenas and assign operators
- admin can inspect users and bookings across the whole platform
- global reports aggregate correctly across arenas and sports
- operator and admin permissions are strictly separated

## Recommended Milestone Order Inside Each Phase

For every phase, deliver in this order:

1. schema or API contract changes
2. backend module endpoints
3. frontend route wiring
4. UI adaptation of existing screens
5. reporting and polish

This reduces churn because the route and UI layers sit on stable contracts.

## Migration Risks And Controls

### Risk: Existing dashboard breaks during route changes

Control:

- keep the current screens mounted under operator routes before redesigning them

### Risk: Monolith split creates regressions

Control:

- move one module at a time and preserve old route aliases temporarily

### Risk: Data model changes orphan existing bookings

Control:

- add nullable foreign keys first, backfill data, then tighten constraints later

### Risk: Chat and messaging grows too early

Control:

- start with a simple conversation plus broadcast model, not full realtime complexity

## Definition Of Done Across The Full Program

The migration is complete when:

- all routes are role-grouped
- all critical APIs live in modules rather than one server file
- arenas, courts, sports, bookings, and messaging are arena-aware
- operator and admin experiences share a shell but not permissions
- customers can complete the browse-to-book flow without using back-office screens
