// Package usecase — Sesión proxy: resolve registry y reenvío WS.
package usecase

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"

	jdauth "github.com/juego-de-dioses/jd/pkg/jd/auth"

	"github.com/juego-de-dioses/jd/cmd/gateway-ws/internal/domain/port"
)

var (
	ErrNotJoinBlock     = errors.New("first message must be join_block")
	ErrMissingJoinFields = errors.New("join_block missing bloque_id or player_id")
)

// ProxySession representa proxy session.
type ProxySession struct {
	registry       port.RegistryClient
	defaultGameURL string
}

// NewProxySession construye proxy session.
func NewProxySession(registry port.RegistryClient, defaultGameURL string) *ProxySession {
	return &ProxySession{registry: registry, defaultGameURL: defaultGameURL}
}

// ProxyInput representa proxy input.
type ProxyInput struct {
	ClientConn *websocket.Conn
	AuthHeader string
	Claims     *jdauth.Claims
	EnforceJWT bool
}

// Run implementa run.
func (p *ProxySession) Run(ctx context.Context, in ProxyInput) error {
	_, firstRaw, err := in.ClientConn.ReadMessage()
	if err != nil {
		return err
	}

	join, err := parseJoinBlock(firstRaw)
	if err != nil {
		return err
	}

	playerID := join.PlayerID
	if in.EnforceJWT && in.Claims != nil {
		playerID = in.Claims.PlayerID
	}
	if playerID == "" || join.BloqueID == "" {
		return ErrMissingJoinFields
	}

	upstreamURL := p.defaultGameURL
	if p.registry != nil {
		res, err := p.registry.Resolve(join.BloqueID, playerID)
		if err == nil && res.WSURL != "" {
			upstreamURL = res.WSURL
		}
	}

	header := http.Header{}
	if in.AuthHeader != "" {
		header.Set("Authorization", in.AuthHeader)
	}

	upstream, _, err := websocket.DefaultDialer.DialContext(ctx, upstreamURL, header)
	if err != nil {
		return err
	}
	defer upstream.Close()

	patched, err := patchJoinBlock(firstRaw, playerID, in.EnforceJWT && in.Claims != nil)
	if err != nil {
		return err
	}
	if err := upstream.WriteMessage(websocket.TextMessage, patched); err != nil {
		return err
	}

	var wg sync.WaitGroup
	errCh := make(chan error, 2)
	pump := func(from, to *websocket.Conn) {
		defer wg.Done()
		for {
			select {
			case <-ctx.Done():
				errCh <- ctx.Err()
				return
			default:
			}
			mt, msg, err := from.ReadMessage()
			if err != nil {
				if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) && !errors.Is(err, io.EOF) {
					errCh <- err
				}
				return
			}
			if err := to.WriteMessage(mt, msg); err != nil {
				errCh <- err
				return
			}
		}
	}

	wg.Add(2)
	go pump(in.ClientConn, upstream)
	go pump(upstream, in.ClientConn)

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-ctx.Done():
		_ = in.ClientConn.Close()
		_ = upstream.Close()
		return ctx.Err()
	case err := <-errCh:
		return err
	case <-done:
		return nil
	}
}

type joinBlockMsg struct {
	BloqueID string
	PlayerID string
}

func parseJoinBlock(raw []byte) (joinBlockMsg, error) {
	var msg map[string]interface{}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return joinBlockMsg{}, err
	}
	t, _ := msg["type"].(string)
	if t != "join_block" {
		return joinBlockMsg{}, ErrNotJoinBlock
	}
	bloqueID, _ := msg["bloque_id"].(string)
	playerID, _ := msg["player_id"].(string)
	return joinBlockMsg{BloqueID: bloqueID, PlayerID: playerID}, nil
}

func patchJoinBlock(raw []byte, playerID string, enforce bool) ([]byte, error) {
	if !enforce || playerID == "" {
		return raw, nil
	}
	var msg map[string]interface{}
	if err := json.Unmarshal(raw, &msg); err != nil {
		return nil, err
	}
	msg["player_id"] = playerID
	return json.Marshal(msg)
}
