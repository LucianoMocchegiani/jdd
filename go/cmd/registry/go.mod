module github.com/juego-de-dioses/jd/cmd/registry

go 1.22

require (
	github.com/juego-de-dioses/jd/pkg/jd v0.0.0
	github.com/redis/go-redis/v9 v9.7.0
)

require (
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
)

replace github.com/juego-de-dioses/jd/pkg/jd => ../../pkg/jd
