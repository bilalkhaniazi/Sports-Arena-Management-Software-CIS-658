#!/usr/bin/env bash
set -euo pipefail

echo "Installing Cross Courts dependencies..."

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

echo "Installing backend dependencies..."
cd "$BACKEND_PATH"
npm install

echo "Installing frontend dependencies..."
cd "$FRONTEND_PATH"
npm install

ENV_EXAMPLE_PATH="$BACKEND_PATH/.env.example"
ENV_PATH="$BACKEND_PATH/.env"

if [[ -f "$ENV_EXAMPLE_PATH" && ! -f "$ENV_PATH" ]]; then
  cp "$ENV_EXAMPLE_PATH" "$ENV_PATH"
  echo "Created backend .env from .env.example"
fi

echo ""
echo "Install complete."
echo "Next steps:"
echo "1) Configure backend environment: cross_courts_backend/backend/.env"
echo "2) Start backend: cd cross_courts_backend/backend && npm start"
echo "3) Start frontend: cd CrossCourts-main/CrossCourts-main && npm run dev"
