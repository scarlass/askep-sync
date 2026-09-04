package configs

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
)

func LoadEnv(cwd string) {
	envpath := filepath.Join(cwd, ".env")
	godotenv.Load(envpath)
}

func LookupEnv(profile string, conf string, tag string) (string, bool) {
	key := fmt.Sprintf("PROFILE_%s_%s_%s",
		strings.ToUpper(profile),
		strings.ToUpper(conf),
		strings.ToUpper(tag))
	return os.LookupEnv(key)
}
