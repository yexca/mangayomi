package scanner

import (
	"context"
	"errors"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"mangayomi/internal/media"
	"mangayomi/internal/natural"
	"mangayomi/internal/store"
)

// errStop ends a walk early without reporting an error.
var errStop = errors.New("stop walk")

// Candidate is something the walker recognised as a work.
type Candidate struct {
	RelPath string // slash-separated, relative to the library root; "" for the root itself
	AbsPath string
	Kind    string
	Images  []string // folder works only: image names in reading order
	Size    int64    // archive works only; folder size is computed on indexing
	Mtime   int64    // unix ms of the archive, or of the folder itself
}

// Walk visits every work below root:
//   - a .zip/.cbz file is a work;
//   - a folder that directly contains images is a work, and is not descended into.
//
// It returns the relative paths of folders that could not be read, so the
// caller does not mistake their contents for deleted works.
func Walk(ctx context.Context, root string, excludes []string, fn func(Candidate) error) ([]string, error) {
	w := walker{ctx: ctx, root: root, excludes: normalizeExcludes(excludes), fn: fn}
	fi, err := os.Stat(root)
	if err != nil {
		return nil, err
	}
	if !fi.IsDir() {
		return nil, errors.New("library path is not a directory")
	}
	err = w.dir(root, "", fi)
	if errors.Is(err, errStop) {
		err = nil
	}
	return w.failed, err
}

type walker struct {
	ctx      context.Context
	root     string
	excludes []string
	fn       func(Candidate) error
	failed   []string
}

func (w *walker) dir(abs, rel string, info fs.FileInfo) error {
	if err := w.ctx.Err(); err != nil {
		return err
	}
	entries, err := os.ReadDir(abs)
	if err != nil {
		if rel == "" {
			return err
		}
		w.failed = append(w.failed, rel)
		return nil
	}

	var images []string
	var subdirs []fs.DirEntry
	for _, e := range entries {
		name := e.Name()
		if media.IsJunk(name) {
			continue
		}
		childRel := joinRel(rel, name)
		if w.excluded(childRel) {
			continue
		}
		isDir := e.IsDir()
		if e.Type()&fs.ModeSymlink != 0 {
			// Follow symlinked files, but not directories: they can form loops.
			fi, err := os.Stat(filepath.Join(abs, name))
			if err != nil || fi.IsDir() {
				continue
			}
		}
		switch {
		case isDir:
			subdirs = append(subdirs, e)
		case media.IsImage(name):
			images = append(images, name)
		case media.IsArchive(name):
			fi, err := os.Stat(filepath.Join(abs, name))
			if err != nil {
				continue
			}
			if err := w.fn(Candidate{
				RelPath: childRel,
				AbsPath: filepath.Join(abs, name),
				Kind:    store.KindArchive,
				Size:    fi.Size(),
				Mtime:   fi.ModTime().UnixMilli(),
			}); err != nil {
				return err
			}
		}
	}

	if len(images) > 0 {
		sort.SliceStable(images, func(i, j int) bool { return natural.Less(images[i], images[j]) })
		return w.fn(Candidate{
			RelPath: rel,
			AbsPath: abs,
			Kind:    store.KindFolder,
			Images:  images,
			Mtime:   info.ModTime().UnixMilli(),
		})
	}

	sort.SliceStable(subdirs, func(i, j int) bool { return natural.Less(subdirs[i].Name(), subdirs[j].Name()) })
	for _, d := range subdirs {
		// Stat rather than d.Info(): on NTFS the parent's copy of a child
		// folder's timestamps can lag behind, which would look like a change.
		fi, err := os.Stat(filepath.Join(abs, d.Name()))
		if err != nil {
			w.failed = append(w.failed, joinRel(rel, d.Name()))
			continue
		}
		if err := w.dir(filepath.Join(abs, d.Name()), joinRel(rel, d.Name()), fi); err != nil {
			return err
		}
	}
	return nil
}

func (w *walker) excluded(rel string) bool {
	for _, ex := range w.excludes {
		if rel == ex || strings.HasPrefix(rel, ex+"/") {
			return true
		}
	}
	return false
}

func joinRel(rel, name string) string {
	if rel == "" {
		return name
	}
	return rel + "/" + name
}

// NormalizeRel cleans a relative path to slash form and rejects anything
// that escapes its base.
func NormalizeRel(p string) (string, bool) {
	p = strings.Trim(strings.ReplaceAll(p, `\`, "/"), "/")
	if p == "" {
		return "", false
	}
	p = path.Clean(p)
	if p == "." || p == ".." || strings.HasPrefix(p, "../") {
		return "", false
	}
	return p, true
}

func normalizeExcludes(in []string) []string {
	var out []string
	for _, e := range in {
		if n, ok := NormalizeRel(e); ok {
			out = append(out, n)
		}
	}
	return out
}

// underAny reports whether rel is one of prefixes or inside one of them.
func underAny(rel string, prefixes []string) bool {
	for _, p := range prefixes {
		if rel == p || strings.HasPrefix(rel, p+"/") {
			return true
		}
	}
	return false
}
