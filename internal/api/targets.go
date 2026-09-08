package api

import (
	"encoding/json"
	"net/url"
	"regexp"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/labstack/echo/v5"
	"github.com/scarlass/askep-sync/internal/configs"
	"github.com/scarlass/askep-sync/internal/core"
)

type TargetSummary struct {
	Name       string              `json:"name"`
	Html       string              `json:"html"`
	IsBuilder  bool                `json:"isBuilder"`
	TemplateID string              `json:"templateId,omitempty"`
	Alids      map[string]int      `json:"alids"`
	Attributes TargetAttributesDTO `json:"attributes"`
}

type TargetAttributesDTO struct {
	NamaForm      string `json:"namaForm"`
	InisialForm   string `json:"inisialForm"`
	KodeForm      string `json:"kodeForm"`
	KodeSatusehat string `json:"kodeSatusehat"`
}

func builderID(html string) (uuid.UUID, bool) {
	uri, err := url.Parse(html)
	if err != nil || uri.Scheme != "builder" {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(uri.Host)
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}

func (r *api_routes) ListTargets(c *echo.Context) error {
	out := []TargetSummary{}
	for name, tc := range r.project.Conf.Targets {
		s := TargetSummary{Name: name, Html: tc.Html, Alids: map[string]int{}}
		if id, ok := builderID(tc.Html); ok {
			s.IsBuilder = true
			s.TemplateID = id.String()
		}
		for profileName, alid := range tc.Alids {
			s.Alids[profileName] = alid
		}
		if tc.Attributes != nil {
			s.Attributes = TargetAttributesDTO{
				NamaForm:      tc.Attributes.NamaForm,
				InisialForm:   tc.Attributes.InisialForm,
				KodeForm:      tc.Attributes.KodeForm,
				KodeSatusehat: tc.Attributes.KodeSatusehat,
			}
		}
		out = append(out, s)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return c.JSON(200, out)
}

var targetNameRe = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

type createTargetBody struct {
	Name string `json:"name"`
}

// CreateTarget adds a brand-new target. Targets created through the UI are
// always builder-backed — there is no path picker for a static html file.
func (r *api_routes) CreateTarget(c *echo.Context) error {
	var body createTargetBody
	if err := c.Bind(&body); err != nil {
		return c.JSON(400, map[string]string{"error": err.Error()})
	}

	name := strings.TrimSpace(body.Name)
	if !targetNameRe.MatchString(name) {
		return c.JSON(400, map[string]string{"error": "target name must use only letters, numbers, - or _"})
	}

	r.project.Lock()
	defer r.project.Unlock()

	if r.project.HasTarget(name) {
		return c.JSON(409, map[string]string{"error": "a target with this name already exists"})
	}

	id := uuid.New()
	tmpl, err := core.NewTemplate(r.project, &configs.TemplateConfig{ID: id})
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}
	if err := tmpl.WriteTemplate([]byte("")); err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	conf := &configs.TargetConfig{Html: "builder://" + id.String()}
	if _, err := r.project.AddTarget(name, conf); err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	if err := r.project.ConfigWrite(); err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	return c.JSON(200, TargetSummary{Name: name, Html: conf.Html, IsBuilder: true, TemplateID: id.String(), Alids: map[string]int{}})
}

func (r *api_routes) PreviewTarget(c *echo.Context) error {
	name := c.Param("name")
	targets, err := r.project.UseTarget(name)
	if err != nil {
		return c.JSON(404, map[string]string{"error": err.Error()})
	}

	html, err := targets[0].Output()
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	return c.Blob(200, "text/html; charset=utf-8", []byte(html))
}

func (r *api_routes) GetTargetMetadata(c *echo.Context) error {
	name := c.Param("name")
	tc, ok := r.project.Conf.Targets[name]
	if !ok {
		return c.JSON(404, map[string]string{"error": "target not found"})
	}

	id, ok := builderID(tc.Html)
	if !ok {
		return c.JSON(404, map[string]string{"error": "no saved builder metadata for this target"})
	}

	tmpl, err := core.NewTemplate(r.project, &configs.TemplateConfig{ID: id})
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	data, err := tmpl.ReadMetadata()
	if err != nil {
		return c.JSON(404, map[string]string{"error": "no saved builder metadata for this target"})
	}

	return c.JSONBlob(200, data)
}

type saveTargetBody struct {
	Metadata json.RawMessage `json:"metadata"`
	Html     string          `json:"html"`
}

func (r *api_routes) SaveTargetMetadata(c *echo.Context) error {
	name := c.Param("name")
	tc, ok := r.project.Conf.Targets[name]
	if !ok {
		return c.JSON(404, map[string]string{"error": "target not found"})
	}

	var body saveTargetBody
	if err := c.Bind(&body); err != nil {
		return c.JSON(400, map[string]string{"error": err.Error()})
	}
	if len(body.Metadata) == 0 {
		return c.JSON(400, map[string]string{"error": "metadata is required"})
	}

	r.project.Lock()
	defer r.project.Unlock()

	id, hasID := builderID(tc.Html)
	if !hasID {
		id = uuid.New()
	}

	tmpl, err := core.NewTemplate(r.project, &configs.TemplateConfig{ID: id})
	if err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	if err := tmpl.WriteMetadata(body.Metadata); err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}
	if err := tmpl.WriteTemplate([]byte(body.Html)); err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	newHtml := "builder://" + id.String()
	if tc.Html != newHtml {
		tc.Html = newHtml
		if err := r.project.ConfigWrite(); err != nil {
			return c.JSON(500, map[string]string{"error": err.Error()})
		}
	}

	return c.JSON(200, map[string]string{"templateId": id.String()})
}

// SaveTargetAttributes updates targets.<name>.attributes in askep.config.yaml
// (nama-form / inisial-form / kode-form / kode-satusehat) — these feed the
// UPDATE askep_list columns via Profile.Update. An all-empty submission
// clears the attributes block instead of persisting four empty strings.
func (r *api_routes) SaveTargetAttributes(c *echo.Context) error {
	name := c.Param("name")

	var body TargetAttributesDTO
	if err := c.Bind(&body); err != nil {
		return c.JSON(400, map[string]string{"error": err.Error()})
	}

	r.project.Lock()
	defer r.project.Unlock()

	tc, ok := r.project.Conf.Targets[name]
	if !ok {
		return c.JSON(404, map[string]string{"error": "target not found"})
	}

	body.NamaForm = strings.TrimSpace(body.NamaForm)
	body.InisialForm = strings.TrimSpace(body.InisialForm)
	body.KodeForm = strings.TrimSpace(body.KodeForm)
	body.KodeSatusehat = strings.TrimSpace(body.KodeSatusehat)

	if body.NamaForm == "" && body.InisialForm == "" && body.KodeForm == "" && body.KodeSatusehat == "" {
		tc.Attributes = nil
	} else {
		tc.Attributes = &configs.TargetAttributesConfig{
			NamaForm:      body.NamaForm,
			InisialForm:   body.InisialForm,
			KodeForm:      body.KodeForm,
			KodeSatusehat: body.KodeSatusehat,
		}
	}

	if err := r.project.ConfigWrite(); err != nil {
		return c.JSON(500, map[string]string{"error": err.Error()})
	}

	return c.JSON(200, body)
}
