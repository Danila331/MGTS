#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:8080/api/v1}"

get() {
  local actor="$1" path="$2"
  curl -fsS --max-time 10 -H "X-Actor-ID: $actor" "$BASE_URL$path"
}

intern_payload="$(get actor-intern-01 /interns/internship-01)"
PAYLOAD="$intern_payload" python3 -c 'import json,os; d=json.loads(os.environ["PAYLOAD"]); assert all(r.get("respondent_id") == "actor-intern-01" for r in d.get("responses", [])), d.get("responses")'
echo "ok: intern sees only own survey responses"

mentor_reviews="$(get actor-mentor-1 /reviews)"
PAYLOAD="$mentor_reviews" python3 -c 'import json,os; d=json.loads(os.environ["PAYLOAD"]); assert all(r.get("status") == "announced" and not r.get("manager_reasoning") for r in d.get("items", [])), d'
echo "ok: mentor sees only announced reviews without manager reasoning"

manager_feedback="$(get actor-manager-core /feedback)"
PAYLOAD="$manager_feedback" python3 -c 'import json,os; d=json.loads(os.environ["PAYLOAD"]); assert all(f.get("status") != "draft" or f.get("author_id") == "actor-manager-core" for f in d.get("items", [])), d'
echo "ok: manager cannot see other authors draft feedback"

hr_feedback="$(get actor-hr /feedback)"
PAYLOAD="$hr_feedback" python3 -c 'import json,os; d=json.loads(os.environ["PAYLOAD"]); assert "items" in d'
echo "ok: HR feedback scope available"

echo "RBAC smoke passed: $BASE_URL"
