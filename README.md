# Cross Courts - Setup and Run Guide

This project has two applications:

- `CrossCourts-main/CrossCourts-main` (frontend - React + Vite)
- `cross_courts_backend/backend` (backend - Node.js + Express + MySQL/Firebase)

## 1) Install Required Software

Install these dependencies on your machine:

- [Node.js](https://nodejs.org/) (LTS recommended, includes npm)
- MySQL or MariaDB (for SQL mode)
- Terminal app:
  - Windows: PowerShell
  - macOS: Terminal

Optional (only if using Firebase mode):

- Firebase service account JSON file

## 2) First-Time Setup (Fastest for New Users)

From the project root (`Cross Courts`), use this flow:

1. Install dependencies
2. Configure backend `.env`
3. Start both apps

### Windows

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
notepad .\cross_courts_backend\backend\.env
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

### macOS

```bash
chmod +x ./install.sh ./run.sh
./install.sh
open ./cross_courts_backend/backend/.env
./run.sh
```

## 3) Quick Install (Recommended)

From the project root (`Cross Courts`), run:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

This installs npm dependencies for both frontend and backend.

## 4) Backend Environment Configuration

1. Go to `cross_courts_backend/backend`
2. Copy `.env.example` to `.env`
3. Fill in your real values (database, JWT, Twilio, email, and optional Firebase settings)

## 5) Run the App

### One-Command Run (Recommended)

From the project root (`Cross Courts`), run:

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

macOS:

```bash
./run.sh
```

This starts backend and frontend in separate PowerShell windows.

### Manual Run

Open two terminals.

### Terminal 1 - Backend

```powershell
cd .\cross_courts_backend\backend
npm start
```

Backend runs on `http://localhost:5000` by default.

### Terminal 2 - Frontend

```powershell
cd .\CrossCourts-main\CrossCourts-main
npm run dev
```

Frontend runs on `http://localhost:5173`.

## 6) Useful Commands

Project root (`Cross Courts`):

- Windows install: `powershell -ExecutionPolicy Bypass -File .\install.ps1`
- Windows run: `powershell -ExecutionPolicy Bypass -File .\run.ps1`
- macOS install: `./install.sh`
- macOS run: `./run.sh`

Backend (`cross_courts_backend/backend`):

- `npm start` - run backend server
- `npm run db:bootstrap` - create/bootstrap DB schema
- `npm run db:reset-bookings` - reset booking data
- `npm run db:migrate:firebase` - migrate data to Firebase

Frontend (`CrossCourts-main/CrossCourts-main`):

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run preview` - preview production build

## Troubleshooting

- If `npm` is not recognized, reinstall Node.js and restart terminal.
- If backend cannot connect to DB, verify `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` in `.env`.
- If ports are busy, change backend `PORT` in `.env` and restart.
