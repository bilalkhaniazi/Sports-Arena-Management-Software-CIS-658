# Cross Courts Frontend Route Map

## Goal

Reshape the current frontend into three route groups:

- public customer-facing routes
- arena operator routes
- platform admin routes

The current dashboard shell should remain the starting point for operator and admin workspaces because `src/layout/DefaultLayout.tsx`, `src/pages/Dashboard/ECommerce.tsx`, `src/pages/BookingManagement`, `src/pages/BookingHistory`, `src/pages/BookingSettings`, and `src/pages/CustomMessage` already match back-office workflows.

## Current State

Current `src/App.tsx` exposes:

- `/auth/signin`
- `/auth/signup`
- dashboard index route
- `/booking-management`
- `/booking-history`
- `/booking-settings`
- `/custom-message`

Current `src/common/ProtectedRoute.tsx` checks only whether a token exists and whether `/api/protected` accepts it. It does not yet enforce role-aware access or route scoping.

## Target Route Groups

## Public User Routes

These routes should be available without operator or admin access.

```text
/
/arenas
/arenas/:arenaSlug
/arenas/:arenaSlug/courts/:courtId
/checkout
/bookings
/bookings/:bookingId
/messages
/profile
/auth/login
/auth/register
```

Recommended mapping:

- `/` -> marketing landing page with city search and featured arenas
- `/arenas` -> searchable arena listing
- `/arenas/:arenaSlug` -> arena detail with sport tabs, courts, images, and availability
- `/arenas/:arenaSlug/courts/:courtId` -> focused availability browser if the detail page becomes too large
- `/checkout` -> booking drawer/page with mock payment
- `/bookings` -> customer booking list
- `/bookings/:bookingId` -> booking detail with reschedule or cancel actions
- `/messages` -> user chat inbox across bookings and arenas
- `/profile` -> account settings, saved arenas, preferences

## Operator Routes

These routes should be nested under one protected dashboard layout.

```text
/operator
/operator/bookings
/operator/bookings/history
/operator/slots
/operator/courts
/operator/customers
/operator/messages
/operator/reports
/operator/profile
```

Recommended reuse of current pages:

- `/operator` -> reuse `src/pages/Dashboard/ECommerce.tsx` as the operator KPI dashboard
- `/operator/bookings` -> adapt `src/pages/BookingManagement`
- `/operator/bookings/history` -> adapt `src/pages/BookingHistory`
- `/operator/slots` -> adapt `src/pages/BookingSettings`
- `/operator/messages` -> adapt `src/pages/CustomMessage`

New pages still needed:

- `/operator/courts` for court and sport management
- `/operator/customers` for customer list and notes
- `/operator/reports` for arena-scoped summaries
- `/operator/profile` for branch metadata and settings

## Admin Routes

These routes should reuse the same layout shell but present global scope and admin-only navigation.

```text
/admin
/admin/arenas
/admin/operators
/admin/users
/admin/bookings
/admin/messages
/admin/reports
/admin/settings
```

Recommended mapping:

- `/admin` -> reuse `src/pages/Dashboard/ECommerce.tsx` with global platform data
- `/admin/bookings` -> extend `src/pages/BookingHistory` into global oversight
- `/admin/messages` -> extend `src/pages/CustomMessage` into audit and broadcast tooling

New admin pages still needed:

- `/admin/arenas`
- `/admin/operators`
- `/admin/users`
- `/admin/reports`
- `/admin/settings`

## Shared Auth Routes

Move auth to role-aware entry points:

```text
/auth/login
/auth/register
/auth/operator-login
/auth/admin-login
```

Implementation options:

- One screen with tabs for `customer`, `operator`, and `admin`
- One login screen that detects role after authentication and redirects accordingly

Preferred near-term option:

- Keep a single login page component.
- Add role-aware redirect handling after login.
- Keep customer registration only on `/auth/register`.

## Layout Strategy

Use separate shells even if they share low-level UI pieces.

Suggested structure:

