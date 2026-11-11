// Package medium resolves contact context from authoritative terrain samples.
package medium

import (
	"encoding/json"
	"math"
	"os"
)

type Particle struct {
	X, Y, Z  float64
	Name     string `json:"tipo_nombre"`
	Physics  string `json:"tipo_fisico"`
}

type particleRule struct {
	Family        string   `json:"family"`
	ContributesTo []string `json:"contributesTo"`
}

type particleRegistry struct {
	SubmergedCountFamilies []string                  `json:"submergedCountFamilies"`
	TypeOverrides          map[string]particleRule   `json:"typeOverrides"`
	DefaultByPhysics       map[string]particleRule   `json:"defaultByPhysics"`
}

type rulesFile struct {
	Rules struct {
		SubmergedFullRatio    float64 `json:"submergedFullRatio"`
		SubmergedPartialRatio float64 `json:"submergedPartialRatio"`
		GroundSolidCellsMin   int     `json:"groundSolidCellsMin"`
	} `json:"rules"`
	ResolutionOrder []string `json:"resolutionOrder"`
}

type Resolver struct {
	fullRatio, partialRatio float64
	groundMin               int
	order                   []string
	registry                particleRegistry
}

func Load(mediumRulesPath, particleRegistryPath string) (*Resolver, error) {
	rulesData, err := os.ReadFile(mediumRulesPath)
	if err != nil {
		return nil, err
	}
	particlesData, err := os.ReadFile(particleRegistryPath)
	if err != nil {
		return nil, err
	}
	var rules rulesFile
	if err := json.Unmarshal(rulesData, &rules); err != nil {
		return nil, err
	}
	var registry particleRegistry
	if err := json.Unmarshal(particlesData, &registry); err != nil {
		return nil, err
	}
	if rules.Rules.SubmergedFullRatio <= 0 || rules.Rules.SubmergedPartialRatio <= 0 || rules.Rules.GroundSolidCellsMin <= 0 || len(rules.ResolutionOrder) == 0 {
		return nil, os.ErrInvalid
	}
	return &Resolver{
		fullRatio: rules.Rules.SubmergedFullRatio, partialRatio: rules.Rules.SubmergedPartialRatio,
		groundMin: rules.Rules.GroundSolidCellsMin, order: rules.ResolutionOrder, registry: registry,
	}, nil
}

func (r *Resolver) Resolve(particles []Particle, solidUnderFeet bool, x, y, z, radius float64) string {
	radiusSq := radius * radius
	feetZ, fx, fy := math.Floor(z)-1, math.Floor(x+0.5), math.Floor(y+0.5)
	total, submerged, ground := 0, 0, 0
	for _, p := range particles {
		dx, dy, dz := p.X-x, p.Y-y, p.Z-z
		if math.Abs(dx) > radius || math.Abs(dy) > radius || math.Abs(dz) > radius || dx*dx+dy*dy+dz*dz > radiusSq {
			continue
		}
		total++
		rule, ok := r.registry.TypeOverrides[p.Name]
		if !ok {
			rule = r.registry.DefaultByPhysics[p.Physics]
		}
		if contains(r.registry.SubmergedCountFamilies, rule.Family) {
			submerged++
		}
		if p.Physics == "solido" && p.X == fx && p.Y == fy && p.Z == feetZ {
			ground++
		}
	}
	if solidUnderFeet && ground < r.groundMin {
		ground = r.groundMin
	}
	if total == 0 {
		if ground >= r.groundMin {
			return "ground"
		}
		return "air"
	}
	checks := map[string]bool{
		"submerged_full":    float64(submerged)/float64(total) >= r.fullRatio,
		"submerged_partial": float64(submerged)/float64(total) >= r.partialRatio,
		"ground":            ground >= r.groundMin,
		"air":               true,
	}
	for _, medium := range r.order {
		if checks[medium] {
			return medium
		}
	}
	return "air"
}

func contains(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}
