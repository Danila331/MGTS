.PHONY: run worker migrate test race vet build fmt

run:
	go run ./cmd/api

worker:
	go run ./cmd/worker

migrate:
	go run ./cmd/migrate

fmt:
	gofmt -w cmd internal migrations

test:
	go test ./...

race:
	go test -race ./...

vet:
	go vet ./...

build:
	go build ./cmd/...
