// Package media reads pages out of archives and folders and renders covers.
package media

import (
	"archive/zip"
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"sync"

	_ "image/gif"
	_ "image/png"

	_ "golang.org/x/image/bmp"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"

	"mangayomi/internal/natural"
	"mangayomi/internal/store"
)

var imageTypes = map[string]string{
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".png":  "image/png",
	".gif":  "image/gif",
	".webp": "image/webp",
	".bmp":  "image/bmp",
	".avif": "image/avif",
}

func IsImage(name string) bool {
	_, ok := imageTypes[strings.ToLower(path.Ext(name))]
	return ok
}

func IsArchive(name string) bool {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".zip", ".cbz":
		return true
	}
	return false
}

func ContentType(name string) string {
	if t, ok := imageTypes[strings.ToLower(path.Ext(name))]; ok {
		return t
	}
	return "application/octet-stream"
}

// IsJunk reports names that are never part of a comic: OS metadata,
// NAS recycle bins and thumbnail folders, hidden files.
func IsJunk(name string) bool {
	if strings.HasPrefix(name, ".") {
		return true
	}
	switch strings.ToLower(name) {
	case "@eadir", "#recycle", "#snapshot", "$recycle.bin", "system volume information",
		"__macosx", "thumbs.db", "desktop.ini":
		return true
	}
	return false
}

const coverWidth = 400

type Service struct {
	zips     *zipCache
	coverDir string
	sem      chan struct{} // bounds concurrent image decoding
	mu       sync.Mutex
	inflight map[int64]*coverCall
}

type coverCall struct {
	done chan struct{}
	err  error
}

func New(coverDir string) *Service {
	return &Service{
		zips:     newZipCache(16),
		coverDir: coverDir,
		sem:      make(chan struct{}, 2),
		inflight: map[int64]*coverCall{},
	}
}

func (s *Service) Close() { s.zips.closeAll() }

// ListArchive returns the image entries of a zip in reading order.
func (s *Service) ListArchive(abs string) ([]string, error) {
	h, err := s.zips.acquire(abs)
	if err != nil {
		return nil, err
	}
	defer s.zips.release(h)
	var pages []string
	for _, f := range h.rc.File {
		if f.FileInfo().IsDir() || !IsImage(f.Name) {
			continue
		}
		if junkPath(f.Name) {
			continue
		}
		pages = append(pages, f.Name)
	}
	sort.SliceStable(pages, func(i, j int) bool { return natural.Less(pages[i], pages[j]) })
	return pages, nil
}

func junkPath(name string) bool {
	for _, part := range strings.Split(name, "/") {
		if IsJunk(part) {
			return true
		}
	}
	return false
}

// OpenPage opens one page of a work. abs is the archive file or the folder.
func (s *Service) OpenPage(abs, kind, name string) (io.ReadCloser, int64, error) {
	if kind == store.KindFolder {
		if name != filepath.Base(name) {
			return nil, 0, errors.New("invalid page name")
		}
		f, err := os.Open(filepath.Join(abs, name))
		if err != nil {
			return nil, 0, err
		}
		fi, err := f.Stat()
		if err != nil {
			f.Close()
			return nil, 0, err
		}
		return f, fi.Size(), nil
	}
	h, err := s.zips.acquire(abs)
	if err != nil {
		return nil, 0, err
	}
	zf, ok := h.files[name]
	if !ok {
		s.zips.release(h)
		return nil, 0, os.ErrNotExist
	}
	rc, err := zf.Open()
	if err != nil {
		s.zips.release(h)
		return nil, 0, err
	}
	return &zipPage{ReadCloser: rc, release: func() { s.zips.release(h) }}, int64(zf.UncompressedSize64), nil
}

type zipPage struct {
	io.ReadCloser
	release func()
	once    sync.Once
}

func (z *zipPage) Close() error {
	err := z.ReadCloser.Close()
	z.once.Do(z.release)
	return err
}

// Evict closes any cached handle on abs, e.g. before deleting the file.
func (s *Service) Evict(abs string) { s.zips.evict(abs) }

// Dims reads the pixel size of every page from the image headers.
// Pages whose format cannot be decoded (e.g. AVIF) report 0x0.
func (s *Service) Dims(wf store.WorkFile) []store.Dim {
	abs := filepath.Join(wf.LibraryPath, filepath.FromSlash(wf.RelPath))
	dims := make([]store.Dim, len(wf.Pages))
	for i, name := range wf.Pages {
		rc, _, err := s.OpenPage(abs, wf.Kind, name)
		if err != nil {
			continue
		}
		if cfg, _, err := image.DecodeConfig(rc); err == nil {
			dims[i] = store.Dim{W: cfg.Width, H: cfg.Height}
		}
		rc.Close()
	}
	return dims
}

func (s *Service) CoverPath(id int64) string {
	return filepath.Join(s.coverDir, fmt.Sprintf("%d.jpg", id))
}

func (s *Service) HasCover(id int64) bool {
	_, err := os.Stat(s.CoverPath(id))
	return err == nil
}

