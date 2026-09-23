package natural

import (
	"sort"
	"testing"
)

func TestSort(t *testing.T) {
	in := []string{"Vol 10", "vol 2", "Vol 1", "extra", "vol 02b", "Vol 001"}
	sort.SliceStable(in, func(i, j int) bool { return Less(in[i], in[j]) })
	want := []string{"extra", "Vol 001", "Vol 1", "vol 2", "vol 02b", "Vol 10"}
	for i := range want {
		if in[i] != want[i] {
			t.Fatalf("got %v, want %v", in, want)
		}
	}
}

func TestKeyOrder(t *testing.T) {
	if !(Key("ch 9") < Key("ch 10")) {
		t.Error("Key should order numbers numerically")
	}
	if Key("ABC") != Key("abc") {
		t.Error("Key should be case-insensitive")
	}
}
