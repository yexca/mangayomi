// Package scanner indexes library folders into the database.
package scanner

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"mangayomi/internal/media"
	"mangayomi/internal/store"
)

type Status struct {
	LibraryID  int64  `json:"libraryId"`
	Running    bool   `json:"running"`
	Scanned    int    `json:"scanned"`
	Added      int    `json:"added"`
	Updated    int    `json:"updated"`
	Removed    int    `json:"removed"`
	StartedAt  int64  `json:"startedAt"`
	FinishedAt int64  `json:"finishedAt,omitempty"`
	Error      string `json:"error,omitempty"`
}

type Scanner struct {
	store *store.Store
	media *media.Service
	log   *slog.Logger

	mu      sync.Mutex
	status  map[int64]*Status
	cancels map[int64]context.CancelFunc
	done    map[int64]chan struct{}
	wg      sync.WaitGroup
}

func New(st *store.Store, m *media.Service, log *slog.Logger) *Scanner {
	return &Scanner{
		store:   st,
		media:   m,
		log:     log,
		status:  map[int64]*Status{},
		cancels: map[int64]context.CancelFunc{},
		done:    map[int64]chan struct{}{},
	}
}

// Trigger starts a background scan of the library unless one is running.
func (s *Scanner) Trigger(libraryID int64) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if st, ok := s.status[libraryID]; ok && st.Running {
		return false
	}
	ctx, cancel := context.WithCancel(context.Background())
	st := &Status{LibraryID: libraryID, Running: true, StartedAt: store.Now()}
	s.status[libraryID] = st
	s.cancels[libraryID] = cancel
	done := make(chan struct{})
	s.done[libraryID] = done
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		defer close(done)
		defer cancel()
		err := s.scan(ctx, libraryID, st)
		s.mu.Lock()
		st.Running = false
		st.FinishedAt = store.Now()
		if err != nil {
			st.Error = err.Error()
		}
		if s.done[libraryID] == done {
			delete(s.cancels, libraryID)
			delete(s.done, libraryID)
		}
		s.mu.Unlock()
		if err != nil {
			s.log.Warn("scan failed", "library", libraryID, "err", err)
		} else {
			s.log.Info("scan finished", "library", libraryID, "scanned", st.Scanned,
				"added", st.Added, "updated", st.Updated, "removed", st.Removed)
		}
	}()
	return true
}

// Cancel stops a running scan (e.g. when its library is deleted) and
// returns a channel that closes once it has fully stopped.
func (s *Scanner) Cancel(libraryID int64) <-chan struct{} {
	s.mu.Lock()
	defer s.mu.Unlock()
	if c, ok := s.cancels[libraryID]; ok {
		c()
	}
	done, ok := s.done[libraryID]
	if !ok {
		done = make(chan struct{})
		close(done)
	}
	return done
}

// Forget drops the status of a library that no longer exists.
func (s *Scanner) Forget(libraryID int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.status, libraryID)
}

func (s *Scanner) Statuses() []Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Status, 0, len(s.status))
	for _, st := range s.status {
		out = append(out, *st)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].LibraryID < out[j].LibraryID })
	return out
}

func (s *Scanner) Running(libraryID int64) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	st, ok := s.status[libraryID]
	return ok && st.Running
}

// Wait blocks until all running scans have returned; call after CancelAll.
func (s *Scanner) Wait() { s.wg.Wait() }

func (s *Scanner) CancelAll() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, c := range s.cancels {
		c()
	}
}

// RunScheduler starts due periodic scans once a minute until ctx ends.
func (s *Scanner) RunScheduler(ctx context.Context) {
	t := time.NewTicker(time.Minute)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		libs, err := s.store.ListLibraries(ctx)
		if err != nil {
			continue
		}
		now := store.Now()
		for _, l := range libs {
			if l.ScanInterval <= 0 {
				continue
			}
			due := l.LastScanAt == nil || now-*l.LastScanAt >= int64(l.ScanInterval)*60_000
			if due && !s.Running(l.ID) {
				s.Trigger(l.ID)
			}
		}
	}
}

func (s *Scanner) update(st *Status, f func(*Status)) {
	s.mu.Lock()
	f(st)
	s.mu.Unlock()
}