func (s *Service) RemoveCover(id int64) {
	_ = os.Remove(s.CoverPath(id))
}

// EnsureCover renders the cover thumbnail if it is not cached yet and
// returns its path. Concurrent calls for the same work share one render.
func (s *Service) EnsureCover(wf store.WorkFile) (string, error) {
	p := s.CoverPath(wf.ID)
	if _, err := os.Stat(p); err == nil {
		return p, nil
	}
	s.mu.Lock()
	if c, ok := s.inflight[wf.ID]; ok {
		s.mu.Unlock()
		<-c.done
		return p, c.err
	}
	c := &coverCall{done: make(chan struct{})}
	s.inflight[wf.ID] = c
	s.mu.Unlock()

	c.err = s.renderCover(wf, p)

	s.mu.Lock()
	delete(s.inflight, wf.ID)
	s.mu.Unlock()
	close(c.done)
	return p, c.err
}

func (s *Service) renderCover(wf store.WorkFile, dst string) error {
	if len(wf.Pages) == 0 {
		return os.ErrNotExist
	}
	s.sem <- struct{}{}
	defer func() { <-s.sem }()

	abs := filepath.Join(wf.LibraryPath, filepath.FromSlash(wf.RelPath))
	rc, _, err := s.OpenPage(abs, wf.Kind, wf.Pages[0])
	if err != nil {
		return err
	}
	src, _, err := image.Decode(rc)
	rc.Close()
	if err != nil {
		return fmt.Errorf("decode cover: %w", err)
	}

	// Average down to between one and two cover widths first, so the
	// bilinear pass below only has a small image left to filter.
	if f := src.Bounds().Dx() / coverWidth; f >= 2 {
		src = shrink(src, f)
	}
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	if w > coverWidth {
		h = h * coverWidth / w
		w = coverWidth
	}
	thumb := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.BiLinear.Scale(thumb, thumb.Bounds(), src, b, draw.Src, nil)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, thumb, &jpeg.Options{Quality: 82}); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	tmp := dst + ".tmp"
	if err := os.WriteFile(tmp, buf.Bytes(), 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, dst)
}

// ---- zip handle cache ----

// Opening a zip reads its central directory, which is slow for big archives
// on network storage. Handles are kept open for a while and shared between
// requests; zip.File.Open is safe for concurrent use.
type zipHandle struct {
	path  string
	rc    *zip.ReadCloser
	files map[string]*zip.File
	size  int64
	mtime int64
	refs  int
	used  int64 // monotonically increasing use counter for LRU
	dead  bool
}

type zipCache struct {
	mu    sync.Mutex
	items map[string]*zipHandle
	max   int
	tick  int64
}

func newZipCache(max int) *zipCache {
	return &zipCache{items: map[string]*zipHandle{}, max: max}
}

func (c *zipCache) acquire(p string) (*zipHandle, error) {
	fi, err := os.Stat(p)
	if err != nil {
		return nil, err
	}
	size, mtime := fi.Size(), fi.ModTime().UnixNano()

	c.mu.Lock()
	if h, ok := c.items[p]; ok {
		if h.size == size && h.mtime == mtime {
			c.tick++
			h.refs++
			h.used = c.tick
			c.mu.Unlock()
			return h, nil
		}
		c.removeLocked(h)
	}
	c.mu.Unlock()

	rc, err := zip.OpenReader(p)
	if err != nil {
		return nil, err
	}
	h := &zipHandle{path: p, rc: rc, files: make(map[string]*zip.File, len(rc.File)), size: size, mtime: mtime, refs: 1}
	for _, f := range rc.File {
		h.files[f.Name] = f
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	if cur, ok := c.items[p]; ok {
		if cur.size == size && cur.mtime == mtime {
			rc.Close()
			c.tick++
			cur.refs++
			cur.used = c.tick
			return cur, nil
		}
		c.removeLocked(cur)
	}
	c.tick++
	h.used = c.tick
	c.items[p] = h
	for len(c.items) > c.max {
		var lru *zipHandle
		for _, it := range c.items {
			if it != h && (lru == nil || it.used < lru.used) {
				lru = it
			}
		}
		if lru == nil {
			break
		}
		c.removeLocked(lru)
	}
	return h, nil
}

func (c *zipCache) release(h *zipHandle) {
	c.mu.Lock()
	defer c.mu.Unlock()
	h.refs--
	if h.dead && h.refs == 0 {
		h.rc.Close()
	}
}

func (c *zipCache) removeLocked(h *zipHandle) {
	if c.items[h.path] == h {
		delete(c.items, h.path)
	}
	if !h.dead {
		h.dead = true
		if h.refs == 0 {
			h.rc.Close()
		}
	}
}

func (c *zipCache) evict(p string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if h, ok := c.items[p]; ok {
		c.removeLocked(h)
	}
}

func (c *zipCache) closeAll() {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, h := range c.items {
		c.removeLocked(h)
	}
}
