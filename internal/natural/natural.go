// Package natural implements "human" ordering where digit runs compare by
// numeric value, so "vol 2" sorts before "vol 10".
package natural

import (
	"strings"
	"unicode/utf8"
)

// Compare returns -1, 0 or 1. ASCII letters compare case-insensitively and
// leading zeros are ignored; exact ties fall back to byte order.
func Compare(a, b string) int {
	i, j := 0, 0
	for i < len(a) && j < len(b) {
		ca, cb := a[i], b[j]
		if isDigit(ca) && isDigit(cb) {
			si := i
			for i < len(a) && isDigit(a[i]) {
				i++
			}
			sj := j
			for j < len(b) && isDigit(b[j]) {
				j++
			}
			na := strings.TrimLeft(a[si:i], "0")
			nb := strings.TrimLeft(b[sj:j], "0")
			if len(na) != len(nb) {
				return sign(len(na) - len(nb))
			}
			if c := strings.Compare(na, nb); c != 0 {
				return c
			}
			continue
		}
		la, lb := lower(ca), lower(cb)
		if la != lb {
			return sign(int(la) - int(lb))
		}
		i++
		j++
	}
	if d := (len(a) - i) - (len(b) - j); d != 0 {
		return sign(d)
	}
	return strings.Compare(a, b)
}

func Less(a, b string) bool { return Compare(a, b) < 0 }

// Key builds a string whose byte order approximates Compare, for use as a
// database sort column. Digit runs are left-padded to a fixed width.
func Key(s string) string {
	const width = 12
	s = strings.ToLower(s)
	var sb strings.Builder
	sb.Grow(len(s) + 16)
	for i := 0; i < len(s); {
		if !isDigit(s[i]) {
			_, size := utf8.DecodeRuneInString(s[i:])
			sb.WriteString(s[i : i+size])
			i += size
			continue
		}
		start := i
		for i < len(s) && isDigit(s[i]) {
			i++
		}
		num := strings.TrimLeft(s[start:i], "0")
		if num == "" {
			num = "0"
		}
		for k := len(num); k < width; k++ {
			sb.WriteByte('0')
		}
		sb.WriteString(num)
	}
	return sb.String()
}

func isDigit(c byte) bool { return c >= '0' && c <= '9' }

func lower(c byte) byte {
	if c >= 'A' && c <= 'Z' {
		return c + 'a' - 'A'
	}
	return c
}

func sign(n int) int {
	switch {
	case n < 0:
		return -1
	case n > 0:
		return 1
	}
	return 0
}
