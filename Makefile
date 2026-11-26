.PHONY: backend frontend migrate test test-backend test-frontend smoke rbac-smoke build-frontend visual-check

backend:
	cd backend && go run ./cmd/api

worker:
	cd backend && go run ./cmd/worker

migrate:
	cd backend && go run ./cmd/migrate

frontend:
	cd web && npm run dev

test: test-backend test-frontend

test-backend:
	cd backend && go test ./... && go vet ./...

test-frontend:
	cd web && npm run typecheck && npm run lint && npm run build

build-frontend:
	cd web && npm run build

smoke:
	BASE_URL=$${BASE_URL:-http://127.0.0.1:8080/api/v1} ./scripts/smoke.sh

rbac-smoke:
	BASE_URL=$${BASE_URL:-http://127.0.0.1:8080/api/v1} ./scripts/rbac-smoke.sh

visual-check:
	cd web && SCREENSHOT_DIR=../.runtime/screenshots node ../scripts/visual-check.mjs
