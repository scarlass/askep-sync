package utils

import (
	"bytes"
	"text/template"
)

func ReplaceTemplateString(source string, data map[string]any) (string, error) {
	buf := bytes.NewBufferString("")

	tpl := template.New("replacer")
	tpl.Parse(source)

	if err := tpl.Execute(buf, data); err != nil {
		return "", err
	}

	return buf.String(), nil
}
