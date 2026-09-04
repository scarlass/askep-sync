//go:build !dev

package api

import (
	"io/fs"

	"github.com/labstack/echo/v5"
)

// registerGUI serves the embedded, pre-built form-builder/dist bundle for
// production binaries. `embedded` is the raw embed.FS from main.go, rooted
// at the repo root (paths like "form-builder/dist/index.html"), so it's
// re-rooted to the dist directory before being served at "/".
func registerGUI(e *echo.Echo, embedded fs.FS) {
	e.StaticFS("/", echo.MustSubFS(embedded, "form-builder/dist"))
}
