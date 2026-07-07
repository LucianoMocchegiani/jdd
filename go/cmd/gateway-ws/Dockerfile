FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go/pkg/jd go/pkg/jd
COPY go/cmd/gateway-ws go/cmd/gateway-ws
WORKDIR /src/go/cmd/gateway-ws
ENV GOWORK=off
RUN go mod download
RUN CGO_ENABLED=0 go build -o /gateway-ws .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=build /gateway-ws /gateway-ws
EXPOSE 8082
ENTRYPOINT ["/gateway-ws"]
