# syntax=docker/dockerfile:1

FROM golang:1.22-bookworm AS builder
WORKDIR /app

COPY go/pkg/jd go/pkg/jd
COPY go/cmd/game-server go/cmd/game-server
COPY shared/game-data/game/session.json shared/game-data/game/session.json
COPY shared/game-data/actions/body-actions.json shared/game-data/actions/body-actions.json
COPY shared/game-data/medium/rules.json shared/game-data/medium/rules.json
COPY shared/game-data/particles/registry.json shared/game-data/particles/registry.json

WORKDIR /app/go/cmd/game-server
ENV GOWORK=off
RUN go mod download
RUN CGO_ENABLED=0 go build -o /game-server .

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /game-server /app/game-server
COPY shared/game-data/game/session.json /app/shared/game-data/game/session.json
COPY shared/game-data/actions/body-actions.json /app/shared/game-data/actions/body-actions.json
COPY shared/game-data/medium/rules.json /app/shared/game-data/medium/rules.json
COPY shared/game-data/particles/registry.json /app/shared/game-data/particles/registry.json
ENV HTTP_PORT=8001
ENV SESSION_JSON_PATH=/app/shared/game-data/game/session.json
ENV COMBAT_CATALOG_PATH=/app/shared/game-data/actions/body-actions.json
ENV MEDIUM_RULES_PATH=/app/shared/game-data/medium/rules.json
ENV PARTICLE_REGISTRY_PATH=/app/shared/game-data/particles/registry.json
ENV GAME_INSTANCE_ID=game-1
ENV WIRE_FORMAT=json
EXPOSE 8001
CMD ["/app/game-server"]
