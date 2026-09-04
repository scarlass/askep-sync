package api

import (
	"context"
	"fmt"
	"io/fs"
	"sort"
	"sync"

	"github.com/labstack/echo/v5"
	"github.com/scarlass/askep-sync/internal/core"
)

func Register(e *echo.Echo, fs fs.FS, project *core.Project) {
	r := &api_routes{project: project}

	e.GET("/test", r.Test)

	g := e.Group("/api")
	g.GET("/profiles", r.ListProfiles)
	g.GET("/targets", r.ListTargets)
	g.POST("/targets", r.CreateTarget)
	g.GET("/targets/:name/preview", r.PreviewTarget)
	g.GET("/targets/:name/metadata", r.GetTargetMetadata)
	g.PUT("/targets/:name/metadata", r.SaveTargetMetadata)
	g.PUT("/targets/:name/attributes", r.SaveTargetAttributes)
	g.POST("/targets/:name/sync", r.SyncTarget)
	g.GET("/blocks", r.GetBlocks)
	g.PUT("/blocks", r.SaveBlocks)

	registerGUI(e, fs)
}

type api_routes struct {
	project *core.Project
	mu      sync.Mutex

	profilesMu sync.Mutex
	profiles   map[string]*core.Profile // connected profiles, keyed by name, reused across sync requests
}

func (r *api_routes) ListProfiles(c *echo.Context) error {
	out := make([]string, 0, len(r.project.Conf.Profiles))
	for name := range r.project.Conf.Profiles {
		out = append(out, name)
	}
	sort.Strings(out)
	return c.JSON(200, out)
}

func (*api_routes) Test(c *echo.Context) error {
	c.JSON(200, map[string]any{
		"status": "ok",
	})
	return nil
}

// connectedProfile returns a cached, already-connected *core.Profile for name,
// connecting it the first time it's requested. The pool is meant to outlive
// any single HTTP request, so connecting itself uses context.Background()
// rather than the triggering request's context.
func (r *api_routes) connectedProfile(name string) (*core.Profile, error) {
	r.profilesMu.Lock()
	defer r.profilesMu.Unlock()

	if r.profiles == nil {
		r.profiles = map[string]*core.Profile{}
	}
	if p, ok := r.profiles[name]; ok {
		return p, nil
	}

	profiles, err := r.project.UseProfile(name)
	if err != nil {
		return nil, err
	}

	profile := profiles[0]
	if err := profile.Connect(context.Background()); err != nil {
		return nil, fmt.Errorf("connect profile %q: %w", name, err)
	}

	r.profiles[name] = profile
	return profile, nil
}
