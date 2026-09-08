package core

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

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

	mu       sync.Mutex
	lastConf []byte // last known on-disk content of ConfigPath(), used to tell external edits from our own ConfigWrite()
}

// Lock/Unlock serialize config-mutating API handlers against each other and
// against WatchConfig's reload — both end up replacing pr.Conf/profiles/targets.
func (pr *Project) Lock()   { pr.mu.Lock() }
func (pr *Project) Unlock() { pr.mu.Unlock() }

func NewProject(cwd string, conf *configs.ProjectConfig) (*Project, error) {
	project := &Project{
		cwd:  cwd,
		Conf: conf,
	}

	if data, err := os.ReadFile(project.ConfigPath()); err == nil {
		project.lastConf = data
	}

	if utils.FileExist(configs.TemplateDir(cwd)) {
		migrateLegacyTemplates(cwd)
	}

	profiles, targets, err := buildProfilesAndTargets(project, conf)
	if err != nil {
		return nil, err
	}

	project.profiles = profiles
	project.targets = targets
	return project, nil
}

func buildProfilesAndTargets(project *Project, conf *configs.ProjectConfig) ([]*Profile, []*Target, error) {
	profiles := make([]*Profile, 0)
	for key, profileconf := range conf.Profiles {
		profile, err := NewProfile(key, project, profileconf)
		if err != nil {
			return nil, nil, fmt.Errorf("unable configure project profile %s: %w", key, err)
		}

		profiles = append(profiles, profile)
	}

	targets := make([]*Target, 0)
	for key, targetconf := range conf.Targets {
		target, err := NewTarget(key, project, targetconf)
		if err != nil {
			return nil, nil, fmt.Errorf("unable configure project target %s: %w", key, err)
		}

		targets = append(targets, target)
	}

	return profiles, targets, nil
}

// reload re-reads ConfigPath() from disk and, if its content actually changed
// since the last known state (our own ConfigWrite() included), replaces
// Conf/profiles/targets in place. Locks internally — called from the watcher
// goroutine, which does not otherwise hold pr.mu. A parse or
// target/profile-construction error leaves the previous, still-valid config
// in place rather than crashing the running server. changed reports whether
// anything was actually swapped in (false covers both "no real change" and
// "our own ConfigWrite() triggered this event").
func (pr *Project) reload() (changed bool, err error) {
	data, err := os.ReadFile(pr.ConfigPath())
	if err != nil {
		return false, err
	}

	pr.mu.Lock()
	defer pr.mu.Unlock()

	if bytes.Equal(data, pr.lastConf) {
		return false, nil
	}

	conf := new(configs.ProjectConfig)
	if _, err := configs.FindAndLoad(pr.ConfigPath(), conf); err != nil {
		return false, err
	}
	delete(conf.Targets, "*") // mirrors cmd/utils.go:loadProject

	profiles, targets, err := buildProfilesAndTargets(pr, conf)
	if err != nil {
		return false, err
	}

	pr.Conf = conf
	pr.profiles = profiles
	pr.targets = targets
	pr.lastConf = data
	return true, nil
}

func (pr *Project) ID() string {
	return pr.cwd
}

func (pr *Project) Cwd() string { return pr.cwd }

func (pr *Project) ConfigPath() string {
	return filepath.Join(pr.cwd, utils.CONFIGURATION_FILE)
}

// ConfigWrite marshals Conf and writes it to ConfigPath(). Callers mutating
// Conf must already hold pr.Lock() (see api_routes handlers) — this keeps it
// serialized against WatchConfig's reload(), which takes the same lock.
func (pr *Project) ConfigWrite() error {
	out, err := yaml.Marshal(pr.Conf)
	if err != nil {
		return fmt.Errorf("unable to write into yaml: %w", err)
	}

	if err := os.WriteFile(pr.ConfigPath(), out, 0644); err != nil {
		return err
	}
	pr.lastConf = out
	return nil
}

func (pr *Project) MakeTemplateDir() error {
	path := configs.TemplateDir(pr.cwd)
	if utils.FileExist(path) {
		return nil
	}

	logger.Infof("configure template directory")

	os.MkdirAll(path, 0755)
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

	errs := []error{}
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
			errs = append(errs, fmt.Errorf("target %q not found in project configuration", name))
			continue
		}
	}

	if len(errs) > 0 {
		return nil, errors.Join(errs...)
	}

	return targets, nil
}
