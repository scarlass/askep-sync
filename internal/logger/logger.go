package logger

import (
	"fmt"
	"io"
	"os"
	"strings"
	"time"
)

type Logger interface {
	Errorf(msg string, args ...any)
	Error(msg string)

	Warnf(msg string, args ...any)
	Warn(msg string)

	Infof(msg string, args ...any)
	Info(msg string)

	Printf(msg string, args ...any)
	Print(msg string)
}

var (
	Verbose    = false
	Dry        = false
	TimeFormat = "2006-01-02T15:04:05"
)

type loggerImpl struct {
	prefix string
	out    io.Writer
	err    io.Writer
}

func New(prefix ...string) Logger {
	var p string
	if len(prefix) > 0 {
		p = prefix[0]
	}

	return &loggerImpl{
		prefix: p,
		out:    os.Stdout,
		err:    os.Stderr,
	}
}

func (l *loggerImpl) Errorf(msg string, args ...any) {
	l.logf(l.err, "ERROR", msg, args...)
}
func (l *loggerImpl) Error(msg string) {
	l.log(l.err, "ERROR", msg)
}

func (l *loggerImpl) Warnf(msg string, args ...any) { l.logf(l.out, "WARN", msg, args...) }
func (l *loggerImpl) Warn(msg string)               { l.log(l.out, "WARN", msg) }

func (l *loggerImpl) Infof(msg string, args ...any) { l.logf(l.out, "INFO", msg, args...) }
func (l *loggerImpl) Info(msg string)               { l.log(l.out, "INFO", msg) }

// Print/Printf are exempt from dry: sync -d relies on them to emit the
// compiled html unconditionally while every other log level is silenced.
func (l *loggerImpl) Printf(msg string, args ...any) {
	l.write(l.out, fmt.Appendf([]byte{}, msg, args...))
}
func (l *loggerImpl) Print(msg string) { l.write(l.out, []byte(msg)) }

func (l *loggerImpl) log(w io.Writer, level, msg string) {
	if Dry {
		return
	}
	l.write(w, []byte(l.format(level, msg)))
}

func (l *loggerImpl) logf(w io.Writer, level, msg string, args ...any) {
	if Dry {
		return
	}
	l.write(w, []byte(l.format(level, fmt.Sprintf(msg, args...))))
}

func (l *loggerImpl) format(level, msg string) string {
	form := []string{
		// fmt.Sprintf("%-5s", level),
	}

	if Verbose {
		form = append(form, time.Now().Format(TimeFormat))
	}

	if l.prefix != "" {
		form = append(form, fmt.Sprintf("%-5s", l.prefix), "|")
	}

	form = append(form, msg)
	return strings.Join(form, " ")
}

func (l *loggerImpl) write(w io.Writer, buf []byte) {
	buf = append(buf, '\n')
	w.Write(buf)
}
