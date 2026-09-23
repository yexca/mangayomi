package api

import (
	"context"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"mangayomi/internal/media"
	"mangayomi/internal/natural"
	"mangayomi/internal/scanner"
	"mangayomi/internal/store"
)

// ---- folder browser ----

type dirEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Rel  string `json:"rel"` // relative to base, slash-separated
}

func (s *Server) browse(w http.ResponseWriter, r *http.Request) {
	base := s.cfg.DataDir
	if b := r.URL.Query().Get("base"); b != "" {
		b = filepath.Clean(b)
		if !within(s.cfg.DataDir, b) {
			writeError(w, http.StatusBadRequest, "outside_data", "path is outside the data directory")
			return
		}
		base = b
	}
	p := base
	if q := r.URL.Query().Get("path"); q != "" {
		p = filepath.Clean(q)
	}
	if !within(base, p) {
		writeError(w, http.StatusBadRequest, "outside_data", "path is outside the data directory")
		return
	}
	entries, err := os.ReadDir(p)
	if err != nil {
		writeError(w, http.StatusBadRequest, "unreadable", err.Error())
		return
	}
	dirs := []dirEntry{}
	for _, e := range entries {
		if media.IsJunk(e.Name()) {
			continue
		}
		full := filepath.Join(p, e.Name())
		if !e.IsDir() {
			if e.Type()&os.ModeSymlink == 0 {
				continue
			}
			if fi, err := os.Stat(full); err != nil || !fi.IsDir() {
				continue
			}
		}
		rel, _ := filepath.Rel(base, full)
		dirs = append(dirs, dirEntry{Name: e.Name(), Path: full, Rel: filepath.ToSlash(rel)})
	}
	sort.Slice(dirs, func(i, j int) bool { return natural.Less(dirs[i].Name, dirs[j].Name) })
	var parent *string
	if p != base {
		d := filepath.Dir(p)
		parent = &d
	}
	rel, _ := filepath.Rel(base, p)
	if rel == "." {
		rel = ""
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"path":   p,
		"rel":    filepath.ToSlash(rel),
		"base":   base,
		"parent": parent,
		"dirs":   dirs,
	})
}

// ---- libraries ----

type libraryBody struct {
	Name             string   `json:"name"`
	Path             string   `json:"path"`
	Pattern          string   `json:"pattern"`
	Excludes         []string `json:"excludes"`
	ReadingDirection string   `json:"readingDirection"`
	ScanInterval     int      `json:"scanInterval"`
}

// validate normalizes the body into lib and returns a user-facing error.
func (s *Server) validateLibrary(ctx context.Context, b libraryBody, selfID int64) (store.Library, string, string) {
	lib := store.Library{ID: selfID}
	p := filepath.Clean(strings.TrimSpace(b.Path))
	if b.Path == "" || !filepath.IsAbs(p) || !within(s.cfg.DataDir, p) {
		return lib, "outside_data", "choose a folder inside the data directory"
	}
	fi, err := os.Stat(p)
	if err != nil || !fi.IsDir() {
		return lib, "not_a_directory", "folder does not exist"
	}
	libs, err := s.store.ListLibraries(ctx)
	if err != nil {
		return lib, "internal", err.Error()
	}
	for _, other := range libs {
		if other.ID == selfID {
			continue
		}
		if within(other.Path, p) || within(p, other.Path) {
			return lib, "overlapping_library", "this folder overlaps with library \"" + other.Name + "\""
		}
	}
	if _, err := scanner.ParsePattern(b.Pattern); err != nil {
		return lib, "invalid_pattern", err.Error()
	}
	excludes := []string{}
	seen := map[string]bool{}
	for _, e := range b.Excludes {
		n, ok := scanner.NormalizeRel(e)
		if !ok {
			return lib, "invalid_exclude", "invalid excluded folder: " + e
		}
		if !seen[n] {
			seen[n] = true
			excludes = append(excludes, n)
		}
	}
	dir := b.ReadingDirection
	if dir != "ltr" {
		dir = "rtl"
	}
	name := strings.TrimSpace(b.Name)
	if name == "" {
		name = filepath.Base(p)
	}
	lib.Name = name
	lib.Path = p
	lib.Pattern = strings.Trim(strings.TrimSpace(b.Pattern), "/")
	lib.Excludes = excludes
	lib.ReadingDirection = dir
	lib.ScanInterval = max(b.ScanInterval, 0)
	return lib, "", ""
}