```text
src/layouts/PublicLayout.tsx
src/layouts/BackofficeLayout.tsx
src/layouts/AdminLayout.tsx
```

Near-term simplification:

- Rename or reuse `DefaultLayout` as the back-office shell.
- Introduce a simpler `PublicLayout`.
- Add role-based sidebar configuration so operator and admin can share most layout chrome while seeing different menu items.

## Route Guard Strategy

Replace the current authentication-only guard with layered guards.

Suggested structure:

```text
src/common/ProtectedRoute.tsx
src/common/RequireRole.tsx
src/common/RequireArenaScope.tsx
```

Responsibilities:

- `ProtectedRoute` verifies a session exists.
- `RequireRole` checks `admin`, `operator`, or `customer`.
- `RequireArenaScope` ensures operators only access assigned arenas.

## Suggested `App.tsx` Structure

The app router should move from a flat list of pages to nested route trees.

```tsx
<Routes>
  <Route element={<PublicLayout />}>
    <Route path="/" element={<HomePage />} />
    <Route path="/arenas" element={<ArenaListPage />} />
    <Route path="/arenas/:arenaSlug" element={<ArenaDetailPage />} />
    <Route path="/checkout" element={<CheckoutPage />} />
  </Route>

  <Route path="/auth">
    <Route path="login" element={<LoginPage />} />
    <Route path="register" element={<RegisterPage />} />
  </Route>

  <Route element={<ProtectedRoute />}>
    <Route path="/operator" element={<BackofficeLayout role="operator" />}>
      <Route index element={<OperatorDashboardPage />} />
      <Route path="bookings" element={<OperatorBookingsPage />} />
      <Route path="slots" element={<OperatorSlotsPage />} />
    </Route>

    <Route path="/admin" element={<BackofficeLayout role="admin" />}>
      <Route index element={<AdminDashboardPage />} />
      <Route path="arenas" element={<ArenaManagementPage />} />
      <Route path="reports" element={<AdminReportsPage />} />
    </Route>
  </Route>
</Routes>
```

## Data And API Boundaries

Frontend route groups should align with API clients rather than all sharing one generic service layer.

Suggested client folders:

```text
src/api/auth.ts
src/api/publicArenas.ts
src/api/customerBookings.ts
src/api/operatorBookings.ts
src/api/operatorSlots.ts
src/api/adminArenas.ts
src/api/adminReports.ts
src/api/chat.ts
```

This keeps route ownership clear:

- public pages call public browsing and customer booking APIs
- operator pages call arena-scoped operator APIs
- admin pages call platform-wide admin APIs

## Redirect Rules

After login:

- `customer` -> `/arenas` or previous intended public destination
- `operator` -> `/operator`
- `admin` -> `/admin`

Fallback handling:

- unauthenticated user visiting `/operator/*` or `/admin/*` -> `/auth/login`
- operator visiting `/admin/*` -> `/operator`
- customer visiting back-office routes -> `/arenas`

## Recommended File-Level Migration

1. Update `src/common/ProtectedRoute.tsx` so it reads the authenticated user payload, not just token validity.
2. Introduce a shared auth store or query hook for `user`, `role`, and `assignedArenaIds`.
3. Refactor `src/App.tsx` into nested public, operator, and admin route groups.
4. Reuse current dashboard pages under `/operator/*` first.
5. Reuse the same dashboard shell for `/admin/*` with different menus and data sources.
6. Add new public customer pages after the back-office routes are stable.

## What Should Reuse Existing UI First

High-confidence reuse targets:

- `src/pages/Dashboard/ECommerce.tsx`
- `src/pages/BookingManagement/index.tsx`
- `src/pages/BookingHistory/index.tsx`
- `src/pages/BookingSettings/index.tsx`
- `src/pages/CustomMessage/index.tsx`

Low-confidence reuse targets:

- generic TailAdmin sample pages like `Tables`, `Calendar`, `Settings`, and `Profile`

These can be used as visual references, but they should not define product architecture.
