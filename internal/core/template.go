package core

import (
	"os"
	"path/filepath"
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
	cwd := configs.TemplateDir(project.cwd)
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

func (t *Template) Exists() bool {
	return utils.FileExist(t.JoinPath("templates", t.ID().String()+".json"))
}

func (t *Template) ReadMetadata() ([]byte, error) {
	return os.ReadFile(t.JoinPath("templates", t.ID().String()+".json"))
}

func (t *Template) WriteMetadata(content []byte) error {
	path := t.JoinPath("templates", t.ID().String()+".json")
	os.WriteFile(path, content, 0644)
	return nil
}

func (t *Template) WriteTemplate(content []byte) error {
	path := t.JoinPath("templates", t.ID().String()+".html")
	os.WriteFile(path, content, 0644)
	return nil
}
