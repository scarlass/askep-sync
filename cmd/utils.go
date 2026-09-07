package cmd

import (
	"fmt"

	"github.com/scarlass/askep-sync/internal/configs"
	"github.com/scarlass/askep-sync/internal/core"
)

func loadProject() (project *core.Project, cwd string, err error) {
	conf := new(configs.ProjectConfig)

	cwd, err = configs.FindAndLoad(SyncFlags.Config, &conf)
	if err != nil {
		return nil, "", fmt.Errorf("load project configuration: %w", err)
	}

	delete(conf.Targets, "*")

	// logger.JsonPrint(conf)

	project, err = core.NewProject(cwd, conf)
	return
}
