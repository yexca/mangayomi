// Package deletion removes works from disk in two steps: a preview that
// resolves exactly which files will go and issues a short-lived token, and a
// confirmation that deletes only what the preview listed.
package deletion

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"mangayomi/internal/media"
	"mangayomi/internal/store"
)

const tokenTTL = 10 * time.Minute

var ErrTokenInvalid = errors.New("confirmation expired or invalid, please review again")

type SeriesRef struct {
	LibraryID int64  `json:"libraryId"` // 0 = every library
	Author    string `json:"author"`
	Series    string `json:"series"`
}

type AuthorRef struct {
	LibraryID int64  `json:"libraryId"`
	Author    string `json:"author"`
}

type Target struct {
	WorkIDs []int64     `json:"workIds"`
	Series  []SeriesRef `json:"series"`
	Authors []AuthorRef `json:"authors"`
}

type Item struct {
	ID     int64  `json:"id"`
	Title  string `json:"title"`
	Author string `json:"author"`
	Series string `json:"series"`
	Kind   string `json:"kind"`
	Path   string `json:"path"`
	Size   int64  `json:"size"`
	Files  int    `json:"files"`
}

type Plan struct {
	Token      string   `json:"token"`
	ExpiresAt  int64    `json:"expiresAt"`
	Items      []Item   `json:"items"`
	EmptyDirs  []string `json:"emptyDirs"` // parent folders left empty that will be removed too
	TotalSize  int64    `json:"totalSize"`
	TotalFiles int      `json:"totalFiles"`
}

type Failure struct {
	ID    int64  `json:"id"`
	Path  string `json:"path"`
	Error string `json:"error"`
}

type Result struct {
	Deleted []int64   `json:"deleted"`
	Failed  []Failure `json:"failed"`
}

type pending struct {
	ids       []int64
	emptyDirs []string
	expires   time.Time
}

type Service struct {
	store   *store.Store
	media   *media.Service
	dataDir string

	mu      sync.Mutex
	pending map[string]pending
	running sync.Mutex // one deletion at a time
}

func New(st *store.Store, m *media.Service, dataDir string) *Service {
	return &Service{store: st, media: m, dataDir: dataDir, pending: map[string]pending{}}
}

type located struct {
	work store.Work
	lib  store.Library
	abs  string
}

func (s *Service) resolve(ctx context.Context, t Target) ([]located, error) {
	ids := map[int64]bool{}
	for _, id := range t.WorkIDs {
		ids[id] = true
	}
	collect := func(f store.WorkFilter) error {
		works, _, err := s.store.ListWorks(ctx, f)
		for _, w := range works {
			ids[w.ID] = true
		}
		return err
	}
	for _, sr := range t.Series {
		author, series := sr.Author, sr.Series
		if series == "" {
			continue // "no series" is not a series; refuse to treat it as one
		}
		if err := collect(store.WorkFilter{LibraryID: sr.LibraryID, Author: &author, Series: &series}); err != nil {
			return nil, err
		}
	}
	for _, ar := range t.Authors {
		author := ar.Author
		if author == "" {
			continue
		}
		if err := collect(store.WorkFilter{LibraryID: ar.LibraryID, Author: &author}); err != nil {
			return nil, err
		}
	}
	if len(ids) == 0 {
		return nil, nil
	}
	list := make([]int64, 0, len(ids))
	for id := range ids {
		list = append(list, id)
	}
	works, _, err := s.store.ListWorks(ctx, store.WorkFilter{IDs: list, Sort: "series"})
	if err != nil {
		return nil, err
	}
	libs := map[int64]store.Library{}
	var out []located
	for _, w := range works {
		lib, ok := libs[w.LibraryID]
		if !ok {
			if lib, err = s.store.GetLibrary(ctx, w.LibraryID); err != nil {
				return nil, err
			}
			libs[w.LibraryID] = lib
		}
		abs, err := s.safePath(lib, w)
		if err != nil {
			return nil, err
		}
		out = append(out, located{work: w, lib: lib, abs: abs})
	}
	return out, nil
}

// safePath resolves the on-disk path of a work and refuses anything that
// is not strictly inside its library, and the library inside the data dir.
func (s *Service) safePath(lib store.Library, w store.Work) (string, error) {
	root := filepath.Clean(lib.Path)
	if !within(s.dataDir, root) {
		return "", errors.New("library is outside the data directory: " + root)
	}
	if w.RelPath == "" {
		return "", errors.New("refusing to delete the library root folder: " + root)
	}
	abs := filepath.Join(root, filepath.FromSlash(w.RelPath))
	if !within(root, abs) || abs == root {
		return "", errors.New("path escapes its library: " + abs)
	}
	return abs, nil
}

