package configs

import (
	"bytes"
	"embed"
	"fmt"
	"text/template"
)

//go:embed templates/*.template
var resources embed.FS

var tmpl *template.Template

func init() {
	tmpl = template.Must(template.ParseFS(resources, "templates/*"))
}

func GenerateTemplate(name string, data map[string]any) ([]byte, error) {
	name += ".template"
	buf := bytes.NewBufferString("")
	if err := tmpl.ExecuteTemplate(buf, name, data); err != nil {
		return nil, fmt.Errorf("fail to parse inline template: %w", err)
	}
	return buf.Bytes(), nil
}
