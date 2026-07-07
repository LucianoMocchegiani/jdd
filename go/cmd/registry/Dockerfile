FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go/pkg/jd go/pkg/jd
COPY go/cmd/registry go/cmd/registry
WORKDIR /src/go/cmd/registry
ENV GOWORK=off
RUN go mod download
RUN CGO_ENABLED=0 go build -o /registry .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=build /registry /registry
EXPOSE 8003
ENTRYPOINT ["/registry"]
