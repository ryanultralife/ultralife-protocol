#!/bin/bash

# UltraLife Protocol API Test Script
# Tests all endpoints of the specification server

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  UltraLife Protocol API Tests                            ║"
echo "║  Base URL: $BASE_URL"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS=0
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
  local name="$1"
  local endpoint="$2"
  local expected_field="$3"
  local jq_filter="${4:-.}"

  TESTS=$((TESTS + 1))
  echo -n "Testing $name... "

  response=$(curl -s "${BASE_URL}${endpoint}")
  status=$?

  if [ $status -eq 0 ]; then
    if [ -n "$expected_field" ]; then
      result=$(echo "$response" | jq -r "$jq_filter")
      if [ -n "$result" ] && [ "$result" != "null" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED=$((PASSED + 1))
        return 0
      else
        echo -e "${RED}✗ FAIL${NC} - Expected field '$expected_field' not found"
        FAILED=$((FAILED + 1))
        return 1
      fi
    else
      echo -e "${GREEN}✓ PASS${NC}"
      PASSED=$((PASSED + 1))
      return 0
    fi
  else
    echo -e "${RED}✗ FAIL${NC} - Request failed"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

# Test endpoints
echo "═══ Basic Endpoints ═══"
test_endpoint "Root" "/" "protocol" ".protocol"
test_endpoint "Health Check" "/health" "status" ".status"

echo ""
echo "═══ Protocol Specification ═══"
test_endpoint "Full Spec" "/spec" "version" ".version"
test_endpoint "Compounds List" "/spec/compounds" "total" ".total"
test_endpoint "Compound: CO2" "/spec/compounds/CO2" "name" ".name"
test_endpoint "Compound: IRON" "/spec/compounds/IRON" "name" ".name"
test_endpoint "Compound: GLYPHOSATE" "/spec/compounds/GLYPHOSATE" "name" ".name"

echo ""
echo "═══ Validators ═══"
test_endpoint "Validators List" "/spec/validators" "total" ".total"
test_endpoint "Compound Flow Validator" "/spec/validators/compound-flow" "id" ".id"
test_endpoint "Transaction Validator" "/spec/validators/transaction" "id" ".id"
test_endpoint "Land Sequestration Validator" "/spec/validators/land-sequestration" "id" ".id"

echo ""
echo "═══ Deployment ═══"
test_endpoint "Deployment State" "/deployment" "summary" ".summary"

echo ""
echo "═══ Error Handling ═══"
TESTS=$((TESTS + 1))
echo -n "Testing 404 handling... "
response=$(curl -s "${BASE_URL}/invalid-endpoint")
error=$(echo "$response" | jq -r '.error')
if [ "$error" = "Not found" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC}"
  FAILED=$((FAILED + 1))
fi

TESTS=$((TESTS + 1))
echo -n "Testing invalid compound ID... "
response=$(curl -s "${BASE_URL}/spec/compounds/INVALID_COMPOUND_XYZ")
error=$(echo "$response" | jq -r '.error')
if [ "$error" = "Compound not found" ]; then
  echo -e "${GREEN}✓ PASS${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗ FAIL${NC}"
  FAILED=$((FAILED + 1))
fi

# Summary
echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║  Test Summary                                            ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║  Total Tests: $TESTS"
echo "║  Passed:      ${GREEN}$PASSED${NC}"
echo "║  Failed:      ${RED}$FAILED${NC}"
echo "╚═══════════════════════════════════════════════════════════╝"

if [ $FAILED -eq 0 ]; then
  echo ""
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
else
  echo ""
  echo -e "${RED}Some tests failed.${NC}"
  exit 1
fi
