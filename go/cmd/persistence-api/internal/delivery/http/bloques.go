// Package http — Handlers HTTP REST.
package http

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/usecase"
)

// BloquesHandler representa bloques handler.
type BloquesHandler struct {
	svc *usecase.BloqueService
}

// NewBloquesHandler construye bloques handler.
func NewBloquesHandler(svc *usecase.BloqueService) *BloquesHandler {
	return &BloquesHandler{svc: svc}
}

// Mount implementa mount.
func (h *BloquesHandler) Mount(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/bloques/world/size", h.getWorldSize)
	mux.HandleFunc("GET /api/bloques/{id}", h.getByID)
	mux.HandleFunc("GET /api/bloques", h.list)
}

func (h *BloquesHandler) list(w http.ResponseWriter, r *http.Request) {
	bloques, err := h.svc.ListBloques(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if bloques == nil {
		bloques = []domain.Bloque{}
	}
	writeJSON(w, http.StatusOK, bloquesToWire(bloques))
}

func (h *BloquesHandler) getByID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	b, err := h.svc.GetBloque(r.Context(), id)
	if errors.Is(err, port.ErrBloqueNotFound) {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, bloqueToWire(*b))
}

func (h *BloquesHandler) getWorldSize(w http.ResponseWriter, r *http.Request) {
	size, err := h.svc.GetWorldSize(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]float64{
		"ancho_total": size.AnchoTotal,
		"alto_total":  size.AltoTotal,
		"radio_mundo": size.RadioMundo,
		"min_x":       size.MinX,
		"max_x":       size.MaxX,
		"min_y":       size.MinY,
		"max_y":       size.MaxY,
		"centro_x":    size.CentroX,
		"centro_y":    size.CentroY,
	})
}

type bloqueWire struct {
	ID                string  `json:"id"`
	Nombre            string  `json:"nombre"`
	AnchoMetros       float64 `json:"ancho_metros"`
	AltoMetros        float64 `json:"alto_metros"`
	ProfundidadMaxima int     `json:"profundidad_maxima"`
	AlturaMaxima      int     `json:"altura_maxima"`
	TamanoCelda       float64 `json:"tamano_celda"`
	OrigenX           float64 `json:"origen_x"`
	OrigenY           float64 `json:"origen_y"`
	OrigenZ           int     `json:"origen_z"`
	CreadoPor         *string `json:"creado_por,omitempty"`
	CreadoEn          string  `json:"creado_en"`
}

func bloquesToWire(bloques []domain.Bloque) []bloqueWire {
	out := make([]bloqueWire, 0, len(bloques))
	for _, b := range bloques {
		out = append(out, bloqueToWire(b))
	}
	return out
}

func bloqueToWire(b domain.Bloque) bloqueWire {
	return bloqueWire{
		ID:                b.ID,
		Nombre:            b.Nombre,
		AnchoMetros:       b.AnchoMetros,
		AltoMetros:        b.AltoMetros,
		ProfundidadMaxima: b.ProfundidadMaxima,
		AlturaMaxima:      b.AlturaMaxima,
		TamanoCelda:       b.TamanoCelda,
		OrigenX:           b.OrigenX,
		OrigenY:           b.OrigenY,
		OrigenZ:           b.OrigenZ,
		CreadoPor:         b.CreadoPor,
		CreadoEn:          b.CreadoEn.UTC().Format("2006-01-02T15:04:05.999999Z07:00"),
	}
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"detail": msg})
}

// HealthHandler ejecuta health handler.
func HealthHandler(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// MountHealth ejecuta mount health.
func MountHealth(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", HealthHandler)
}

// MountAPIRoot índice mínimo GET /api (smoke test del frontend greenfield).
func MountAPIRoot(mux *http.ServeMux) {
	mux.HandleFunc("GET /api", apiRootHandler)
	mux.HandleFunc("GET /api/", apiRootHandler)
}

func apiRootHandler(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Juego de Dioses persistence-api",
		"version": "greenfield",
	})
}
