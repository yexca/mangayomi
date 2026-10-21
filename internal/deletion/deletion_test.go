package deletion

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"mangayomi/internal/media"
	"mangayomi/internal/store"
)

func setup(t *testing.T) (*Service, *store.Store, string, store.Library) {
	t.Helper()
	cfgDir := t.TempDir()
	dataDir := t.TempDir()
	st, err := store.Open(filepath.Join(cfgDir, "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	m := media.New(filepath.Join(cfgDir, "covers"))
	t.Cleanup(func() { m.Close(); st.Close() })

	root := filepath.Join(dataDir, "manga")
	lib := store.Library{Name: "L", Path: root, ReadingDirection: "rtl"}
	if err := st.CreateLibrary(context.Background(), &lib); err != nil {
		t.Fatal(err)
	}
	return New(st, m, dataDir), st, root, lib
}

func mustMkdir(t *testing.T, dir string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
}

func mustWrite(t *testing.T, path string, data []byte) {
	t.Helper()
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}
}

func addWork(t *testing.T, st *store.Store, lib store.Library, rel, kind, author, series string, files ...string) int64 {
	t.Helper()
	abs := filepath.Join(lib.Path, filepath.FromSlash(rel))
	if kind == store.KindFolder {
		mustMkdir(t, abs)
		for _, f := range files {
			mustWrite(t, filepath.Join(abs, f), []byte("x"))
		}
	} else {
		mustMkdir(t, filepath.Dir(abs))
		mustWrite(t, abs, []byte("zip"))
	}
	id, err := st.InsertWork(context.Background(), store.WorkRecord{
		LibraryID: lib.ID, RelPath: rel, Kind: kind, Title: filepath.Base(rel), Author: author, Series: series,
		Pages: []string{"1.png"}, Size: 1, Mtime: 1,
	})
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func exists(p string) bool { _, err := os.Stat(p); return err == nil }

func TestDeleteSeries(t *testing.T) {
	svc, st, root, lib := setup(t)
	ctx := context.Background()
	addWork(t, st, lib, "A/S1/v1.cbz", store.KindArchive, "A", "S1")
	addWork(t, st, lib, "A/S1/v2", store.KindFolder, "A", "S1", "1.png", "2.png")
	keep := addWork(t, st, lib, "A/S2/v1.cbz", store.KindArchive, "A", "S2")
	mustWrite(t, filepath.Join(root, "A", "S1", ".DS_Store"), []byte{})

	plan, err := svc.Preview(ctx, Target{Series: []SeriesRef{{Author: "A", Series: "S1"}}})
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Items) != 2 || plan.TotalFiles != 3 {
		t.Fatalf("plan = %+v", plan)
	}
	if len(plan.EmptyDirs) != 1 || plan.EmptyDirs[0] != filepath.Join(root, "A", "S1") {
		t.Fatalf("emptyDirs = %v", plan.EmptyDirs)
	}

	res, err := svc.Confirm(ctx, plan.Token)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Deleted) != 2 || len(res.Failed) != 0 {
		t.Fatalf("result = %+v", res)
	}
	if exists(filepath.Join(root, "A", "S1")) {
		t.Error("series folder should be removed")
	}
	if !exists(filepath.Join(root, "A", "S2", "v1.cbz")) {
		t.Error("other series must survive")
	}
	if _, err := st.GetWork(ctx, keep); err != nil {
		t.Error("other work must stay indexed")
	}
	if _, err := svc.Confirm(ctx, plan.Token); err != ErrTokenInvalid {
		t.Error("token must be single use")
	}
}

func TestDeleteRefusesLibraryRoot(t *testing.T) {
	svc, st, root, lib := setup(t)
	mustMkdir(t, root)
	id, err := st.InsertWork(context.Background(), store.WorkRecord{
		LibraryID: lib.ID, RelPath: "", Kind: store.KindFolder, Title: "root", Pages: []string{"1.png"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Preview(context.Background(), Target{WorkIDs: []int64{id}}); err == nil {
		t.Fatal("deleting the library root must be refused")
	}
	if !exists(root) {
		t.Fatal("root removed")
	}
}

func TestDeleteEmptyAuthorIgnored(t *testing.T) {
	svc, st, _, lib := setup(t)
	addWork(t, st, lib, "loose.cbz", store.KindArchive, "", "")
	plan, err := svc.Preview(context.Background(), Target{Authors: []AuthorRef{{Author: ""}}, Series: []SeriesRef{{Series: ""}}})
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Items) != 0 {
		t.Fatalf("empty author/series must not match anything: %+v", plan.Items)
	}
}
