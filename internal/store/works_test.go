package store

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"
)

// The series and author lists page through groups sorted in Go; pages must
// join back into the full natural order and report the full total.
func TestGroupListsPage(t *testing.T) {
	ctx := context.Background()
	st, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	lib := Library{Name: "Test", Path: "/path/to/manga", ReadingDirection: "rtl"}
	if err := st.CreateLibrary(ctx, &lib); err != nil {
		t.Fatal(err)
	}
	for i, w := range []struct{ author, series string }{
		{"Author B", "Series 10"}, {"Author A", "Series 2"}, {"Author C", "Series 1"},
		{"Author A", "Series 2"}, {"Author D", "Series 3"},
	} {
		rel := fmt.Sprintf("%s/%s/Vol %02d.cbz", w.author, w.series, i+1)
		if _, err := st.InsertWork(ctx, WorkRecord{LibraryID: lib.ID, RelPath: rel, Kind: KindArchive,
			Title: "Vol 01", Author: w.author, Series: w.series, Pages: []string{"001.png"}}); err != nil {
			t.Fatal(err)
		}
	}

	var series []string
	for offset := 0; ; offset += 2 {
		page, total, err := st.ListSeries(ctx, GroupFilter{Offset: offset, Limit: 2})
		if err != nil {
			t.Fatal(err)
		}
		if total != 4 {
			t.Fatalf("series total = %d, want 4", total)
		}
		if page == nil {
			t.Fatal("a page past the end must be an empty slice, not nil")
		}
		if len(page) == 0 {
			break
		}
		for _, g := range page {
			series = append(series, g.Series)
		}
	}
	want := []string{"Series 1", "Series 2", "Series 3", "Series 10"}
	if len(series) != len(want) {
		t.Fatalf("series = %v, want %v", series, want)
	}
	for i := range want {
		if series[i] != want[i] {
			t.Fatalf("series = %v, want %v", series, want)
		}
	}

	authors, total, err := st.ListAuthors(ctx, GroupFilter{Offset: 3, Limit: 2})
	if err != nil {
		t.Fatal(err)
	}
	if total != 4 || len(authors) != 1 || authors[0].Author != "Author D" {
		t.Fatalf("authors page = %+v (total %d), want only Author D of 4", authors, total)
	}
	all, _, err := st.ListAuthors(ctx, GroupFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 4 {
		t.Fatalf("no limit returned %d authors, want 4", len(all))
	}
}
