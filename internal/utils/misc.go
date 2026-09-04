package utils

// left to right search for non-zero value. when a non-zero value found, return it
func ShiftZero[T comparable](values ...T) T {
	var zero T
	for _, val := range values {
		if zero != val {
			return val
		}
	}

	return zero
}
