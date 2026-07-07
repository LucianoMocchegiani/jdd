// Package cellkey — Claves de celda estables para mapas y Redis.
package cellkey

import (
	"fmt"
	"strconv"
	"strings"
)

// Format returns "x,y,z" cell key.
func Format(x, y, z int) string {
	return fmt.Sprintf("%d,%d,%d", x, y, z)
}

// Parse inverts Format.
func Parse(key string) (x, y, z int, err error) {
	parts := strings.Split(key, ",")
	if len(parts) != 3 {
		return 0, 0, 0, fmt.Errorf("cellkey.Parse: expected 3 parts, got %d", len(parts))
	}
	x, err = strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, 0, err
	}
	y, err = strconv.Atoi(parts[1])
	if err != nil {
		return 0, 0, 0, err
	}
	z, err = strconv.Atoi(parts[2])
	if err != nil {
		return 0, 0, 0, err
	}
	return x, y, z, nil
}
