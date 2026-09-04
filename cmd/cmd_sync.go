package cmd

import (
	"fmt"
	"sync"

	"github.com/scarlass/askep-sync/internal/configs"
	"github.com/scarlass/askep-sync/internal/core"
	"github.com/scarlass/askep-sync/internal/logger"
	"github.com/spf13/cobra"
)

type SyncCmdFlags struct {
	Config  string
	Dry     bool
	Profile string

	project *core.Project
}

var (
	SyncCmd = &cobra.Command{
		Use:      "sync targets...",
		Short:    "synchronize target template to askep_list table",
		Long:     "synchronize target template to askep_list table and change form_data column",
		PreRunE:  SyncPreRun,
		RunE:     configs.SetupRun(SyncRun),
		PostRunE: SyncPostRun,

		Args:         cobra.MinimumNArgs(1),
		SilenceUsage: true,
	}
	SyncFlags = SyncCmdFlags{
		Config:  "",
		Dry:     false,
		Profile: "default",
	}
)

func init() {
	flags := SyncCmd.Flags()
	// flags.StringVarP(&SyncFlags.Config, "config", "c", SyncFlags.Config, DescSyncFlagConfig)
	flags.StringVarP(&SyncFlags.Profile, "profile", "p", SyncFlags.Profile, DescSyncFlagsProfiles)
	flags.BoolVarP(&SyncFlags.Dry, "dry", "d", false, DescSyncFlagsDry)
}

func SyncPreRun(cmd *cobra.Command, args []string) error {
	project, _, err := loadProject()
	if err != nil {
		return err
	}

	if len(args) == 0 {
		return core.ErrEmptyInputTargets
	}
	if SyncFlags.Dry && len(args) > 1 {
		return core.ErrDryModeOnly1InputTarget
	}

	if _, err := project.UseTarget(args...); err != nil {
		return err
	}

	if _, err := project.UseProfile(SyncFlags.Profile); err != nil {
		return err
	}

	SyncFlags.project = project
	return nil
}

func SyncRun(cmd *cobra.Command, args []string) error {
	logger.Dry = SyncFlags.Dry

	project := SyncFlags.project
	defer project.Close()

	if SyncFlags.Dry {
		targets, _ := project.UseTarget(args...)
		for _, t := range targets {
			content, err := t.Output()
			if err != nil {
				return err
			}

			logger.Print(content)
		}
	} else {
		profiles, _ := project.UseProfile(SyncFlags.Profile)

		profile := profiles[0]
		if err := profile.Connect(cmd.Context()); err != nil {
			return err
		}

		wg := sync.WaitGroup{}

		targets, _ := project.UseTarget(args...)
		for _, target := range targets {
			log := logger.New(target.Name())

			alid, ok := target.GetProfileAlid(profile.Name())
			if !ok {
				return fmt.Errorf("%s: target don't have profile mapping id for %q", target.Name(), profile.Name())
			}

			wg.Go(func() {
				log.Info("concating html output")
				html, err := target.Output()

				if err != nil {
					log.Errorf("unable to compile html")
					return
				}

				log.Infof("updating askep_list with id %d", alid)
				attrs := target.Attributes()
				if err := profile.Update(cmd.Context(), core.AskepUpdateParam{
					Alid:          alid,
					Html:          html,
					NamaForm:      attrs.NamaForm,
					KodeForm:      attrs.KodeForm,
					InisialForm:   attrs.InisialForm,
					KodeSatusehat: attrs.KodeSatusehat,
				}); err != nil {
					log.Errorf("failed - %s", err.Error())
				} else {
					log.Info("success")
				}
			})
		}

		wg.Wait()
	}

	return nil
}

func SyncPostRun(cmd *cobra.Command, args []string) error {
	// SyncFlags.project.Close()
	return nil
}
