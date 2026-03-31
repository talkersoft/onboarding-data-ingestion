#!/bin/bash
set -e

API_URL="http://localhost:3010"
QUERY_URL="http://localhost:3002"
SEQ_URL="http://localhost:5380"
TIMEOUT=60
INTERVAL=2
ELAPSED=0

echo "Waiting for services to be ready (timeout: ${TIMEOUT}s)..."

while [ $ELAPSED -lt $TIMEOUT ]; do
  API=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null || echo "000")
  QUERY=$(curl -s -o /dev/null -w "%{http_code}" "$QUERY_URL/health" 2>/dev/null || echo "000")
  SEQ=$(curl -s -o /dev/null -w "%{http_code}" "$SEQ_URL" 2>/dev/null || echo "000")

  API_OK=$( [ "$API" = "200" ] && echo "true" || echo "false" )
  QUERY_OK=$( [ "$QUERY" = "200" ] && echo "true" || echo "false" )
  SEQ_OK=$( [ "$SEQ" = "200" ] && echo "true" || echo "false" )

  if [ "$API_OK" = "true" ] && [ "$QUERY_OK" = "true" ] && [ "$SEQ_OK" = "true" ]; then
    echo "All services are ready! (${ELAPSED}s)"
    exit 0
  fi

  echo "  ...waiting (${ELAPSED}s) api=$API_OK query=$QUERY_OK seq=$SEQ_OK"
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

echo "ERROR: Services did not become ready within ${TIMEOUT}s"
exit 1
