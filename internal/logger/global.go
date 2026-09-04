package logger

import "encoding/json"

var log = New()

func Errorf(msg string, args ...any) { log.Errorf(msg, args...) }
func Error(msg string)               { log.Error(msg) }
func Warnf(msg string, args ...any)  { log.Warnf(msg, args...) }
func Warn(msg string)                { log.Warn(msg) }
func Infof(msg string, args ...any)  { log.Infof(msg, args...) }
func Info(msg string)                { log.Info(msg) }
func Printf(msg string, args ...any) { log.Printf(msg, args...) }
func Print(msg string)               { log.Print(msg) }

func JsonPrint(data any) {
	if jsoned, jerr := json.MarshalIndent(data, "", "    "); jerr == nil {
		Print(string(jsoned))
	}
}
