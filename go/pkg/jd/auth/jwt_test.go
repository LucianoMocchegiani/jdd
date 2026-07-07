// Tests: JWT HS256 compartido (gateway y stubs).
package auth_test

import (
	"testing"
	"time"

	jdauth "github.com/juego-de-dioses/jd/pkg/jd/auth"
)

func TestSignAndParse(t *testing.T) {
	secret := "test-secret"
	raw, err := jdauth.SignToken(secret, jdauth.Claims{
		Sub:      "user-1",
		PlayerID: "player-1",
	}, time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := jdauth.ParseToken(raw, secret)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Sub != "user-1" || claims.PlayerID != "player-1" {
		t.Fatalf("claims: %+v", claims)
	}
}

func TestParseBearer(t *testing.T) {
	secret := "test-secret"
	raw, _ := jdauth.SignToken(secret, jdauth.Claims{Sub: "u", PlayerID: "p"}, time.Hour)
	claims, err := jdauth.ParseBearer("Bearer "+raw, secret)
	if err != nil {
		t.Fatal(err)
	}
	if claims.PlayerID != "p" {
		t.Fatalf("got %q", claims.PlayerID)
	}
}

func TestMissingPlayerIDRejected(t *testing.T) {
	secret := "test-secret"
	raw, err := jdauth.SignToken(secret, jdauth.Claims{Sub: "u"}, time.Hour)
	if err == nil {
		// SignToken rejects empty player_id
		t.Fatal("expected sign error")
	}
	_ = raw
}
