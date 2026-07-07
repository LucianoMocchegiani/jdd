FROM golang:1.22-alpine AS builder
RUN apk add --no-cache git
WORKDIR /src
COPY go/pkg/jd go/pkg/jd
COPY go/cmd/seed go/cmd/seed
WORKDIR /src/go/cmd/seed
RUN go mod download && CGO_ENABLED=0 go build -o /seed .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=builder /seed /seed
ENTRYPOINT ["/seed", "lago"]
