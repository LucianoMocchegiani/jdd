// Package redis — Persistencia Redis del registry.
package redis

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/juego-de-dioses/jd/cmd/registry/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/registry/internal/domain/port"
	"github.com/juego-de-dioses/jd/pkg/jd/rediskeys"
)

// EcoStore representa eco store.
type EcoStore struct {
	client           *goredis.Client
	playerTTL        time.Duration
	gameTTL          time.Duration
	ecoSpawnThreshold int
}

// NewEcoStore construye eco store.
func NewEcoStore(client *goredis.Client, playerTTLSec, gameTTLSec, ecoSpawnThreshold int) *EcoStore {
	return &EcoStore{
		client:            client,
		playerTTL:         time.Duration(playerTTLSec) * time.Second,
		gameTTL:           time.Duration(gameTTLSec) * time.Second,
		ecoSpawnThreshold: ecoSpawnThreshold,
	}
}

// RegisterGame implementa register game.
func (s *EcoStore) RegisterGame(ctx context.Context, instanceID, wsURL string) error {
	key := rediskeys.RegistryGameKey(instanceID)
	pipe := s.client.Pipeline()
	pipe.HSet(ctx, key, map[string]interface{}{
		"ws_url": wsURL,
	})
	pipe.Expire(ctx, key, s.gameTTL)
	_, err := pipe.Exec(ctx)
	return err
}

// TouchGame implementa touch game.
func (s *EcoStore) TouchGame(ctx context.Context, instanceID string) error {
	key := rediskeys.RegistryGameKey(instanceID)
	if n, _ := s.client.Exists(ctx, key).Result(); n == 0 {
		return fmt.Errorf("game instance not registered: %s", instanceID)
	}
	return s.client.Expire(ctx, key, s.gameTTL).Err()
}

