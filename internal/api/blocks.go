package api

import (
	"io"
	"os"

	"github.com/labstack/echo/v5"
	"github.com/scarlass/askep-sync/internal/configs"
	"github.com/scarlass/askep-sync/internal/utils"
)

func (r *api_routes) GetBlocks(c *echo.Context) error {
	path := configs.GlobalBlocksFile()
	if !utils.FileExist(path) {
		return c.JSONBlob(200, []byte("[]"))
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	return c.JSONBlob(200, data)
}

func (r *api_routes) SaveBlocks(c *echo.Context) error {
	body, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.JSON(400, map[string]string{"error": err.Error()})
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if err := os.WriteFile(configs.GlobalBlocksFile(), body, 0644); err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	return c.JSON(200, map[string]bool{"ok": true})
}
