package core

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/scarlass/askep-sync/internal/configs"
	"github.com/scarlass/askep-sync/internal/logger"
	"github.com/scarlass/askep-sync/internal/utils"
	"go.yaml.in/yaml/v3"
)

type Project struct {
	Conf *configs.ProjectConfig

	cwd       string
	profiles  []*Profile
	targets   []*Target
	templates []*Template
}

func NewProject(cwd string, conf *configs.ProjectConfig) (*Project, error) {
	project := &Project{
		cwd:  cwd,
		Conf: conf,
	}

	if utils.FileExist(configs.TemplateDir(cwd)) {
	}

	profiles := make([]*Profile, 0)
	for key, profileconf := range conf.Profiles {
		profile, err := NewProfile(key, project, profileconf)
		if err != nil {
			return nil, fmt.Errorf("unable configure project profile %s: %w", key, err)
		}

		profiles = append(profiles, profile)
	}

	targets := make([]*Target, 0)
	for key, targetconf := range conf.Targets {
		target, err := NewTarget(key, project, targetconf)
		if err != nil {
			return nil, fmt.Errorf("unable configure project target %s: %w", key, err)
		}

		targets = append(targets, target)
	}

	project.profiles = profiles
	project.targets = targets
	return project, nil
}

func (pr *Project) ID() string {
	return pr.cwd
}

func (pr *Project) Cwd() string { return pr.cwd }

func (pr *Project) ConfigPath() string {
	return filepath.Join(pr.cwd, utils.CONFIGURATION_FILE)
}

func (pr *Project) ConfigWrite() error {
	out, err := yaml.Marshal(pr.Conf)
	if err != nil {
		return fmt.Errorf("unable to write into yaml: %w", err)
	}

	return os.WriteFile(pr.ConfigPath(), out, 0644)
}

func (pr *Project) MakeTemplateDir() error {
	path := configs.TemplateDir(pr.cwd)
	if utils.FileExist(path) {
		return nil
	}

	logger.Infof("configure template directory")

	os.MkdirAll(path, 0755)
	os.MkdirAll(configs.TemplateDir(pr.cwd, "templates"), 0755)
	// os.WriteFile(configs.TemplateDir(pr.cwd, utils.TEMPLATE_CONFIGURATION_FILE), []byte("version: 1\n"), 0644)
	return nil
}

func (pr *Project) Close() {
	for _, profile := range pr.profiles {
		profile.Close()
	}
}

func (pr *Project) UseProfile(names ...string) ([]*Profile, error) {
	profiles := make([]*Profile, 0)

	for _, name := range names {
		found := false
		for _, prof := range pr.profiles {
			if strings.EqualFold(prof.Name(), name) {
				profiles = append(profiles, prof)
				found = true
				break
			}
		}

		if !found {
			return nil, fmt.Errorf("profile %q not found in project configuration", name)
		}
	}

	return profiles, nil
}

func (pr *Project) HasTarget(name string) bool {
	for _, trg := range pr.targets {
		if strings.EqualFold(trg.Name(), name) {
			return true
		}
	}
	return false
}

func (pr *Project) AddTarget(name string, conf *configs.TargetConfig) (*Target, error) {
	target, err := NewTarget(name, pr, conf)
	if err != nil {
		return nil, err
	}

	if pr.Conf.Targets == nil {
		pr.Conf.Targets = map[string]*configs.TargetConfig{}
	}
	pr.Conf.Targets[name] = conf
	pr.targets = append(pr.targets, target)

	return target, nil
}

func (pr *Project) UseTarget(names ...string) ([]*Target, error) {
	targets := make([]*Target, 0)

	for _, name := range names {
		found := false
		for _, trg := range pr.targets {
			if strings.EqualFold(trg.Name(), name) {
				targets = append(targets, trg)
				found = true
				break
			}
		}

		if !found {
			return nil, fmt.Errorf("target %q not found in project configuration", name)
		}
	}

	return targets, nil
}
