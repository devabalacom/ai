#!/bin/bash
set -e

VPS_IP="89.208.97.82"
VPS_USER="root"
VPS_PASS="zwL9UNZTWYbS"
AI_DIR="/home/aiapp/ai"

echo "[1/5] Stopping containers..."
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$VPS_USER@$VPS_IP" \
  "cd $AI_DIR && docker compose down" 2>/dev/null || true

echo "[2/5] Removing database volume..."
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$VPS_USER@$VPS_IP" \
  "docker volume rm ai_db-data" 2>/dev/null || true

echo "[3/5] Rebuilding and starting containers..."
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$VPS_USER@$VPS_IP" \
  "cd $AI_DIR && docker compose up -d --build"

echo "[4/5] Waiting for database to initialize..."
sleep 5

echo "[5/5] Verifying..."
curl -s http://$VPS_IP/api/health | grep -q '"ok":true' && echo "✅ /api/health OK" || echo "❌ /api/health failed"
curl -s -X POST http://$VPS_IP/api/login \
  -H "Content-Type: application/json" \
  -d '{"id": "sergey", "password": "demo"}' | grep -q '"name":"Сергей"' && echo "✅ Login OK" || echo "❌ Login failed"

echo "Done!"
