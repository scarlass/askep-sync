package cmd

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/scarlass/askep-sync/internal/configs"
	"github.com/scarlass/askep-sync/internal/logger"
	"github.com/scarlass/askep-sync/internal/utils"
	"github.com/spf13/cobra"
)

var (
	InitCmd = &cobra.Command{
		Use:   "init",
		Long:  "initialize askep configuration file in current working directory",
		Short: "initialize askep configuration file",

		PreRunE: InitPreRun,
		RunE:    configs.SetupRun(InitRun),
	}
)

func InitPreRun(cmd *cobra.Command, args []string) error {
	return nil
}
func InitRun(cmd *cobra.Command, args []string) error {
	cwd, _ := os.Getwd()
	filename := filepath.Join(cwd, utils.CONFIGURATION_FILE)
	inf, err := os.Stat(filename)

	if err == nil {
		if inf.IsDir() {
			return fmt.Errorf("%s is a directory", utils.CONFIGURATION_FILE)
		}

		logger.Warnf("%s already exist", utils.CONFIGURATION_FILE)
		return nil
	} else {
		if !errors.Is(err, os.ErrNotExist) {
			return err
		}
	}

	content, err := configs.GenerateTemplate("config", map[string]any{})
	if err != nil {
		return err
	}

	if err := os.WriteFile(filename, content, 0644); err != nil {
		return err
	}

	logger.Info("askep.config.yaml created")
	return nil
}
