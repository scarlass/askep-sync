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
		Server   ServerConfig              `yaml:"server"`
		Profiles map[string]*ProfileConfig `yaml:"profiles"`
		Targets  map[string]*TargetConfig  `yaml:"targets"`
	}
)

type ServerConfig struct {
	Host string `yaml:"host"`
	Port int    `yaml:"port"`
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
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		User     string `yaml:"user"`
		Password string `yaml:"password"`
	}
)

type (
	// mapping alid per database profile
	TargetConfig struct {
		Name       string
		Html       string                  `yaml:"html"`
		Stylesheet []string                `yaml:"stylesheet"`
		Script     []string                `yaml:"script"`
		Attributes *TargetAttributesConfig `yaml:"attributes"`
		Alids      TargetProfileMapConfig  `yaml:"alids"`
	}
	TargetProfileMapConfig map[string]int
	TargetAttributesConfig struct {
		NamaForm      string `yaml:"nama-form"`
		InisialForm   string `yaml:"inisial-form"`
		KodeForm      string `yaml:"kode-form"`
		KodeSatusehat string `yaml:"kode-satusehat"`
	}
)

type TemplateConfig struct {
	ID       uuid.UUID
	Metadata string
	Template string
}
