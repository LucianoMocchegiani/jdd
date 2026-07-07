// Package httpclient — Cliente HTTP al registry.
package httpclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/juego-de-dioses/jd/cmd/gateway-ws/internal/domain/port"
)

// RegistryClient representa registry client.
type RegistryClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewRegistryClient construye registry client.
func NewRegistryClient(baseURL string) *RegistryClient {
	return &RegistryClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

type resolveResponse struct {
	WSURL          string `json:"ws_url"`
	GameInstanceID string `json:"game_instance_id"`
	EcoID          int    `json:"eco_id"`
}

// Resolve implementa resolve.
func (c *RegistryClient) Resolve(bloqueID, playerID string) (*port.ResolveResult, error) {
	body, _ := json.Marshal(map[string]string{
		"bloque_id": bloqueID,
		"player_id": playerID,
	})
	resp, err := c.httpClient.Post(c.baseURL+"/resolve", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("registry resolve: status %d: %s", resp.StatusCode, string(raw))
	}
	var out resolveResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	if out.WSURL == "" {
		return nil, fmt.Errorf("registry resolve: empty ws_url")
	}
	return &port.ResolveResult{
		WSURL:          out.WSURL,
		GameInstanceID: out.GameInstanceID,
		EcoID:          out.EcoID,
	}, nil
}

var _ port.RegistryClient = (*RegistryClient)(nil)

type noopRegistry struct {
	fallback string
}

// NewNoopRegistry construye noop registry.
func NewNoopRegistry(fallbackWSURL string) port.RegistryClient {
	return noopRegistry{fallback: fallbackWSURL}
}

// Resolve implementa resolve.
func (n noopRegistry) Resolve(_, _ string) (*port.ResolveResult, error) {
	return &port.ResolveResult{WSURL: n.fallback}, nil
}

var _ port.RegistryClient = noopRegistry{}
