package scanner

import (
	"archive/zip"
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
	"time"

	"mangayomi/internal/media"
	"mangayomi/internal/store"
)

func pngBytes(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 20, 30))
	img.Set(1, 1, color.RGBA{255, 0, 0, 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func writeZip(t *testing.T, p string, names ...string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	f, err := os.Create(p)
	if err != nil {
		t.Fatal(err)
	}
	zw := zip.NewWriter(f)
	for _, n := range names {
		w, err := zw.Create(n)
		if err != nil {
			t.Fatal(err)
		}
		w.Write(pngBytes(t))
	}
	zw.Close()
	f.Close()
}

func writeImages(t *testing.T, dir string, names ...string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, n := range names {
		if err := os.WriteFile(filepath.Join(dir, n), pngBytes(t), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

func TestPatternApply(t *testing.T) {
	p, err := ParsePattern("{author}/{series}")
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		rel, kind string
		want      Meta
	}{
		{"Author A/Series One/v01.cbz", store.KindArchive, Meta{Title: "v01", Author: "Author A", Series: "Series One"}},
		{"Author A/Series One/v02", store.KindFolder, Meta{Title: "v02", Author: "Author A", Series: "Series One"}},
		{"Author A/Oneshot.zip", store.KindArchive, Meta{Title: "Oneshot", Author: "Author A"}},
		{"Author A/Series One/extra/v03.cbz", store.KindArchive, Meta{Title: "v03", Author: "Author A", Series: "Series One"}},
		{"Loose.cbz", store.KindArchive, Meta{Title: "Loose"}},
		{"", store.KindFolder, Meta{Title: "root"}},
	}
	for _, c := range cases {
		if got := p.Apply(c.rel, c.kind, "root"); got != c.want {
			t.Errorf("Apply(%q) = %+v, want %+v", c.rel, got, c.want)
		}
	}
	if _, err := ParsePattern("{author}/{bogus}"); err == nil {
		t.Error("expected error for unknown token")
	}
	if _, err := ParsePattern("{series}/{series}"); err == nil {
		t.Error("expected error for duplicate token")
	}
}

func newTestScanner(t *testing.T) (*Scanner, *store.Store) {
	t.Helper()
	dir := t.TempDir()
	st, err := store.Open(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	m := media.New(filepath.Join(dir, "covers"))
	t.Cleanup(func() { m.Close(); st.Close() })
	return New(st, m, slog.New(slog.NewTextHandler(io.Discard, nil))), st
}

func runScan(t *testing.T, sc *Scanner, id int64) Status {
	t.Helper()
	sc.Trigger(id)
	deadline := time.Now().Add(10 * time.Second)
	for sc.Running(id) {
		if time.Now().After(deadline) {
			t.Fatal("scan timed out")
		}
		time.Sleep(10 * time.Millisecond)
	}
	for _, s := range sc.Statuses() {
		if s.LibraryID == id {
			if s.Error != "" {
				t.Fatalf("scan error: %s", s.Error)
			}
			return s
		}
	}
	t.Fatal("no status")
	return Status{}
}

func TestScanLibrary(t *testing.T) {
	sc, st := newTestScanner(t)
	ctx := context.Background()
	root := t.TempDir()

	writeZip(t, filepath.Join(root, "Author A", "Series One", "v02.cbz"), "10.png", "2.png", "1.png")
	writeZip(t, filepath.Join(root, "Author A", "Series One", "v10.cbz"), "a.png")
	writeImages(t, filepath.Join(root, "Author A", "Series One", "v01"), "001.png", "002.png")
	writeImages(t, filepath.Join(root, "Author B", "Sketchbook"), "p1.png") // folder of images at series level
	writeZip(t, filepath.Join(root, "Skip", "Hidden.cbz"), "a.png")
	writeZip(t, filepath.Join(root, "Author A", "empty.zip"), "readme.txt")
	writeImages(t, filepath.Join(root, "@eaDir", "junk"), "x.png")

	lib := store.Library{Name: "Test", Path: root, Pattern: "{author}/{series}", Excludes: []string{"Skip"}, ReadingDirection: "rtl"}
	if err := st.CreateLibrary(ctx, &lib); err != nil {
		t.Fatal(err)
	}
	s := runScan(t, sc, lib.ID)
	if s.Added != 4 {
		t.Fatalf("added = %d, want 4 (status %+v)", s.Added, s)
	}

	works, _, err := st.ListWorks(ctx, store.WorkFilter{LibraryID: lib.ID})
	if err != nil {
		t.Fatal(err)
	}
	titles := []string{}
	for _, w := range works {
		titles = append(titles, w.Title)
	}
	want := []string{"Sketchbook", "v01", "v02", "v10"}
	if len(titles) != len(want) {
		t.Fatalf("titles = %v, want %v", titles, want)
	}
	for i := range want {
		if titles[i] != want[i] {
			t.Fatalf("titles = %v, want %v (natural order)", titles, want)
		}
	}
	for _, w := range works {
		if w.Title == "Sketchbook" && (w.Author != "Author B" || w.Series != "") {
			t.Errorf("image folder should not be parsed as series: %+v", w)
		}
		if w.Title == "v02" {
			wf, err := st.GetWorkFile(ctx, w.ID)
			if err != nil {
				t.Fatal(err)
			}
			if len(wf.Pages) != 3 || wf.Pages[0] != "1.png" || wf.Pages[2] != "10.png" {
				t.Errorf("pages not in natural order: %v", wf.Pages)
			}
		}
	}

	// Rescan without changes is a no-op.
	if s := runScan(t, sc, lib.ID); s.Added+s.Updated+s.Removed != 0 {
		t.Errorf("unchanged rescan did work: %+v", s)
	}

	// Pattern changes re-derive metadata for unchanged files.
	lib.Pattern = "{series}"
	if err := st.UpdateLibrary(ctx, &lib); err != nil {
		t.Fatal(err)
	}
	runScan(t, sc, lib.ID)
	works, _, _ = st.ListWorks(ctx, store.WorkFilter{LibraryID: lib.ID, Query: "v01"})
	if len(works) != 1 || works[0].Series != "Author A" || works[0].Author != "" {
		t.Errorf("metadata not updated after pattern change: %+v", works)
	}

	// Removing a file drops it from the index.
	gone := filepath.Join(root, "Author A", "Series One", "v10.cbz")
	sc.media.Evict(gone) // Windows cannot delete a file that is open
	if err := os.Remove(gone); err != nil {
		t.Fatal(err)
	}
	if s := runScan(t, sc, lib.ID); s.Removed != 1 {
		t.Errorf("removed = %d, want 1", s.Removed)
	}

	// A missing root must not wipe the index.
	os.Rename(root, root+"-gone")
	defer os.Rename(root+"-gone", root)
	sc.Trigger(lib.ID)
	for sc.Running(lib.ID) {
		time.Sleep(10 * time.Millisecond)
	}
	_, total, _ := st.ListWorks(ctx, store.WorkFilter{LibraryID: lib.ID})
	if total != 3 {
		t.Errorf("works after missing root = %d, want 3", total)
	}
}
