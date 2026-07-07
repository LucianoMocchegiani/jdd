package worldgen

import (
	"context"
	"encoding/json"

	goredis "github.com/redis/go-redis/v9"

	"github.com/juego-de-dioses/jd/pkg/jd/rediskeys"
)

// PublishBlockSeeded notifica a terrain-service que invalidar caché del bloque.
func PublishBlockSeeded(ctx context.Context, rdb *goredis.Client, bloqueID string, isNewBlock bool) error {
	payload, err := json.Marshal(map[string]interface{}{
		"bloque_id":     bloqueID,
		"is_new_block":  isNewBlock,
		"block_version": 1,
	})
	if err != nil {
		return err
	}
	return rdb.XAdd(ctx, &goredis.XAddArgs{
		Stream: rediskeys.StreamBlockSeeded,
		MaxLen: 10000,
		Approx: true,
		Values: map[string]interface{}{"payload": string(payload)},
	}).Err()
}
