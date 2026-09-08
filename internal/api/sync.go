package api

import (
	"github.com/labstack/echo/v5"
	"github.com/scarlass/askep-sync/internal/configs"
	"github.com/scarlass/askep-sync/internal/core"
)

type syncTargetBody struct {
	Profile string `json:"profile"`
	Alid    int    `json:"alid"`
}

// SyncTarget pushes a target's current compiled HTML into askep_list, via the
// same Profile.Update path used by `askep sync`. The alid supplied by the
// client is saved into askep.config.yaml as the target's mapping for that
// profile if it's new or has changed, so the dialog also doubles as the way
// to set up (or fix) a target<->alid mapping without hand-editing the config.
func (r *api_routes) SyncTarget(c *echo.Context) error {
	name := c.Param("name")

	var body syncTargetBody
	if err := c.Bind(&body); err != nil {
		return c.JSON(400, map[string]string{"error": err.Error()})
	}
	if body.Profile == "" {
		return c.JSON(400, map[string]string{"error": "profile is required"})
	}
	if body.Alid <= 0 {
		return c.JSON(400, map[string]string{"error": "alid must be a positive number"})
	}

	targets, err := r.project.UseTarget(name)
	if err != nil {
		return c.JSON(404, map[string]string{"error": err.Error()})
	}
	target := targets[0]

	if _, err := r.project.UseProfile(body.Profile); err != nil {
		return c.JSON(400, map[string]string{"error": err.Error()})
	}

	r.project.Lock()
	if existing, ok := target.GetProfileAlid(body.Profile); !ok || existing != body.Alid {
		if target.Conf.Alids == nil {
			target.Conf.Alids = configs.TargetProfileMapConfig{}
		}
		target.Conf.Alids[body.Profile] = body.Alid
		err = r.project.ConfigWrite()
	}
	r.project.Unlock()
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	profile, err := r.connectedProfile(body.Profile)
	if err != nil {
		return c.JSON(400, map[string]string{"error": err.Error()})
	}

	html, err := target.Output()
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	attrs := target.Attributes()
	if err := profile.Update(c.Request().Context(), core.AskepUpdateParam{
		Alid:          body.Alid,
		Html:          html,
		NamaForm:      attrs.NamaForm,
		KodeForm:      attrs.KodeForm,
		InisialForm:   attrs.InisialForm,
		KodeSatusehat: attrs.KodeSatusehat,
	}); err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	return c.JSON(200, map[string]any{"ok": true, "alid": body.Alid})
}
