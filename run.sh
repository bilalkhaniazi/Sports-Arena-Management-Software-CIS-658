#!/usr/bin/env bash
set -euo pipefail

echo "Starting Cross Courts apps..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_PATH="$ROOT_DIR/CrossCourts-main/CrossCourts-main"
BACKEND_PATH="$ROOT_DIR/cross_courts_backend/backend"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is not installed. Please install Node.js LTS first: https://nodejs.org/"
  exit 1
fi

if [[ ! -d "$FRONTEND_PATH" ]]; then
  echo "Frontend directory not found: $FRONTEND_PATH"
  exit 1
fi

if [[ ! -d "$BACKEND_PATH" ]]; then
  echo "Backend directory not found: $BACKEND_PATH"
  exit 1
fi

if [[ ! -d "$BACKEND_PATH/node_modules" || ! -d "$FRONTEND_PATH/node_modules" ]]; then
  echo "Dependencies appear missing. Running install first..."
  if [[ ! -f "$ROOT_DIR/install.sh" ]]; then
    echo "install.sh not found at project root."
    exit 1
  fi
  bash "$ROOT_DIR/install.sh"
fi

if [[ ! -f "$BACKEND_PATH/.env" ]]; then
  echo "Warning: backend .env not found at $BACKEND_PATH/.env"
  echo "Create it from .env.example before using backend integrations."
fi

if command -v osascript >/dev/null 2>&1; then
  osascript -e "tell application \"Terminal\" to do script \"cd '$BACKEND_PATH' && npm start\""
  osascript -e "tell application \"Terminal\" to do script \"cd '$FRONTEND_PATH' && npm run dev\""
  echo "Launched backend and frontend in separate Terminal windows."
else
  echo "Launching both processes in this terminal..."
  (
    cd "$BACKEND_PATH"
    npm start
  ) &
  (
    cd "$FRONTEND_PATH"
    npm run dev
  ) &
  echo "Backend and frontend started in background."
fi

echo "Backend default: http://localhost:5000"
echo "Frontend default: http://localhost:5173"
