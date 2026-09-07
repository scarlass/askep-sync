package cmd

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net/http"
	"os"
	"os/signal"

	"github.com/labstack/echo/v5"
	"github.com/scarlass/askep-sync/internal/api"
	"github.com/scarlass/askep-sync/internal/configs"
	"github.com/scarlass/askep-sync/internal/logger"
	"github.com/scarlass/askep-sync/internal/utils"
	"github.com/spf13/cobra"
)

var (
	ServeCmd = &cobra.Command{
		Use:          "serve",
		Long:         "run form-builder server",
		Short:        "run form-builder server",
		RunE:         configs.SetupRun(ServeRun),
		SilenceUsage: true,
	}
	ServeFlags = ServeConfigFlags{
		// FHost: "0.0.0.0",
		// FPort: 5180,
	}
)

type ServeConfigFlags struct {
	FS fs.FS

	FHost string
	FPort int
}

func init() {
	flags := ServeCmd.Flags()
	flags.StringVarP(&ServeFlags.FHost, "host", "H", "", "")
	flags.IntVarP(&ServeFlags.FPort, "port", "p", 0, "")
}

func ServeRun(cmd *cobra.Command, args []string) error {
	project, _, err := loadProject()
	if err != nil {
		return err
	}

	host := utils.ShiftZero(ServeFlags.FHost, project.Conf.Server.Host, "0.0.0.0")
	port := utils.ShiftZero(ServeFlags.FPort, project.Conf.Server.Port, 5180)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, os.Kill)
	defer stop()

	logger.Info("\nrunning gui form builder")
	server := echo.New()
	server.Logger = slog.New(slog.DiscardHandler)
	api.Register(server, ServeFlags.FS, project)

	project.MakeTemplateDir()

	defer project.Close()

	go func() {
		logger.Infof("-> gui served at http://%s:%d", host, port)
	}()

	conf := echo.StartConfig{Address: fmt.Sprintf("%s:%d", host, port)}
	if err := conf.Start(ctx, server); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
