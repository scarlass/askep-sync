package core

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"

	"github.com/google/uuid"
	"github.com/scarlass/askep-sync/internal/configs"
	"github.com/scarlass/askep-sync/internal/utils"
)

type Template struct {
	conf    *configs.TemplateConfig
	cwd     string
	project *Project
}

func NewTemplate(project *Project, conf *configs.TemplateConfig) (*Template, error) {
	cwd := configs.TemplateDir(project.cwd, conf.ID.String())
	tmpl := &Template{
		conf:    conf,
		cwd:     cwd,
		project: project,
	}

	return tmpl, nil
}

func (t *Template) ID() uuid.UUID {
	return t.conf.ID
}

func (t *Template) JoinPath(parts ...string) string {
	return filepath.Join(slices.Concat([]string{t.cwd}, parts)...)
}

// Dir returns this template's own folder (.askep/<uuid>/), used to tell
// whether a resolved target.script entry lives inside it (builder-managed)
// or points elsewhere (manually configured).
func (t *Template) Dir() string {
	return t.cwd
}

func (t *Template) Exists() bool {
	return utils.FileExist(t.JoinPath("metadata.json"))
}

func (t *Template) ReadMetadata() ([]byte, error) {
	return os.ReadFile(t.JoinPath("metadata.json"))
}

func (t *Template) WriteMetadata(content []byte) error {
	if err := os.MkdirAll(t.cwd, 0755); err != nil {
		return err
	}
	return os.WriteFile(t.JoinPath("metadata.json"), content, 0644)
}

func (t *Template) WriteTemplate(content []byte) error {
	if err := os.MkdirAll(t.cwd, 0755); err != nil {
		return err
	}
	return os.WriteFile(t.JoinPath("template.html"), content, 0644)
}

var scriptNameRe = regexp.MustCompile(`^[a-zA-Z0-9_-]+\.js$`)

// WriteScript creates/overwrites a builder-managed script file by plain
// filename (no path separators — validated against scriptNameRe) inside this
// template's own folder. The caller is responsible for also registering the
// resulting path in the target's `script:` config list.
func (t *Template) WriteScript(name string, content []byte) error {
	if !scriptNameRe.MatchString(name) {
		return fmt.Errorf("invalid script name %q", name)
	}
	if err := os.MkdirAll(t.cwd, 0755); err != nil {
		return err
	}
	return os.WriteFile(t.JoinPath(name), content, 0644)
}

func (t *Template) DeleteScript(name string) error {
	if !scriptNameRe.MatchString(name) {
		return fmt.Errorf("invalid script name %q", name)
	}
	return os.Remove(t.JoinPath(name))
}