// ListGames implementa list games.
func (s *EcoStore) ListGames(ctx context.Context) ([]domain.GameInstance, error) {
	var cursor uint64
	var out []domain.GameInstance
	for {
		keys, next, err := s.client.Scan(ctx, cursor, "registry:game:*", 50).Result()
		if err != nil {
			return nil, err
		}
		for _, key := range keys {
			id := strings.TrimPrefix(key, "registry:game:")
			ws, err := s.client.HGet(ctx, key, "ws_url").Result()
			if err != nil {
				continue
			}
			out = append(out, domain.GameInstance{InstanceID: id, WSURL: ws})
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
	return out, nil
}

// AssignPlayer implementa assign player.
func (s *EcoStore) AssignPlayer(ctx context.Context, bloqueID, playerID string, maxPlayers int) (*domain.Assignment, error) {
	if existing, err := s.lookupPlayer(ctx, bloqueID, playerID); err == nil && existing != nil {
		return existing, nil
	}

	ecoID, gameID, wsURL, err := s.pickOrCreateEco(ctx, bloqueID, maxPlayers)
	if err != nil {
		return nil, err
	}

	if err := s.addPlayerToEco(ctx, bloqueID, playerID, ecoID, maxPlayers, gameID, wsURL); err != nil {
		return nil, err
	}

	return s.buildAssignment(bloqueID, ecoID, "normal", gameID, wsURL), nil
}

// ReleasePlayer implementa release player.
func (s *EcoStore) ReleasePlayer(ctx context.Context, bloqueID, playerID string, ecoID int) error {
	membersKey := rediskeys.RegistryEcoMembersKey(bloqueID, ecoID)
	ecoKey := rediskeys.RegistryEcoKey(bloqueID, ecoID)
	pipe := s.client.Pipeline()
	pipe.SRem(ctx, membersKey, playerID)
	pipe.HIncrBy(ctx, ecoKey, "player_count", -1)
	pipe.Del(ctx, rediskeys.RegistryPlayerKey(playerID))
	_, err := pipe.Exec(ctx)
	return err
}

// SyncPlayerEco implementa sync player eco.
func (s *EcoStore) SyncPlayerEco(ctx context.Context, bloqueID, playerID string, targetEcoID int, maxPlayers int) (*domain.Assignment, error) {
	// release from current if mapped
	if cur, _ := s.client.Get(ctx, rediskeys.RegistryPlayerKey(playerID)).Result(); cur != "" {
		parts := strings.SplitN(cur, ":", 2)
		if len(parts) == 2 {
			if oldEco, err := strconv.Atoi(parts[1]); err == nil {
				_ = s.ReleasePlayer(ctx, parts[0], playerID, oldEco)
			}
		}
	}

	ecoKey := rediskeys.RegistryEcoKey(bloqueID, targetEcoID)
	meta, err := s.client.HGetAll(ctx, ecoKey).Result()
	if err != nil || len(meta) == 0 {
		return nil, fmt.Errorf("eco not found")
	}
	count, _ := s.client.SCard(ctx, rediskeys.RegistryEcoMembersKey(bloqueID, targetEcoID)).Result()
	if int(count) >= maxPlayers {
		return nil, fmt.Errorf("eco full")
	}

	gameID := meta["game_instance_id"]
	wsURL := meta["game_host"]
	if err := s.addPlayerToEco(ctx, bloqueID, playerID, targetEcoID, maxPlayers, gameID, wsURL); err != nil {
		return nil, err
	}
	ecoType := meta["type"]
	if ecoType == "" {
		ecoType = "normal"
	}
	return s.buildAssignment(bloqueID, targetEcoID, ecoType, gameID, wsURL), nil
}

func (s *EcoStore) lookupPlayer(ctx context.Context, bloqueID, playerID string) (*domain.Assignment, error) {
	raw, err := s.client.Get(ctx, rediskeys.RegistryPlayerKey(playerID)).Result()
	if err == goredis.Nil {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	parts := strings.SplitN(raw, ":", 2)
	if len(parts) != 2 || parts[0] != bloqueID {
		return nil, nil
	}
	ecoID, err := strconv.Atoi(parts[1])
	if err != nil {
		return nil, nil
	}
	meta, err := s.client.HGetAll(ctx, rediskeys.RegistryEcoKey(bloqueID, ecoID)).Result()
	if err != nil || len(meta) == 0 {
		return nil, nil
	}
	if !s.isMember(ctx, bloqueID, ecoID, playerID) {
		return nil, nil
	}
	ecoType := meta["type"]
	if ecoType == "" {
		ecoType = "normal"
	}
	return s.buildAssignment(bloqueID, ecoID, ecoType, meta["game_instance_id"], meta["game_host"]), nil
}

func (s *EcoStore) isMember(ctx context.Context, bloqueID string, ecoID int, playerID string) bool {
	ok, _ := s.client.SIsMember(ctx, rediskeys.RegistryEcoMembersKey(bloqueID, ecoID), playerID).Result()
	return ok
}

func (s *EcoStore) pickOrCreateEco(ctx context.Context, bloqueID string, maxPlayers int) (ecoID int, gameID, wsURL string, err error) {
	ecosKey := rediskeys.RegistryBloqueEcosKey(bloqueID)
	ecoIDs, err := s.client.SMembers(ctx, ecosKey).Result()
	if err != nil {
		return 0, "", "", err
	}

	bestID := -1
	bestCount := maxPlayers + 1
	var bestGame, bestWS string

	for _, idStr := range ecoIDs {
		id, convErr := strconv.Atoi(idStr)
		if convErr != nil {
			continue
		}
		meta, err := s.client.HGetAll(ctx, rediskeys.RegistryEcoKey(bloqueID, id)).Result()
		if err != nil || len(meta) == 0 {
			continue
		}
		count, _ := s.client.SCard(ctx, rediskeys.RegistryEcoMembersKey(bloqueID, id)).Result()
		if int(count) >= maxPlayers {
			continue
		}
		gid := meta["game_instance_id"]
		if !s.gameAlive(ctx, gid) {
			continue
		}
		if int(count) < bestCount {
			bestCount = int(count)
			bestID = id
			bestGame = gid
			bestWS = meta["game_host"]
		}
	}

	if bestID >= 0 && bestCount < s.ecoSpawnThreshold {
		return bestID, bestGame, bestWS, nil
	}

	return s.createEco(ctx, bloqueID, maxPlayers)
}

func (s *EcoStore) createEco(ctx context.Context, bloqueID string, maxPlayers int) (int, string, string, error) {
	games, err := s.ListGames(ctx)
	if err != nil || len(games) == 0 {
		return 0, "", "", fmt.Errorf("no game servers registered")
	}
	// pick game with fewest ecos assigned (simple: first alive)
	game := games[0]

	nextKey := rediskeys.RegistryBloqueNextEcoKey(bloqueID)
	ecoID, err := s.client.Incr(ctx, nextKey).Result()
	if err != nil {
		return 0, "", "", err
	}

	ecoKey := rediskeys.RegistryEcoKey(bloqueID, int(ecoID))
	pipe := s.client.Pipeline()
	pipe.HSet(ctx, ecoKey, map[string]interface{}{
		"max":               maxPlayers,
		"type":              "normal",
		"game_instance_id":  game.InstanceID,
		"game_host":         game.WSURL,
		"player_count":      0,
	})
	pipe.SAdd(ctx, rediskeys.RegistryBloqueEcosKey(bloqueID), ecoID)
	_, err = pipe.Exec(ctx)
	if err != nil {
		return 0, "", "", err
	}
	return int(ecoID), game.InstanceID, game.WSURL, nil
}

func (s *EcoStore) addPlayerToEco(ctx context.Context, bloqueID, playerID string, ecoID, maxPlayers int, gameID, wsURL string) error {
	membersKey := rediskeys.RegistryEcoMembersKey(bloqueID, ecoID)
	count, err := s.client.SCard(ctx, membersKey).Result()
	if err != nil {
		return err
	}
	if int(count) >= maxPlayers {
		return fmt.Errorf("eco full")
	}

	ecoKey := rediskeys.RegistryEcoKey(bloqueID, ecoID)
	pipe := s.client.Pipeline()
	pipe.SAdd(ctx, membersKey, playerID)
	pipe.HSet(ctx, ecoKey, map[string]interface{}{
		"max":              maxPlayers,
		"game_instance_id": gameID,
		"game_host":        wsURL,
	})
	pipe.HIncrBy(ctx, ecoKey, "player_count", 1)
	pipe.Set(ctx, rediskeys.RegistryPlayerKey(playerID), rediskeys.EcoKey(bloqueID, ecoID), s.playerTTL)
	_, err = pipe.Exec(ctx)
	return err
}

func (s *EcoStore) gameAlive(ctx context.Context, instanceID string) bool {
	if instanceID == "" {
		return false
	}
	n, err := s.client.Exists(ctx, rediskeys.RegistryGameKey(instanceID)).Result()
	return err == nil && n > 0
}

func (s *EcoStore) buildAssignment(bloqueID string, ecoID int, ecoType, gameID, wsURL string) *domain.Assignment {
	return &domain.Assignment{
		BloqueID:       bloqueID,
		EcoID:          ecoID,
		EcoLabel:       domain.EcoLabel(bloqueID, ecoID, ecoType),
		GameInstanceID: gameID,
		WSURL:          wsURL,
	}
}

var _ port.EcoStore = (*EcoStore)(nil)
