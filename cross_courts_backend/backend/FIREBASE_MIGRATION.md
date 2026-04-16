# Firebase Migration Runbook

This project currently uses MySQL. The first migration phase keeps MySQL code unchanged while copying data to Firestore.

## 1) Create Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Create a new project (or pick existing).
3. In project settings, copy:
   - Project ID
   - Storage bucket (if needed)
4. In Firebase Console, enable **Firestore Database** (Native mode).

## 2) Create service account key

1. In Firebase Console -> Project settings -> Service accounts.
2. Click **Generate new private key** and download JSON.
3. Place the file in backend, for example:
   - `backend/firebase-service-account.json`

## 3) Update backend env

Edit `backend/.env` and fill:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_DATABASE_URL` (optional; used for Realtime DB only)
- `FIREBASE_STORAGE_BUCKET` (optional)
- `FIREBASE_SERVICE_ACCOUNT_PATH` (example: `firebase-service-account.json`)
- `FIREBASE_COLLECTION_PREFIX` (optional, example: `dev_`)

## 4) Run migration script

From `backend/`:

```bash
npm run db:migrate:firebase
```

What the script does:

- Reads all supported MySQL tables.
- Writes each row to Firestore collection named after the table.
- Uses row `id` as Firestore document ID when available.
- Adds metadata fields:
  - `_sourceTable`
  - `_migratedAt`

## 5) Validate migrated data

1. In Firestore, verify collections:
   - `users`, `sports`, `arenas`, `arena_operators`, `arena_holidays`
   - `courts`, `default_slots`, `custom_slots`, `court_schedule`, `court_add_ons`
   - `bookings`, `cancellation_requests`, `custom_message`
2. Compare row/document counts with MySQL.
3. Spot-check critical flows:
   - Login users are present.
   - Arena/court linkage is intact (`arena_id`, `sport_id`, `court_id`).
   - Booking and cancellation records exist.

## 6) Important safety notes

- Use `FIREBASE_COLLECTION_PREFIX=dev_` in first runs to avoid polluting production collections.
- This phase does not yet switch API routes to Firestore reads/writes.
- Keep MySQL as source of truth until route-by-route migration is completed and tested.
