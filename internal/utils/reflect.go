package utils

import (
	"errors"
	"reflect"
)

func Must[T any](t T, err error) T {
	if err != nil {
		panic(err)
	}
	return t
}

func MustPointer(t any) {
	rt := reflect.TypeOf(t)
	if rt.Kind() != reflect.Pointer {
		panic(errors.New("target must be a pointer"))
	}
}