func (s *Scanner) scan(ctx context.Context, libraryID int64, st *Status) error {
	lib, err := s.store.GetLibrary(ctx, libraryID)
	if err != nil {
		return err
	}
	pattern, err := ParsePattern(lib.Pattern)
	if err != nil {
		return err
	}
	// Refuse to touch the index when the root is missing: an unmounted NAS
	// share must not look like "every work was deleted".
	if _, err := os.Stat(lib.Path); err != nil {
		return fmt.Errorf("library path unavailable: %w", err)
	}
	existing, err := s.store.WorkIndex(ctx, lib.ID)
	if err != nil {
		return err
	}
	rootName := filepath.Base(lib.Path)
	seen := map[string]bool{}

	failed, err := Walk(ctx, lib.Path, lib.Excludes, func(c Candidate) error {
		s.update(st, func(st *Status) { st.Scanned++ })
		meta := pattern.Apply(c.RelPath, c.Kind, rootName)
		ex, known := existing[c.RelPath]

		if known && ex.Kind == c.Kind && ex.Mtime == c.Mtime &&
			((c.Kind == store.KindArchive && ex.Size == c.Size) ||
				(c.Kind == store.KindFolder && ex.PageCount == len(c.Images))) {
			seen[c.RelPath] = true
			if ex.Title != meta.Title || ex.Author != meta.Author || ex.Series != meta.Series {
				return s.store.UpdateWorkMeta(ctx, ex.ID, meta.Title, meta.Author, meta.Series)
			}
			return nil
		}

		rec, err := s.index(c, meta, lib.ID)
		if err != nil {
			s.log.Warn("skipping unreadable work", "path", c.AbsPath, "err", err)
			seen[c.RelPath] = known // keep what we had rather than drop it
			return nil
		}
		if len(rec.Pages) == 0 {
			return nil
		}
		seen[c.RelPath] = true
		if known {
			if err := s.store.UpdateWork(ctx, ex.ID, rec); err != nil {
				return err
			}
			s.media.RemoveCover(ex.ID)
			s.update(st, func(st *Status) { st.Updated++ })
			return nil
		}
		if _, err := s.store.InsertWork(ctx, rec); err != nil {
			return err
		}
		s.update(st, func(st *Status) { st.Added++ })
		return nil
	})
	if err != nil {
		return err
	}

	var gone []int64
	for rel, ex := range existing {
		if !seen[rel] && !underAny(rel, failed) {
			gone = append(gone, ex.ID)
		}
	}
	if err := s.store.DeleteWorks(ctx, gone); err != nil {
		return err
	}
	for _, id := range gone {
		s.media.RemoveCover(id)
	}
	s.update(st, func(st *Status) { st.Removed = len(gone) })
	return s.store.SetLastScan(ctx, lib.ID, store.Now())
}

func (s *Scanner) index(c Candidate, meta Meta, libraryID int64) (store.WorkRecord, error) {
	rec := store.WorkRecord{
		LibraryID: libraryID,
		RelPath:   c.RelPath,
		Kind:      c.Kind,
		Title:     meta.Title,
		Author:    meta.Author,
		Series:    meta.Series,
		Mtime:     c.Mtime,
	}
	switch c.Kind {
	case store.KindArchive:
		s.media.Evict(c.AbsPath)
		pages, err := s.media.ListArchive(c.AbsPath)
		if err != nil {
			return rec, err
		}
		rec.Pages = pages
		rec.Size = c.Size
	case store.KindFolder:
		rec.Pages = c.Images
		for _, name := range c.Images {
			if fi, err := os.Stat(filepath.Join(c.AbsPath, name)); err == nil {
				rec.Size += fi.Size()
			}
		}
	}
	return rec, nil
}

// PreviewItem shows how a folder would be indexed, without touching the database.
type PreviewItem struct {
	RelPath string `json:"relPath"`
	Kind    string `json:"kind"`
	Meta
}

// Preview lists up to limit works the scanner would find under root.
func Preview(ctx context.Context, root, patternStr string, excludes []string, limit int) ([]PreviewItem, bool, error) {
	pattern, err := ParsePattern(patternStr)
	if err != nil {
		return nil, false, err
	}
	rootName := filepath.Base(root)
	items := []PreviewItem{}
	truncated := false
	_, err = Walk(ctx, root, excludes, func(c Candidate) error {
		if len(items) >= limit {
			truncated = true
			return errStop
		}
		items = append(items, PreviewItem{RelPath: c.RelPath, Kind: c.Kind, Meta: pattern.Apply(c.RelPath, c.Kind, rootName)})
		return nil
	})
	return items, truncated, err
}
