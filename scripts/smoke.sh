#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080/api/v1}"
CURL=(curl -fsS --max-time 10)

request() {
  local path="$1"
  local actor="${2:-}"
  if [[ -n "$actor" ]]; then
    "${CURL[@]}" -H "X-Actor-ID: $actor" "$BASE_URL$path"
  else
    "${CURL[@]}" "$BASE_URL$path"
  fi
}

json_check() {
  local name="$1"
  local expression="$2"
  local payload="$3"
  PAYLOAD="$payload" EXPRESSION="$expression" python3 -c 'import json, os; data=json.loads(os.environ["PAYLOAD"]); assert eval(os.environ["EXPRESSION"], {"data": data}), os.environ["EXPRESSION"]'
  echo "ok: $name"
}

json_check health 'data["status"] == "ok"' "$(request /health)"
json_check actors 'len(data["items"]) >= 4' "$(request /actors)"
json_check dashboard 'len(data["attention_signals"]) > 0' "$(request /dashboard)"
json_check interns 'len(data["items"]) >= 8' "$(request /interns)"
json_check surveys 'len(data["items"]) >= 1' "$(request /surveys)"
json_check feedback '"items" in data' "$(request /feedback)"
json_check signals 'len(data["items"]) >= 1' "$(request /signals)"
json_check reviews '"items" in data' "$(request /reviews)"
json_check diagnostics '"items" in data' "$(request /diagnostics)"
json_check development '"items" in data or "goals" in data' "$(request /development)"
json_check integrations 'len(data["items"]) >= 1' "$(request /integrations)"
json_check settings '"show_feedback_to_intern" in data' "$(request /settings)"

echo "Smoke suite passed: $BASE_URL"
