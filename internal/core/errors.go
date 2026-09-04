package core

import "fmt"

var (
	ErrEmptyTargets            = fmt.Errorf("empty project target(s) configuration")
	ErrEmptyInputTargets       = fmt.Errorf("target(s) is not specified")
	ErrDryModeOnly1InputTarget = fmt.Errorf("in dry mode only 1 target is allowed")
)
