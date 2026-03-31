#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================="
echo "  Onboarding Data Ingestion — Full Demo"
echo "========================================="
echo ""

echo "=== Tearing down any previous run ==="
docker compose down -v 2>/dev/null || true
rm -rf ~/.docker/data/onboarding

echo ""
echo "=== Building and starting all services ==="
mkdir -p ~/.docker/data/onboarding
docker compose build
docker compose up -d

echo ""
echo "=== Waiting for services to be ready ==="
./scripts/wait-for-services.sh

echo ""
echo "=== Data loader is running inside Docker ==="
echo "  Phase 1: new-customers     — loading customers.json"
echo "  Phase 2: changed-customers — loading customers-updates.json"
echo "  Phase 3: bad-data          — loading customers-errors.json (validation failures)"
echo ""
echo "  Watching data-loader logs..."
echo ""

docker compose logs -f data-loader 2>&1 | while IFS= read -r line; do
  echo "  $line"
  if echo "$line" | grep -q "all phases finished"; then
    break
  fi
  if echo "$line" | grep -q "Data loader failed"; then
    break
  fi
done

echo ""
echo "=== Waiting for async processing to complete ==="
sleep 3

echo ""
echo "=== Running SQL queries to prove data arrived ==="
./scripts/run-queries.sh

echo ""
echo "========================================="
echo "  Demo complete!"
echo "========================================="
echo ""
echo "  Seq Logs:    http://localhost:5380"
echo "  RabbitMQ:    http://localhost:15672 (user/password)"
echo "  Query API:   http://localhost:3002/queries/q1"
echo "  Docker logs: docker compose logs -f"
echo ""
echo "  Post more:   curl -X POST http://localhost:3010/onboarding \\"
echo "                 -H 'Content-Type: application/json' \\"
echo "                 -d '{\"accountNo\":\"ACCT-9999\",\"firstName\":\"Jane\",\"lastName\":\"Doe\",\"email\":\"jane@example.com\",\"address\":\"1 Test Ave\",\"notes\":\"Manual test\",\"description\":\"Test\"}'"
echo ""
echo "  Open Seq:  http://localhost:5380"
