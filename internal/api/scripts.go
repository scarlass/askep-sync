package api

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/scarlass/askep-sync/internal/configs"
	"github.com/scarlass/askep-sync/internal/core"
)

type ScriptDTO struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Source string `json:"source"` // "builder" | "manual"
}

// scriptHandle resolves a builder-backed target's Template plus its raw
// TargetConfig (which owns the single `script:` yaml list — both manually
// configured paths and builder-created files registered into it).
func (r *api_routes) scriptHandle(name string) (*core.Target, *core.Template, *configs.TargetConfig, error) {
	tc, ok := r.project.Conf.Targets[name]
	if !ok {
		return nil, nil, nil, fmt.Errorf("target not found")
	}

	id, ok := builderID(tc.Html)
	if !ok {
		return nil, nil, nil, fmt.Errorf("target is not builder-backed")
	}

	targets, err := r.project.UseTarget(name)
	if err != nil {
		return nil, nil, nil, err
	}

	tmpl, err := core.NewTemplate(r.project, &configs.TemplateConfig{ID: id})
	if err != nil {
		return nil, nil, nil, err
	}

	return targets[0], tmpl, tc, nil
}

// isBuilderManaged reports whether a resolved script path lives inside the
// template's own folder (.askep/<uuid>/) — i.e. it was created through the
// Script tab's "+ Add script", as opposed to a manually configured path
// pointing elsewhere.
func isBuilderManaged(tmpl *core.Template, resolvedPath string) bool {
	rel, err := filepath.Rel(tmpl.Dir(), resolvedPath)
	if err != nil {
		return false
	}
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

func (r *api_routes) ListTargetScripts(c *echo.Context) error {
	name := c.Param("name")
	target, tmpl, tc, err := r.scriptHandle(name)
	if err != nil {
		return c.JSON(404, map[string]string{"error": err.Error()})
	}

	out := []ScriptDTO{}
	for i, raw := range tc.Script {
		resolved, rerr := target.ResolveScript(i)
		if rerr != nil {
			continue
		}
		if isBuilderManaged(tmpl, resolved) {
			out = append(out, ScriptDTO{ID: strconv.Itoa(i), Name: filepath.Base(resolved), Source: "builder"})
		} else {
			out = append(out, ScriptDTO{ID: strconv.Itoa(i), Name: raw, Source: "manual"})
		}
	}

	return c.JSON(200, out)
}

type createScriptBody struct {
	Name string `json:"name"`
}

// CreateTargetScript writes a new builder-managed *.js file inside the
// template's own folder and registers it in the target's `script:` config
// list (same place manually configured scripts live), so both show up
// together and Output() picks it up with no special-casing.
func (r *api_routes) CreateTargetScript(c *echo.Context) error {
	name := c.Param("name")

	var body createScriptBody
	if err := c.Bind(&body); err != nil {
		return c.JSON(400, map[string]string{"error": err.Error()})
	}

	filename := strings.TrimSpace(body.Name)
	if filename != "" && !strings.HasSuffix(filename, ".js") {
		filename += ".js"
	}

	r.project.Lock()
	defer r.project.Unlock()

	_, tmpl, tc, err := r.scriptHandle(name)
	if err != nil {
		return c.JSON(404, map[string]string{"error": err.Error()})
	}

	if err := tmpl.WriteScript(filename, []byte("")); err != nil {
		return c.JSON(400, map[string]string{"error": err.Error()})
	}

	relPath, err := filepath.Rel(r.project.Cwd(), tmpl.JoinPath(filename))
	if err != nil {
		relPath = tmpl.JoinPath(filename)
	}

	tc.Script = append(tc.Script, relPath)
	if err := r.project.ConfigWrite(); err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	return c.JSON(200, ScriptDTO{ID: strconv.Itoa(len(tc.Script) - 1), Name: filename, Source: "builder"})
}

func (r *api_routes) GetTargetScriptContent(c *echo.Context) error {
	name := c.Param("name")
	idx, err := strconv.Atoi(c.QueryParam("id"))
	if err != nil {
		return c.JSON(400, map[string]string{"error": "invalid script id"})
	}

	target, _, _, err := r.scriptHandle(name)
	if err != nil {
		return c.JSON(404, map[string]string{"error": err.Error()})
	}

	path, err := target.ResolveScript(idx)
	if err != nil {
		return c.JSON(404, map[string]string{"error": err.Error()})
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return c.JSON(404, map[string]string{"error": err.Error()})
	}

	return c.JSON(200, map[string]string{"content": string(content)})
}

type saveScriptBody struct {
	ID      string `json:"id"`
	Content string `json:"content"`
}

func (r *api_routes) SaveTargetScriptContent(c *echo.Context) error {
	name := c.Param("name")

	var body saveScriptBody
	if err := c.Bind(&body); err != nil {
		return c.JSON(400, map[string]string{"error": err.Error()})
	}

	idx, err := strconv.Atoi(body.ID)
	if err != nil {
		return c.JSON(400, map[string]string{"error": "invalid script id"})
	}

	target, _, _, err := r.scriptHandle(name)
	if err != nil {
		return c.JSON(404, map[string]string{"error": err.Error()})
	}

	path, err := target.ResolveScript(idx)
	if err != nil {
		return c.JSON(404, map[string]string{"error": err.Error()})
	}

	if err := os.WriteFile(path, []byte(body.Content), 0644); err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	return c.JSON(200, map[string]string{"status": "ok"})
}

func (r *api_routes) DeleteTargetScript(c *echo.Context) error {
	name := c.Param("name")
	idx, err := strconv.Atoi(c.QueryParam("id"))
	if err != nil {
		return c.JSON(400, map[string]string{"error": "invalid script id"})
	}

	r.project.Lock()
	defer r.project.Unlock()

	target, tmpl, tc, err := r.scriptHandle(name)
	if err != nil {
		return c.JSON(404, map[string]string{"error": err.Error()})
	}

	if idx < 0 || idx >= len(tc.Script) {
		return c.JSON(404, map[string]string{"error": "script not found"})
	}

	resolved, err := target.ResolveScript(idx)
	if err != nil {
		return c.JSON(404, map[string]string{"error": err.Error()})
	}
	if !isBuilderManaged(tmpl, resolved) {
		return c.JSON(400, map[string]string{"error": "only builder-managed scripts can be deleted here; edit askep.config.yaml for manual entries"})
	}

	if err := tmpl.DeleteScript(filepath.Base(resolved)); err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	tc.Script = append(tc.Script[:idx], tc.Script[idx+1:]...)
	if err := r.project.ConfigWrite(); err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	return c.JSON(200, map[string]string{"status": "ok"})
}
