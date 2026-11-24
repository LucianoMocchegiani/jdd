// DefenseProfile configures a cone- or radial-shaped shield object.
type DefenseProfile struct {
	Shape        string        `json:"shape"`
	Absorption   float64       `json:"absorption"`
	Duration     time.Duration `json:"-"`
	AngleDegrees float64       `json:"angleDegrees"`
}
