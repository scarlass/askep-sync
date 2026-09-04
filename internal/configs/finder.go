package configs

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/go-viper/mapstructure/v2"
	"github.com/scarlass/askep-sync/internal/utils"
	"github.com/spf13/viper"
)

func Lookup(cwd string, filenames ...string) (string, error) {
	lookup := []string{}

	dir := cwd
	for {
		for _, filename := range filenames {
			file := filepath.Join(dir, filename)
			lookup = append(lookup, file)
			if inf, serr := os.Stat(file); serr == nil && !inf.IsDir() {
				return file, nil
			}
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	errs := []error{
		os.ErrNotExist,
	}

	for _, p := range lookup {
		errs = append(errs, fmt.Errorf("%s", p))
	}

	return "", errors.Join(errs...)
}

func Find(config string) (cwd, resolved string, err error) {
	if config == "" {
		cwd, _ = os.Getwd()
		resolved, err = Lookup(cwd, utils.CONFIGURATION_FILE_CANDIDATES...)
		if err != nil {
			return cwd, resolved, fmt.Errorf("")
		}
	} else {
		cwd = filepath.Dir(config)

		info, err := os.Stat(config)
		if err != nil {
			resolved = config
			return cwd, config, err
		} else if info.IsDir() {
			return cwd, config, errors.New("config path is a directory")
		}
	}
	return
}

func FindAndLoad(config string, target any) (cwd string, err error) {
	utils.MustPointer(target)

	var resolved string
	cwd, resolved, err = Find(config)
	if err != nil {
		return
	}

	LoadEnv(cwd)

	file, err := os.ReadFile(resolved)
	if err != nil {
		return cwd, fmt.Errorf("unable to read file: %w", err)
	}

	reader := bytes.NewBuffer(file)

	viper.SetConfigType("yaml")
	if err := viper.ReadConfig(reader); err != nil {
		return cwd, fmt.Errorf("unable to apply configuration: %w", err)
	}

	if err := viper.Unmarshal(
		target,
		func(dc *mapstructure.DecoderConfig) {
			dc.TagName = "yaml"
		},
	); err != nil {
		return cwd, fmt.Errorf("unmarshal failed: %w", err)
	}

	return
}