func (s *Server) listLibraries(w http.ResponseWriter, r *http.Request) {
	libs, err := s.store.ListLibraries(r.Context())
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"libraries": libs, "dataDir": s.cfg.DataDir})
}

func (s *Server) getLibrary(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	lib, err := s.store.GetLibrary(r.Context(), id)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, lib)
}

func (s *Server) createLibrary(w http.ResponseWriter, r *http.Request) {
	var body libraryBody
	if !readJSON(w, r, &body) {
		return
	}
	lib, code, msg := s.validateLibrary(r.Context(), body, 0)
	if code != "" {
		writeError(w, http.StatusBadRequest, code, msg)
		return
	}
	if err := s.store.CreateLibrary(r.Context(), &lib); err != nil {
		s.internal(w, r, err)
		return
	}
	s.scanner.Trigger(lib.ID)
	writeJSON(w, http.StatusCreated, lib)
}

func (s *Server) updateLibrary(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	old, err := s.store.GetLibrary(r.Context(), id)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	var body libraryBody
	if !readJSON(w, r, &body) {
		return
	}
	lib, code, msg := s.validateLibrary(r.Context(), body, id)
	if code != "" {
		writeError(w, http.StatusBadRequest, code, msg)
		return
	}
	if err := s.store.UpdateLibrary(r.Context(), &lib); err != nil {
		s.internal(w, r, err)
		return
	}
	if old.Path != lib.Path || old.Pattern != lib.Pattern || strings.Join(old.Excludes, "\x00") != strings.Join(lib.Excludes, "\x00") {
		if old.Path != lib.Path {
			// A different root means rel paths no longer line up; start fresh.
			<-s.scanner.Cancel(id)
			s.dropWorks(r.Context(), id)
		}
		s.scanner.Trigger(id)
	}
	lib, _ = s.store.GetLibrary(r.Context(), id)
	writeJSON(w, http.StatusOK, lib)
}

func (s *Server) dropWorks(ctx context.Context, libraryID int64) {
	works, _, err := s.store.ListWorks(ctx, store.WorkFilter{LibraryID: libraryID})
	if err != nil {
		return
	}
	ids := make([]int64, len(works))
	for i, wk := range works {
		ids[i] = wk.ID
		s.media.RemoveCover(wk.ID)
	}
	_ = s.store.DeleteWorks(ctx, ids)
}

func (s *Server) deleteLibrary(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	<-s.scanner.Cancel(id)
	s.scanner.Forget(id)
	ids, err := s.store.DeleteLibrary(r.Context(), id)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	for _, wid := range ids {
		s.media.RemoveCover(wid)
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) previewLibrary(w http.ResponseWriter, r *http.Request) {
	var body libraryBody
	if !readJSON(w, r, &body) {
		return
	}
	p := filepath.Clean(body.Path)
	if body.Path == "" || !within(s.cfg.DataDir, p) {
		writeError(w, http.StatusBadRequest, "outside_data", "choose a folder inside the data directory")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	items, truncated, err := scanner.Preview(ctx, p, body.Pattern, body.Excludes, 50)
	if err != nil && !errors.Is(err, context.DeadlineExceeded) {
		writeError(w, http.StatusBadRequest, "preview_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "truncated": truncated || err != nil})
}

func (s *Server) scanLibrary(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	if _, err := s.store.GetLibrary(r.Context(), id); err != nil {
		s.internal(w, r, err)
		return
	}
	started := s.scanner.Trigger(id)
	writeJSON(w, http.StatusAccepted, map[string]bool{"started": started})
}

func (s *Server) scanAll(w http.ResponseWriter, r *http.Request) {
	libs, err := s.store.ListLibraries(r.Context())
	if err != nil {
		s.internal(w, r, err)
		return
	}
	for _, l := range libs {
		s.scanner.Trigger(l.ID)
	}
	writeJSON(w, http.StatusAccepted, map[string]bool{"started": true})
}

func (s *Server) scanStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"scans": s.scanner.Statuses()})
}
