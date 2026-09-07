package configs

import "github.com/google/uuid"

type RootConfig struct {
	Projects []*ProjectLinkConfig `yaml:"projects"`
}

type (
	ProjectLinkConfig struct {
		Path   string         `yaml:"path"`
		Config *ProjectConfig `yaml:"config"`
	}
	ProjectConfig struct {
		Server   ServerConfig              `yaml:"server,omitempty"`
		Profiles map[string]*ProfileConfig `yaml:"profiles"`
		Targets  map[string]*TargetConfig  `yaml:"targets"`
	}
)

type ServerConfig struct {
	Host string `yaml:"host,omitempty"`
	Port int    `yaml:"port,omitempty"`
}

type (
	ProfileConfig struct {
		Host     string              `yaml:"host" dsn:"host"`
		Port     int                 `yaml:"port" dsn:"port"`
		User     string              `yaml:"user" dsn:"user"`
		Password string              `yaml:"password" dsn:"password"`
		Database string              `yaml:"database" dsn:"dbname"`
		Schema   string              `yaml:"schema" dsn:"search_path"`
		Proxy    *ProfileProxyConfig `yaml:"proxy,omitempty"`
	}
	ProfileProxyConfig struct {
		Host     string `yaml:"host,omitempty"`
		Port     int    `yaml:"port,omitempty"`
		User     string `yaml:"user,omitempty"`
		Password string `yaml:"password,omitempty"`
	}
)

type (
	// mapping alid per database profile
	TargetConfig struct {
		Html       string                  `yaml:"html"`
		Stylesheet []string                `yaml:"stylesheet,omitempty"`
		Script     []string                `yaml:"script,omitempty"`
		Attributes *TargetAttributesConfig `yaml:"attributes,omitempty"`
		Alids      TargetProfileMapConfig  `yaml:"alids,omitempty"`
	}
	TargetProfileMapConfig map[string]int
	TargetAttributesConfig struct {
		NamaForm      string `yaml:"nama-form,omitempty"`
		InisialForm   string `yaml:"inisial-form,omitempty"`
		KodeForm      string `yaml:"kode-form,omitempty"`
		KodeSatusehat string `yaml:"kode-satusehat,omitempty"`
	}
)

type TemplateConfig struct {
	ID       uuid.UUID
	Metadata string
	Template string
}
