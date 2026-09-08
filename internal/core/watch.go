package core

import (
	"context"
	"path/filepath"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/scarlass/askep-sync/internal/logger"
)

// WatchConfig watches ConfigPath()'s directory (not the file itself — editors
// commonly save atomically via temp-file+rename, which breaks a watch on the
// file directly) and reloads Conf whenever it actually changes on disk. This
// is what lets a hand-edit to askep.config.yaml made while `serve` is running
// survive the next config-mutating API call, instead of being silently
// overwritten by the stale in-memory copy. Returns once ctx is done.
func (pr *Project) WatchConfig(ctx context.Context) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		logger.Infof("config watch disabled: %v", err)
		return
	}
	defer watcher.Close()

	dir := filepath.Dir(pr.ConfigPath())
	if err := watcher.Add(dir); err != nil {
		logger.Infof("config watch disabled: %v", err)
		return
	}

	var debounce *time.Timer
	defer func() {
		if debounce != nil {
			debounce.Stop()
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return

		case ev, ok := <-watcher.Events:
			if !ok {
				return
			}
			if filepath.Clean(ev.Name) != pr.ConfigPath() {
				continue
			}
			if ev.Op&(fsnotify.Write|fsnotify.Create) == 0 {
				continue
			}

			if debounce != nil {
				debounce.Stop()
			}
			debounce = time.AfterFunc(300*time.Millisecond, func() {
				changed, err := pr.reload()
				if err != nil {
					logger.Infof("config reload failed, keeping previous config: %v", err)
				} else if changed {
					logger.Infof("askep.config.yaml changed on disk, reloaded")
				}
			})

		case _, ok := <-watcher.Errors:
			if !ok {
				return
			}
		}
	}
}
