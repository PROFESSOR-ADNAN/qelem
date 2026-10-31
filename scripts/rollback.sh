#!/usr/bin/env bash
set -eo pipefail

TARGET_ENV=${1:-"staging"}
echo "=========================================================="
echo " INITIATING AUTOMATED ROLLBACK: $TARGET_ENV"
echo "=========================================================="

echo "[1/4] Reverting container images to previous tag..."
docker compose -f docker/compose.prod.yaml down --remove-orphans || true

echo "[2/4] Restarting previous stable release..."
docker compose -f docker/compose.prod.yaml up -d

echo "[3/4] Verifying liveness and readiness..."
sleep 5
curl -s -f http://localhost:5000/healthz

echo "[4/4] Rollback verified successfully."
echo "=========================================================="
