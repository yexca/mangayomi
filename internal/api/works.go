package api

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"path/filepath"
	"strconv"

	"mangayomi/internal/deletion"
	"mangayomi/internal/media"
	"mangayomi/internal/store"
)

func (s *Server) home(w http.ResponseWriter, r *http.Request) {
	lib := queryInt64(r, "library")
	reading, _, err := s.store.ListWorks(r.Context(), store.WorkFilter{LibraryID: lib, Status: "reading", Sort: "recent", Limit: 20})
	if err != nil {
		s.internal(w, r, err)
		return
	}
	added, total, err := s.store.ListWorks(r.Context(), store.WorkFilter{LibraryID: lib, Sort: "added", Limit: 24})
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"continueReading": reading, "recentlyAdded": added, "totalWorks": total})
}

func (s *Server) listWorks(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := store.WorkFilter{
		LibraryID: queryInt64(r, "library"),
		Author:    queryOptional(r, "author"),
		Series:    queryOptional(r, "series"),
		Query:     q.Get("q"),
		Status:    q.Get("status"),
		Sort:      q.Get("sort"),
		Offset:    max(queryInt(r, "offset", 0), 0),
		Limit:     min(max(queryInt(r, "limit", 60), 1), 500),
	}
	works, total, err := s.store.ListWorks(r.Context(), f)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"works": works, "total": total})
}

func (s *Server) listSeries(w http.ResponseWriter, r *http.Request) {
	groups, total, err := s.store.ListSeries(r.Context(), store.GroupFilter{
		LibraryID: queryInt64(r, "library"),
		Author:    queryOptional(r, "author"),
		Query:     r.URL.Query().Get("q"),
		Sort:      r.URL.Query().Get("sort"),
		Offset:    max(queryInt(r, "offset", 0), 0),
		Limit:     groupLimit(r),
	})
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"series": groups, "total": total})
}

func (s *Server) listAuthors(w http.ResponseWriter, r *http.Request) {
	groups, total, err := s.store.ListAuthors(r.Context(), store.GroupFilter{
		LibraryID: queryInt64(r, "library"),
		Query:     r.URL.Query().Get("q"),
		Sort:      r.URL.Query().Get("sort"),
		Offset:    max(queryInt(r, "offset", 0), 0),
		Limit:     groupLimit(r),
	})
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"authors": groups, "total": total})
}

// groupLimit reads an optional page size for group lists; without one the
// whole list is returned (an author page lists all of its series).
func groupLimit(r *http.Request) int {
	if !r.URL.Query().Has("limit") {
		return 0
	}
	return min(max(queryInt(r, "limit", 60), 1), 500)
}

type workDetail struct {
	store.Work
	Path             string         `json:"path"`
	LibraryName      string         `json:"libraryName"`
	ReadingDirection string         `json:"readingDirection"`
	Prev             *store.WorkRef `json:"prev"`
	Next             *store.WorkRef `json:"next"`
}

func (s *Server) getWork(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	wk, err := s.store.GetWork(r.Context(), id)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	lib, err := s.store.GetLibrary(r.Context(), wk.LibraryID)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	prev, next, err := s.store.SeriesNeighbors(r.Context(), wk)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, workDetail{
		Work:             wk,
		Path:             filepath.Join(lib.Path, filepath.FromSlash(wk.RelPath)),
		LibraryName:      lib.Name,
		ReadingDirection: lib.ReadingDirection,
		Prev:             prev,
		Next:             next,
	})
}

// workPages returns page dimensions, computing and caching them on first use.
func (s *Server) workPages(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	wf, err := s.store.GetWorkFile(r.Context(), id)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	if len(wf.Dims) != len(wf.Pages) {
		wf.Dims = s.media.Dims(wf)
		if err := s.store.SetDims(r.Context(), id, wf.Dims); err != nil {
			s.internal(w, r, err)
			return
		}
	}
	if wf.Dims == nil {
		wf.Dims = []store.Dim{}
	}
	writeJSON(w, http.StatusOK, map[string]any{"pages": wf.Dims})
}

