# syntax=docker/dockerfile:1

FROM golang:1.22-bookworm AS builder
WORKDIR /app

COPY go/pkg/jd go/pkg/jd
COPY go/cmd/persistence-api go/cmd/persistence-api
COPY shared/game-data/actions/combat-catalog.json shared/game-data/actions/combat-catalog.json

WORKDIR /app/go/cmd/persistence-api
ENV GOWORK=off
RUN go mod download
RUN CGO_ENABLED=0 go build -o /persistence-api .

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /persistence-api /app/persistence-api
COPY shared/game-data/actions/combat-catalog.json /app/shared/game-data/actions/combat-catalog.json
ENV HTTP_PORT=8000
ENV COMBAT_CATALOG_PATH=/app/shared/game-data/actions/combat-catalog.json
EXPOSE 8000
CMD ["/app/persistence-api"]
