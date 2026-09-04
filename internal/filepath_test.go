package internal

import (
	"path/filepath"
	"testing"
)

func TestFilepathAbs(t *testing.T) {
	t.Log(filepath.Abs("~/.config"))
}
