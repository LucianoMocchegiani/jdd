package wshub

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/juego-de-dioses/jd/pkg/jd/wire"
)

func TestConcurrentWrites(t *testing.T) {
	const writes = 32
	received := make(chan int, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ws, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer ws.Close()
		count := 0
		for {
			if _, _, err := ws.ReadMessage(); err != nil {
				received <- count
				return
			}
			count++
		}
	}))
	defer server.Close()

	ws, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http"), nil)
	if err != nil {
		t.Fatal(err)
	}
	conn := &Conn{WS: ws, WireFormat: wire.FormatMsgpack}
	var wg sync.WaitGroup
	for i := 0; i < writes; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			SafeWrite(conn, `{"event":"test"}`)
			WritePlayerState(conn, `{}`)
		}()
	}
	wg.Wait()
	_ = ws.Close()

	select {
	case count := <-received:
		if count != writes*2 {
			t.Fatalf("received %d messages, want %d", count, writes*2)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for server to receive messages")
	}
}
