// Package domain — Modelos Eco y Assignment.
package domain

import "fmt"

// Eco representa eco.
type Eco struct {
	BloqueID       string
	EcoID          int
	Type           string
	GameInstanceID string
	GameWSURL      string
	PlayerCount    int
	MaxPlayers     int
}

// GameInstance representa game instance.
type GameInstance struct {
	InstanceID string
	WSURL      string
}

// Assignment representa assignment.
type Assignment struct {
	BloqueID       string
	EcoID          int
	EcoLabel       string
	GameInstanceID string
	WSURL          string
}

// EcoLabel ejecuta eco label.
func EcoLabel(bloqueID string, ecoID int, ecoType string) string {
	if ecoType == "war" {
		return fmt.Sprintf("Eco %d (guerra)", ecoID)
	}
	_ = bloqueID
	return fmt.Sprintf("Eco %d", ecoID)
}
