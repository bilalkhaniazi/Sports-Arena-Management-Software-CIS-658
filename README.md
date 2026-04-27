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

## Deploy To A Free Public URL (Render)

This repo now includes `render.yaml` for one-click deployment on [Render](https://render.com/) free tier.

### What gets deployed

- `cross-courts-api` (Node backend)
- `cross-courts-web` (static React frontend)

### Before you deploy

1. Create a Firebase project and service account JSON (recommended for free hosting).
2. In Render, add backend environment variables from `cross_courts_backend/backend/.env.example`.
3. Set Firebase flags to true (already included in `render.yaml`) and upload your service account JSON (or map it using a secure file path setup).
4. Set a strong `JWT_SECRET`.

### Deploy steps

1. Push this repository to GitHub.
2. In Render dashboard, click **New +** -> **Blueprint**.
3. Select your repo. Render reads `render.yaml` and creates both services.
4. Wait for deploy finish, then open:
   - Frontend URL (public app)
   - Backend URL (API)
5. In `cross-courts-web` service settings, confirm:
   - `VITE_API_ORIGIN=https://cross-courts-api.onrender.com`
6. Redeploy frontend if you changed env vars.

### Local vs hosted API base URL

- Local: frontend continues using `http://localhost:5000`
- Hosted: set `VITE_API_ORIGIN` in frontend service

The frontend runtime now rewrites any legacy `http://localhost:5000/...` calls to `VITE_API_ORIGIN` automatically in production.