func (s *Server) workPage(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	n, err := strconv.Atoi(r.PathValue("n"))
	if err != nil || n < 0 {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid page")
		return
	}
	wf, err := s.store.GetWorkFile(r.Context(), id)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	if n >= len(wf.Pages) {
		writeError(w, http.StatusNotFound, "not_found", "page out of range")
		return
	}
	etag := fmt.Sprintf(`"%d-%d-%d"`, wf.ID, wf.Mtime, n)
	if r.Header.Get("If-None-Match") == etag {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	abs := filepath.Join(wf.LibraryPath, filepath.FromSlash(wf.RelPath))
	rc, size, err := s.media.OpenPage(abs, wf.Kind, wf.Pages[n])
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			writeError(w, http.StatusNotFound, "not_found", "page file missing, rescan the library")
			return
		}
		s.internal(w, r, err)
		return
	}
	defer rc.Close()
	h := w.Header()
	h.Set("Content-Type", media.ContentType(wf.Pages[n]))
	h.Set("Content-Length", strconv.FormatInt(size, 10))
	h.Set("Cache-Control", "private, max-age=604800")
	h.Set("ETag", etag)
	io.Copy(w, rc)
}

func (s *Server) workCover(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	wf, err := s.store.GetWorkFile(r.Context(), id)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	p, err := s.media.EnsureCover(wf)
	if err != nil {
		s.log.Debug("cover unavailable", "work", id, "err", err)
		writeError(w, http.StatusNotFound, "no_cover", "cover unavailable")
		return
	}
	w.Header().Set("Cache-Control", "private, max-age=604800")
	w.Header().Set("Content-Type", "image/jpeg")
	http.ServeFile(w, r, p)
}

func (s *Server) setProgress(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var body struct {
		Page      int  `json:"page"`
		Completed bool `json:"completed"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	wk, err := s.store.GetWork(r.Context(), id)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	page := min(max(body.Page, 0), max(wk.PageCount-1, 0))
	if err := s.store.SetProgress(r.Context(), id, page, body.Completed); err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) batchProgress(w http.ResponseWriter, r *http.Request) {
	var body struct {
		deletion.Target
		Completed bool `json:"completed"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	ids, err := s.resolveTarget(r, body.Target)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	if err := s.store.MarkCompleted(r.Context(), ids, body.Completed); err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"updated": len(ids)})
}

// resolveTarget expands series and author references to work ids.
func (s *Server) resolveTarget(r *http.Request, t deletion.Target) ([]int64, error) {
	ids := append([]int64{}, t.WorkIDs...)
	add := func(f store.WorkFilter) error {
		works, _, err := s.store.ListWorks(r.Context(), f)
		for _, wk := range works {
			ids = append(ids, wk.ID)
		}
		return err
	}
	for _, sr := range t.Series {
		author, series := sr.Author, sr.Series
		if err := add(store.WorkFilter{LibraryID: sr.LibraryID, Author: &author, Series: &series}); err != nil {
			return nil, err
		}
	}
	for _, ar := range t.Authors {
		author := ar.Author
		if err := add(store.WorkFilter{LibraryID: ar.LibraryID, Author: &author}); err != nil {
			return nil, err
		}
	}
	return ids, nil
}

func (s *Server) deletePreview(w http.ResponseWriter, r *http.Request) {
	var t deletion.Target
	if !readJSON(w, r, &t) {
		return
	}
	plan, err := s.deleter.Preview(r.Context(), t)
	if err != nil {
		writeError(w, http.StatusBadRequest, "delete_preview_failed", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, plan)
}

func (s *Server) deleteConfirm(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Token string `json:"token"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	res, err := s.deleter.Confirm(r.Context(), body.Token)
	if errors.Is(err, deletion.ErrTokenInvalid) {
		writeError(w, http.StatusGone, "delete_token_invalid", err.Error())
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	s.log.Info("deleted works", "count", len(res.Deleted), "failed", len(res.Failed))
	writeJSON(w, http.StatusOK, res)
}
