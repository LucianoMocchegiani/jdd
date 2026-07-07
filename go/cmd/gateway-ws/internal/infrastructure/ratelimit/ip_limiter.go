// Package ratelimit — Rate limit por IP.
package ratelimit

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// IPLimiter representa ip limiter.
type IPLimiter struct {
	mu      sync.Mutex
	max     int
	window  time.Duration
	entries map[string]*bucket
}

type bucket struct {
	count   int
	resetAt time.Time
}

// NewIPLimiter construye ip limiter.
func NewIPLimiter(maxPerWindow int, windowSec int) *IPLimiter {
	return &IPLimiter{
		max:     maxPerWindow,
		window:  time.Duration(windowSec) * time.Second,
		entries: make(map[string]*bucket),
	}
}

// Allow implementa allow.
func (l *IPLimiter) Allow(r *http.Request) bool {
	ip := clientIP(r)
	now := time.Now()

	l.mu.Lock()
	defer l.mu.Unlock()

	b, ok := l.entries[ip]
	if !ok || now.After(b.resetAt) {
		l.entries[ip] = &bucket{count: 1, resetAt: now.Add(l.window)}
		return true
	}
	if b.count >= l.max {
		return false
	}
	b.count++
	return true
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