func (s *Service) Preview(ctx context.Context, t Target) (*Plan, error) {
	items, err := s.resolve(ctx, t)
	if err != nil {
		return nil, err
	}
	plan := &Plan{Items: []Item{}, EmptyDirs: []string{}}
	ids := make([]int64, 0, len(items))
	for _, it := range items {
		files, size := countFiles(it.abs, it.work)
		plan.Items = append(plan.Items, Item{
			ID: it.work.ID, Title: it.work.Title, Author: it.work.Author, Series: it.work.Series,
			Kind: it.work.Kind, Path: it.abs, Size: size, Files: files,
		})
		plan.TotalSize += size
		plan.TotalFiles += files
		ids = append(ids, it.work.ID)
	}
	if len(ids) == 0 {
		return plan, nil
	}
	plan.EmptyDirs = emptiedDirs(items)

	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return nil, err
	}
	plan.Token = hex.EncodeToString(b)
	exp := time.Now().Add(tokenTTL)
	plan.ExpiresAt = exp.UnixMilli()

	s.mu.Lock()
	for k, p := range s.pending {
		if time.Now().After(p.expires) {
			delete(s.pending, k)
		}
	}
	s.pending[plan.Token] = pending{ids: ids, emptyDirs: plan.EmptyDirs, expires: exp}
	s.mu.Unlock()
	return plan, nil
}

func (s *Service) Confirm(ctx context.Context, token string) (*Result, error) {
	s.mu.Lock()
	p, ok := s.pending[token]
	delete(s.pending, token)
	s.mu.Unlock()
	if !ok || time.Now().After(p.expires) {
		return nil, ErrTokenInvalid
	}

	s.running.Lock()
	defer s.running.Unlock()

	items, err := s.resolve(ctx, Target{WorkIDs: p.ids})
	if err != nil {
		return nil, err
	}
	res := &Result{Deleted: []int64{}, Failed: []Failure{}}
	for _, it := range items {
		s.media.Evict(it.abs)
		var err error
		if it.work.Kind == store.KindFolder {
			err = os.RemoveAll(it.abs)
		} else {
			err = os.Remove(it.abs)
		}
		if err != nil && !errors.Is(err, fs.ErrNotExist) {
			res.Failed = append(res.Failed, Failure{ID: it.work.ID, Path: it.abs, Error: err.Error()})
			continue
		}
		res.Deleted = append(res.Deleted, it.work.ID)
		s.media.RemoveCover(it.work.ID)
	}
	if err := s.store.DeleteWorks(ctx, res.Deleted); err != nil {
		return res, err
	}

	// Remove parent folders that were shown in the preview, deepest first,
	// but only if they really are empty now.
	libs := map[string]bool{}
	for _, it := range items {
		libs[filepath.Clean(it.lib.Path)] = true
	}
	for _, dir := range p.emptyDirs {
		insideLib := false
		for root := range libs {
			if within(root, dir) && dir != root {
				insideLib = true
			}
		}
		if insideLib && effectivelyEmpty(dir, nil) {
			_ = os.RemoveAll(dir)
		}
	}
	return res, nil
}

func countFiles(abs string, w store.Work) (int, int64) {
	if w.Kind != store.KindFolder {
		if fi, err := os.Stat(abs); err == nil {
			return 1, fi.Size()
		}
		return 1, w.Size
	}
	files := 0
	var size int64
	_ = filepath.WalkDir(abs, func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		files++
		if fi, err := d.Info(); err == nil {
			size += fi.Size()
		}
		return nil
	})
	return files, size
}

// emptiedDirs finds ancestor folders (below each library root) that would
// contain nothing but junk once the given works are gone.
func emptiedDirs(items []located) []string {
	removed := map[string]bool{}
	candidates := map[string]string{} // dir -> library root
	for _, it := range items {
		removed[it.abs] = true
		root := filepath.Clean(it.lib.Path)
		for d := filepath.Dir(it.abs); within(root, d) && d != root; d = filepath.Dir(d) {
			candidates[d] = root
		}
	}
	dirs := make([]string, 0, len(candidates))
	for d := range candidates {
		dirs = append(dirs, d)
	}
	// Deepest first, so a parent can count an emptied child as gone.
	sort.Slice(dirs, func(i, j int) bool {
		di, dj := strings.Count(dirs[i], string(filepath.Separator)), strings.Count(dirs[j], string(filepath.Separator))
		if di != dj {
			return di > dj
		}
		return dirs[i] < dirs[j]
	})
	out := []string{}
	for _, d := range dirs {
		if effectivelyEmpty(d, removed) {
			removed[d] = true
			out = append(out, d)
		}
	}
	return out
}

// effectivelyEmpty reports whether dir holds only junk entries or entries in gone.
func effectivelyEmpty(dir string, gone map[string]bool) bool {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}
	for _, e := range entries {
		if gone[filepath.Join(dir, e.Name())] {
			continue
		}
		name := e.Name()
		// Hidden files may be user data; only well-known junk qualifies.
		if strings.HasPrefix(name, ".") && name != ".DS_Store" {
			return false
		}
		if !media.IsJunk(name) {
			return false
		}
	}
	return true
}

func within(root, p string) bool {
	rel, err := filepath.Rel(root, p)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)))
}
