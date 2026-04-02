#!/bin/bash
set -e

QUERY_URL="http://localhost:3002/queries"

echo "========================================="
echo "  Running SQL Queries"
echo "========================================="
echo ""

for q in 10-most-recent customers-with-gmail customers-per-month duplicate-emails names-starting-with-a; do
  echo "--- $q ---"
  curl -s "$QUERY_URL/$q" | jq .
  echo ""
done
