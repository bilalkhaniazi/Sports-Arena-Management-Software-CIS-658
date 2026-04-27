# Cross Courts Domain Model

## Purpose

This document defines the target product domain for turning Cross Courts from a single-dashboard booking tool into a multi-arena platform with public booking, operator workspaces, and platform-wide administration.

## Core Principles

- One shared identity system for all users.
- Arenas are the top-level business unit.
- Courts belong to arenas and are always tied to one sport.
- Bookings reference the user, arena, court, slot snapshot, and payment state.
- Scheduling supports both recurring availability and date-specific overrides.
- Messaging supports both booking-thread conversations and arena-wide announcements.

## Roles

### `users`

Use one `users` table for authentication and profile data.

Suggested fields:

- `id`
- `role` enum: `admin | operator | customer`
- `status` enum: `active | invited | suspended | archived`
- `full_name`
- `email` unique
- `phone`
- `password_hash`
- `last_login_at`
- `created_at`
- `updated_at`

Notes:

- `admin` users manage the whole platform.
- `operator` users do not self-register; they are invited and assigned by admins.
- `customer` users can self-register and maintain their own booking history and profile.

### `user_profiles`

Keep optional customer-facing data separate from auth fields.

Suggested fields:

- `user_id`
- `avatar_url`
- `city_id`
- `preferred_sports_json`
- `marketing_opt_in`
- `notification_preferences_json`

## Arena Hierarchy

### `cities`

Search and browse should be city-first.

Suggested fields:

- `id`
- `name`
- `slug`
- `country_code`
- `latitude`
- `longitude`

### `arenas`

An arena is one venue or branch.

Suggested fields:

- `id`
- `name`
- `slug`
- `status` enum: `draft | active | inactive`
- `city_id`
- `address_line_1`
- `address_line_2`
- `latitude`
- `longitude`
- `description`
- `opening_time`
- `closing_time`
- `booking_window_days`
- `cancellation_policy`
- `contact_email`
- `contact_phone`
- `created_by`
- `created_at`
- `updated_at`

### `arena_operators`

Use a join table so one operator can manage multiple arenas if needed.

Suggested fields:

- `id`
- `arena_id`
- `user_id`
- `access_level` enum: `manager | staff`
- `is_primary`
- `created_at`

### `arena_media`

Store visuals separately from arena metadata.

Suggested fields:

- `id`
- `arena_id`
- `media_type` enum: `logo | hero | gallery`
- `asset_url`
- `sort_order`
- `alt_text`

## Sports And Courts

### `sports`

A controlled list keeps naming consistent.

Suggested fields:

- `id`
- `name`
- `slug`
- `status`

Seed values:

- `Futsal`
- `Cricket`
- `Baseball`
- `Paddle` or `Padel` once a final naming decision is made

### `courts`

Each court belongs to one arena and one sport.

Suggested fields:

- `id`
- `arena_id`
- `sport_id`
- `name`
- `surface_type`
- `capacity`
- `status` enum: `active | maintenance | inactive`
- `base_price`
- `currency_code`
- `description`
- `sort_order`
- `created_at`
- `updated_at`

## Scheduling

The current split between default slots, custom slots, and court schedule should become a clearer scheduling model.

### `court_schedules`

Recurring weekly defaults per court.

Suggested fields:

- `id`
- `court_id`
- `day_of_week` integer `0-6`
- `start_time`
- `end_time`
- `slot_duration_minutes`
- `buffer_minutes`
- `is_active`

### `court_slot_overrides`

Date-specific changes, closures, or custom availability.

Suggested fields:

- `id`
- `court_id`
- `override_date`
- `override_type` enum: `closed | custom_hours | custom_slots`
- `start_time` nullable
- `end_time` nullable
- `reason`
- `created_by`
- `created_at`

### `court_slots`

Optional materialized slots if the product needs faster lookups, conflict detection, or analytics.

Suggested fields:

