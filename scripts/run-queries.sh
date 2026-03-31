#!/bin/bash
set -e

QUERY_URL="http://localhost:3002/queries"

echo "========================================="
echo "  Running SQL Queries (Q1–Q5)"
echo "========================================="
echo ""

for q in q1 q2 q3 q4 q5; do
  echo "--- $q ---"
  curl -s "$QUERY_URL/$q" | jq .
  echo ""
done
