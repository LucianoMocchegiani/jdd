// Package httpclient — Clientes HTTP hacia registry y terrain.
package httpclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
)

// RegistryClient representa registry client.
type RegistryClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewRegistryClient construye registry client.
func NewRegistryClient(baseURL string) port.RegistryClient {
	return &RegistryClient{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

type resolveResponse struct {
	EcoID          int    `json:"eco_id"`
	EcoLabel       string `json:"eco_label"`
	WSURL          string `json:"ws_url"`
	GameInstanceID string `json:"game_instance_id"`
}

// Resolve implementa resolve.
func (c *RegistryClient) Resolve(bloqueID, playerID string) (*port.ResolveResult, error) {
	body, _ := json.Marshal(map[string]string{
		"bloque_id": bloqueID,
		"player_id": playerID,
	})
	resp, err := c.post("/resolve", body)
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
	return &port.ResolveResult{
		EcoID:          out.EcoID,
		EcoLabel:       out.EcoLabel,
		WSURL:          out.WSURL,
		GameInstanceID: out.GameInstanceID,
	}, nil
}

// Release implementa release.
func (c *RegistryClient) Release(bloqueID, playerID string, ecoID int) error {
	body, _ := json.Marshal(map[string]interface{}{
		"bloque_id": bloqueID,
		"player_id": playerID,
		"eco_id":    ecoID,
	})
	resp, err := c.post("/release", body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("registry release: status %d: %s", resp.StatusCode, string(raw))
	}
	return nil
}

// Register implementa register.
func (c *RegistryClient) Register(instanceID, wsURL string) error {
	body, _ := json.Marshal(map[string]string{
		"instance_id": instanceID,
		"ws_url":      wsURL,
	})
	resp, err := c.post("/register", body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("registry register: status %d: %s", resp.StatusCode, string(raw))
	}
	return nil
}

// Heartbeat implementa heartbeat.
func (c *RegistryClient) Heartbeat(instanceID string) error {
	body, _ := json.Marshal(map[string]string{"instance_id": instanceID})
	resp, err := c.post("/heartbeat", body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("registry heartbeat: status %d: %s", resp.StatusCode, string(raw))
	}
	return nil
}

func (c *RegistryClient) post(path string, body []byte) (*http.Response, error) {
	return c.httpClient.Post(c.baseURL+path, "application/json", bytes.NewReader(body))
}
