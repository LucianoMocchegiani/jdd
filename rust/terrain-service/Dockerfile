# syntax=docker/dockerfile:1

FROM rust:1-bookworm AS builder
WORKDIR /app

COPY rust/terrain-service/Cargo.toml rust/terrain-service/Cargo.lock* ./rust/terrain-service/
COPY rust/terrain-service/src ./rust/terrain-service/src
COPY rust/terrain-service/tests ./rust/terrain-service/tests
COPY shared/game-data/game/session.json ./shared/game-data/game/session.json

WORKDIR /app/rust/terrain-service
RUN cargo build --release

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=builder /app/rust/terrain-service/target/release/terrain-service /app/terrain-service
COPY shared/game-data/game/session.json /app/shared/game-data/game/session.json

ENV HTTP_PORT=8002
ENV SESSION_JSON_PATH=/app/shared/game-data/game/session.json
EXPOSE 8002

CMD ["/app/terrain-service"]
