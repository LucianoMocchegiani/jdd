// Package httpclient — Clientes HTTP hacia registry y terrain.
package httpclient

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// TerrainTypesClient representa terrain types client.
type TerrainTypesClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewTerrainTypesClient construye terrain types client.
func NewTerrainTypesClient(baseURL string) *TerrainTypesClient {
	return &TerrainTypesClient{
		baseURL: baseURL,
		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// FetchTypesViewport implementa fetch types viewport.
func (c *TerrainTypesClient) FetchTypesViewport(
	bloqueID string,
	centerX, centerY, radius, zMin, zMax int,
) (string, error) {
	u, err := url.Parse(c.baseURL + "/internal/types/viewport")
	if err != nil {
		return "", err
	}
	q := u.Query()
	q.Set("bloque_id", bloqueID)
	q.Set("x", fmt.Sprintf("%d", centerX))
	q.Set("y", fmt.Sprintf("%d", centerY))
	q.Set("radius", fmt.Sprintf("%d", radius))
	q.Set("z_min", fmt.Sprintf("%d", zMin))
	q.Set("z_max", fmt.Sprintf("%d", zMax))
	u.RawQuery = q.Encode()

	resp, err := c.httpClient.Get(u.String())
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("terrain types: status %d", resp.StatusCode)
	}
	return string(body), nil
}
