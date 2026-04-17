#!/bin/bash
# XDCNetOwn Dashboard Startup Script
# Usage: ./start.sh [dev|prod]

set -e

MODE=${1:-prod}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Set defaults
export DATABASE_URL=${DATABASE_URL:-postgresql://gateway:***@localhost:5433/xdc_gateway}
export RPC_URL=${RPC_URL:-http://127.0.0.1:8989}
export PROMETHEUS_URL=${PROMETHEUS_URL:-http://localhost:9090}
export WS_PORT=${WS_PORT:-3006}
export PORT=${PORT:-3005}

echo "=== XDCNetOwn Dashboard ==="
echo "Mode: $MODE"
echo "Database: ${DATABASE_URL//:*@/:***@}"
echo "RPC: $RPC_URL"
echo "Dashboard Port: $PORT"
echo "WebSocket Port: $WS_PORT"
echo ""

# Initialize database schema (ignore errors if already exists)
echo "[1/3] Initializing database schema..."
if command -v psql &> /dev/null; then
  psql "$DATABASE_URL" -f lib/db/schema.sql 2>/dev/null || echo "Schema already exists or psql not available"
else
  echo "psql not found, skipping schema initialization"
fi

# Start WebSocket server in background
echo "[2/3] Starting WebSocket server on port $WS_PORT..."
npx tsx ws-server.ts &
WS_PID=$!
echo "WebSocket PID: $WS_PID"

# Give WS server time to start
sleep 2

# Cleanup function
cleanup() {
  echo ""
  echo "Shutting down..."
  if [ -n "$WS_PID" ] && kill -0 $WS_PID 2>/dev/null; then
    kill $WS_PID
    echo "Stopped WebSocket server"
  fi
  exit 0
}

trap cleanup SIGINT SIGTERM

# Start Next.js
echo "[3/3] Starting Next.js on port $PORT..."
if [ "$MODE" = "dev" ]; then
  npm run dev
else
  npm run build 2>/dev/null || true
  npm start
fi

# Cleanup on exit
cleanup
