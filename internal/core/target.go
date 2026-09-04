package core

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/scarlass/askep-sync/internal/configs"
	"github.com/scarlass/askep-sync/internal/utils"
)

type Target struct {
	Conf *configs.TargetConfig

	name    string
	project *Project

	isFromBuilder bool
	html          string
	stylesheets   []string
	scripts       []string
}

func NewTarget(name string, project *Project, conf *configs.TargetConfig) (*Target, error) {
	t := &Target{
		name:    name,
		Conf:    conf,
		project: project,
	}

	if err := t.resolve(); err != nil {
		return nil, err
	}

	return t, nil
}

func (t *Target) Name() string {
	return t.name
}

func (t *Target) Output() (string, error) {
	scripts := []string{}
	stylesheets := []string{}

	if len(t.stylesheets) > 0 {
		for _, style := range t.stylesheets {
			if exist := utils.FileExist(style); !exist {
				continue
			}

			content, _ := os.ReadFile(style)
			section := fmt.Sprintf("<style>\n%s\n</style>", string(content))

			stylesheets = append(stylesheets, section)
		}
	}

	if len(t.scripts) > 0 {
		for _, script := range t.scripts {
			if exists := utils.FileExist(script); !exists {
				continue
			}

			content, _ := os.ReadFile(script)
			section := fmt.Sprintf("<script>\n%s\n</script>", string(content))

			scripts = append(scripts, section)
		}
	}

	html, _ := os.ReadFile(t.html)

	ss_rgx := regexp.MustCompile(`\{\{\s*\.Stylesheet\s*\}\}`)
	ss_indexes := ss_rgx.FindSubmatchIndex(html)
	if len(ss_indexes) > 0 {
		html = slices.Concat(
			html[:ss_indexes[0]],
			[]byte(strings.Join(stylesheets, "\n")),
			html[ss_indexes[1]:],
		)
	} else {
		html = slices.Concat(
			[]byte(strings.Join(stylesheets, "\n")),
			[]byte{'\n', '\n'},
			html,
		)
	}

	scr_rgx := regexp.MustCompile(`\{\{\s*\.Script\s*\}\}`)
	scr_indexes := scr_rgx.FindSubmatchIndex(html)
	if len(scr_indexes) > 0 {
		html = slices.Concat(
			html[:scr_indexes[0]],
			[]byte(strings.Join(scripts, "\n")),
			html[scr_indexes[1]:],
		)
	} else {
		html = slices.Concat(
			html,
			[]byte{'\n', '\n'},
			[]byte(strings.Join(scripts, "\n")),
		)
	}

	return string(html), nil
}

func (t *Target) Attributes() *configs.TargetAttributesConfig {
	if t.Conf.Attributes == nil {
		return &configs.TargetAttributesConfig{}
	}
	return t.Conf.Attributes
}

func (t *Target) GetProfileAlid(name string) (alid int, ok bool) {
	for key, value := range t.Conf.Alids {
		if strings.EqualFold(key, name) {
			return value, true
		}
	}
	return
}

// func (t *Target) from_builder() {}

// func (t *Target) from_static() (string, error) {
// }

var err_empty_html = `
%-5s | properly specify target html in configuration and make sure the file exists:
    - current html path -> %q (not found)`

func (t *Target) resolve() (err error) {
	raw_path := t.Conf.Html
	if raw_path == "" {
		return fmt.Errorf(err_empty_html, t.name, t.html)
	}

	var uri *url.URL
	uri, perr := url.Parse(raw_path)
	if perr == nil && uri.Scheme == "builder" {
		var id uuid.UUID
		id, err = uuid.Parse(uri.Host)
		if err != nil {
			return fmt.Errorf("invalid builder template reference %q for target %s: %w", raw_path, t.name, err)
		}

		t.html = configs.TemplateDir(t.project.cwd, "templates", id.String()+".html")
		if !utils.FileExist(t.html) {
			return fmt.Errorf(err_empty_html, t.name, t.html)
		}
		return nil
	}

	cwd := t.project.cwd
	defaultPath := filepath.Join(cwd, t.name)

	t.html, err = t.resolve_path(raw_path, filepath.Join(defaultPath, "index.html"))
	if err != nil {
		return
	} else if !utils.FileExist(t.html) {
		return fmt.Errorf(err_empty_html, t.name, t.html)
	}

	t.scripts = []string{}
	if len(t.Conf.Script) > 0 {
		for _, scr := range t.Conf.Script {
			p, err := t.resolve_path(scr, filepath.Join(defaultPath, "index.js"))
			if err != nil {
				return err
			}
			t.scripts = append(t.scripts, p)
		}
	}

	t.stylesheets = []string{}
	if len(t.Conf.Stylesheet) > 0 {
		for _, style := range t.Conf.Stylesheet {
			p, err := t.resolve_path(style, filepath.Join(defaultPath, "index.css"))
			if err != nil {
				return err
			}
			t.stylesheets = append(t.stylesheets, p)
		}
	}

	return nil
}

func (t *Target) resolve_path(source, defaults string) (string, error) {
	if source == "" {
		return defaults, nil
	}

	s, err := utils.ReplaceTemplateString(source, map[string]any{
		"cwd":    t.project.cwd,
		"target": t.name,
	})

	if err != nil {
		return "", err
	}

	if !filepath.IsAbs(s) {
		s = filepath.Join(t.project.cwd, s)
	}

	return s, nil
}
