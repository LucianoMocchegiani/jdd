// Package ws — Proxy bidireccional WS cliente ↔ game-server.
package ws

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"

	"github.com/juego-de-dioses/jd/cmd/gateway-ws/internal/config"
	"github.com/juego-de-dioses/jd/cmd/gateway-ws/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/gateway-ws/internal/infrastructure/ratelimit"
	"github.com/juego-de-dioses/jd/cmd/gateway-ws/internal/usecase"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Gateway representa gateway.
type Gateway struct {
	cfg       config.Config
	validator port.TokenValidator
	proxy     *usecase.ProxySession
	limiter   *ratelimit.IPLimiter
}

// NewGateway construye gateway.
func NewGateway(cfg config.Config, validator port.TokenValidator, proxy *usecase.ProxySession, limiter *ratelimit.IPLimiter) *Gateway {
	return &Gateway{cfg: cfg, validator: validator, proxy: proxy, limiter: limiter}
}

// Mount implementa mount.
func (g *Gateway) Mount(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", healthHandler)
	mux.HandleFunc("GET /ws", g.handleWS)
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

func (g *Gateway) handleWS(w http.ResponseWriter, r *http.Request) {
	if !g.limiter.Allow(r) {
		http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
		return
	}

	authHeader := r.Header.Get("Authorization")
	claims, err := g.validator.Validate(authHeader, g.cfg.DevBypassAuth())
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	clientWS, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer clientWS.Close()

	ctx := r.Context()
	if err := g.proxy.Run(ctx, usecase.ProxyInput{
		ClientConn: clientWS,
		AuthHeader: authHeader,
		Claims:     claims,
		EnforceJWT: !g.cfg.DevBypassAuth(),
	}); err != nil && ctx.Err() == nil {
		log.Printf("proxy session: %v", err)
	}
}
