package configs

import (
	"os"
	"path/filepath"
	"slices"

	"github.com/scarlass/askep-sync/internal/utils"
	"github.com/spf13/cobra"

	_ "modernc.org/sqlite"
)

func GlobalDir() string {
	configdir, err := os.UserConfigDir()
	if err != nil {
		panic(err)
	}
	return filepath.Join(configdir, "askep-builder")
}
func GlobalStorageDB() string {
	return filepath.Join(GlobalDir(), "setting.db")
}
func GlobalBlocksFile() string {
	return filepath.Join(GlobalDir(), "blocks.json")
}

func TemplateDir(cwd string, paths ...string) string {
	paths = slices.Concat([]string{cwd, ".askep"}, paths)
	return filepath.Join(paths...)
}

// var _db *sql.DB
// var _queries *db.Queries
// func Queries() *db.Queries {
// 	if _queries == nil {
// 		panic("global storage is not initialized")
// 	}
// 	return _queries
// }

func SetupRun(callback func(*cobra.Command, []string) error) func(*cobra.Command, []string) error {
	return func(cmd *cobra.Command, args []string) error {
		globaldir := GlobalDir()
		if !utils.FileExist(globaldir) {
			os.MkdirAll(globaldir, 0775)
		}

		// if _db == nil {
		// 	ds, err := sql.Open("sqlite", GlobalStorageDB())
		// 	if err != nil {
		// 		return fmt.Errorf("storage open error: %w", err)
		// 	}

		// 	if err := ds.Ping(); err != nil {
		// 		return fmt.Errorf("storage ping error: %w", err)
		// 	}

		// 	defer ds.Close()

		// 	if err := database.Migrate(cmd.Context(), ds); err != nil {
		// 		return err
		// 	}

		// 	_db = ds
		// 	_queries = db.New(ds)
		// }
		return callback(cmd, args)
	}
}
