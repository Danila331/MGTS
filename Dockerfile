FROM golang:1.27-alpine AS build
WORKDIR /src

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/api ./cmd/api \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/worker ./cmd/worker \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/migrate ./cmd/migrate

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata \
 && addgroup -g 10001 -S app \
 && adduser -u 10001 -S -G app app
WORKDIR /app
COPY --from=build /out/api /out/worker /out/migrate /usr/local/bin/
USER 10001
ENV PORT=8080 STORAGE=postgres
EXPOSE 8080
CMD ["sh", "-c", "if [ \"$STORAGE\" = postgres ]; then migrate || exit 1; fi; exec api"]
