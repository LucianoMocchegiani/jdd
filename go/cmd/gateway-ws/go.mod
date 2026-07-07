module github.com/juego-de-dioses/jd/cmd/gateway-ws

go 1.22

require (
	github.com/gorilla/websocket v1.5.3
	github.com/juego-de-dioses/jd/pkg/jd v0.0.0
)

require github.com/golang-jwt/jwt/v5 v5.3.1 // indirect

replace github.com/juego-de-dioses/jd/pkg/jd => ../../pkg/jd