- `id`
- `court_id`
- `arena_id`
- `slot_date`
- `start_time`
- `end_time`
- `source_type` enum: `schedule | override | manual`
- `availability_status` enum: `open | held | booked | blocked`

If materialized slots are not introduced in phase 1, build them virtually from `court_schedules` and `court_slot_overrides`.

## Booking Domain

### `bookings`

Bookings should stop storing customer details only as loose strings and instead capture identity plus a snapshot of the reservation details.

Suggested fields:

- `id`
- `booking_number`
- `customer_user_id`
- `arena_id`
- `court_id`
- `sport_id`
- `slot_date`
- `start_time`
- `end_time`
- `booking_status` enum: `pending | confirmed | cancelled | completed | no_show`
- `payment_status` enum: `unpaid | pending | paid | refunded`
- `payment_method` enum: `mock_online | cash | mixed`
- `subtotal_amount`
- `add_on_amount`
- `discount_amount`
- `total_amount`
- `customer_name_snapshot`
- `customer_email_snapshot`
- `customer_phone_snapshot`
- `notes`
- `created_by_user_id`
- `created_at`
- `updated_at`

### `booking_add_ons`

Break add-ons out of the single `add_on` string.

Suggested fields:

- `id`
- `booking_id`
- `label`
- `unit_price`
- `quantity`
- `total_price`

### `booking_events`

Track important transitions for audit trails and support.

Suggested fields:

- `id`
- `booking_id`
- `event_type` enum: `created | updated | confirmed | cancelled | otp_sent | payment_marked | note_added`
- `performed_by_user_id`
- `payload_json`
- `created_at`

## Messaging Domain

### `conversations`

A conversation may be arena-wide or booking-specific.

Suggested fields:

- `id`
- `arena_id`
- `booking_id` nullable
- `customer_user_id`
- `assigned_operator_user_id` nullable
- `channel_type` enum: `platform_chat | announcement | support`
- `status` enum: `open | closed | archived`
- `last_message_at`
- `created_at`

### `conversation_participants`

Suggested fields:

- `id`
- `conversation_id`
- `user_id`
- `participant_role` enum: `customer | operator | admin`

### `messages`

Suggested fields:

- `id`
- `conversation_id`
- `sender_user_id`
- `message_type` enum: `text | system | attachment`
- `body`
- `metadata_json`
- `sent_at`
- `read_at` nullable

### `broadcasts`

Use broadcasts for operator announcements or admin-wide notices.

Suggested fields:

- `id`
- `arena_id` nullable
- `created_by_user_id`
- `audience_type` enum: `arena_customers | selected_customers | operators | all_users`
- `title`
- `body`
- `status` enum: `draft | sent | cancelled`
- `sent_at`

## Reporting View Of The Domain

Reporting should aggregate from normalized entities rather than ad hoc booking queries.

Primary rollups:

- Arena occupancy by court, sport, day, and hour
- Revenue by arena, operator, sport, and payment method
- Booking funnel by status
- Customer retention by city and arena
- Messaging volume and response times

## Mapping From Current Tables

- Current `users` becomes role-aware shared identity.
- Current `courts` becomes `courts` plus `sports` and `arenas` foreign keys.
- Current `default_slots`, `custom_slots`, and `court_schedule` map to `court_schedules` and `court_slot_overrides`.
- Current `bookings` becomes normalized `bookings`, `booking_add_ons`, and `booking_events`.
- Current `custom_message` becomes part of `broadcasts` or seeded arena messaging content.

## Immediate Phase-1 Schema Priorities

Build these first:

- `users.role`
- `users.status`
- `arenas`
- `arena_operators`
- `sports`
- `courts.arena_id`
- `courts.sport_id`
- normalized `bookings`
- `court_schedules`
- `court_slot_overrides`

Defer until later phases:

- `court_slots` materialization
- rich `messages` attachments
- advanced notification preference storage
- analytics summary tables
