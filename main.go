package main

import (
	"embed"
	"os"

	"github.com/scarlass/askep-sync/cmd"
	"github.com/spf13/cobra"
)

//go:embed form-builder/dist
var frontend embed.FS

func main() {
	root := cobra.Command{
		Use: "askep",
	}

	cmd.ServeFlags.FS = frontend

	root.AddCommand(
		cmd.InitCmd,
		cmd.SyncCmd,
		cmd.ServeCmd,
	)

	if err := root.Execute(); err != nil {
		// fmt.Fprintf(root.ErrOrStderr(), "Error: %s\n", err.Error())
		os.Exit(1)
	}
}
