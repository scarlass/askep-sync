package core

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/scarlass/askep-sync/internal/configs"
	"github.com/scarlass/askep-sync/internal/logger"
)

// migrateLegacyTemplates moves templates stored under the old flat layout
// (.askep/templates/<uuid>.json + .askep/templates/<uuid>.html) into the
// new per-template folder layout (.askep/<uuid>/metadata.json +
// .askep/<uuid>/template.html). Safe to call on every project load — it is
// a no-op once the legacy templates/ folder has nothing left to migrate.
func migrateLegacyTemplates(cwd string) {
	legacyDir := configs.TemplateDir(cwd, "templates")
	matches, err := filepath.Glob(filepath.Join(legacyDir, "*.json"))
	if err != nil || len(matches) == 0 {
		return
	}

	for _, jsonPath := range matches {
		id := strings.TrimSuffix(filepath.Base(jsonPath), ".json")
		dest := configs.TemplateDir(cwd, id)

		if err := os.MkdirAll(dest, 0755); err != nil {
			logger.Infof("migrate template %s: %v", id, err)
			continue
		}

		if err := os.Rename(jsonPath, filepath.Join(dest, "metadata.json")); err != nil {
			logger.Infof("migrate template %s metadata: %v", id, err)
			continue
		}

		htmlPath := filepath.Join(legacyDir, id+".html")
		if _, err := os.Stat(htmlPath); err == nil {
			if err := os.Rename(htmlPath, filepath.Join(dest, "template.html")); err != nil {
				logger.Infof("migrate template %s html: %v", id, err)
			}
		}
	}

	os.Remove(legacyDir)
}
