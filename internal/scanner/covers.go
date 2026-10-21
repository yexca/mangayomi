package scanner

import (
	"context"
	"time"

	"mangayomi/internal/store"
)

// Covers are rendered on first request, which makes the first visit to a
// large library slow. A single background worker renders the missing ones
// after every scan that adds or changes works, and for every library once at
// startup. It renders one cover at a time, so on-demand requests always keep
// a decode slot, and it walks works in title order like the library page.

// StartCoverWarmer runs the cover worker until ctx ends or CancelAll is
// called; Wait also waits for it.
func (s *Scanner) StartCoverWarmer(ctx context.Context) {
	ctx, cancel := context.WithCancel(ctx)
	s.mu.Lock()
	s.warmCancel = cancel
	s.mu.Unlock()
	if libs, err := s.store.ListLibraries(ctx); err == nil {
		for _, l := range libs {
			s.queueCovers(l.ID)
		}
	}
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		defer cancel()
		// Works whose cover could not be rendered, by mtime, so a broken
		// page is retried only after the work changes.
		failed := map[int64]int64{}
		for {
			select {
			case <-ctx.Done():
				return
			case <-s.warmWake:
			}
			for {
				id, ok := s.nextQueued()
				if !ok || ctx.Err() != nil {
					break
				}
				s.warmLibrary(ctx, id, failed)
			}
		}
	}()
}

func (s *Scanner) queueCovers(libraryID int64) {
	s.mu.Lock()
	if !s.warmQueued[libraryID] {
		s.warmQueued[libraryID] = true
		s.warmQueue = append(s.warmQueue, libraryID)
	}
	s.mu.Unlock()
	select {
	case s.warmWake <- struct{}{}:
	default:
	}
}

func (s *Scanner) nextQueued() (int64, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.warmQueue) == 0 {
		return 0, false
	}
	id := s.warmQueue[0]
	s.warmQueue = s.warmQueue[1:]
	delete(s.warmQueued, id)
	return id, true
}

func (s *Scanner) warmLibrary(ctx context.Context, libraryID int64, failed map[int64]int64) {
	works, _, err := s.store.ListWorks(ctx, store.WorkFilter{LibraryID: libraryID})
	if err != nil {
		return
	}
	start := time.Now()
	rendered := 0
	for _, w := range works {
		if ctx.Err() != nil {
			return
		}
		if s.media.HasCover(w.ID) {
			continue
		}
		if mtime, ok := failed[w.ID]; ok && mtime == w.Mtime {
			continue
		}
		wf, err := s.store.GetWorkFile(ctx, w.ID)
		if err != nil {
			continue // removed since the listing
		}
		if _, err := s.media.EnsureCover(wf); err != nil {
			failed[w.ID] = w.Mtime
			s.log.Debug("cover unavailable", "work", w.ID, "err", err)
			continue
		}
		delete(failed, w.ID)
		rendered++
	}
	if rendered > 0 {
		s.log.Info("covers rendered", "library", libraryID, "count", rendered,
			"duration", time.Since(start).Round(time.Second).String())
	}
}
