//go:build dev

package api

import (
	"io/fs"

	"github.com/labstack/echo/v5"
)

// registerGUI is a no-op in dev builds — the frontend is served separately
// by the Vite dev server (`just fe`, :5173), which proxies /api/* here.
func registerGUI(e *echo.Echo, embedded fs.FS) {}
