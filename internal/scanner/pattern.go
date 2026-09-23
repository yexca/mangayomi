package scanner

import (
	"fmt"
	"path"
	"strings"

	"mangayomi/internal/store"
)

const (
	tokAuthor = "author"
	tokSeries = "series"
	tokIgnore = "ignore"
)

// Pattern maps the folders above a work to metadata. "{author}/{series}"
// means the first folder level below the library root is the author and the
// second is the series; deeper folders are ignored.
type Pattern struct {
	tokens []string
}

func ParsePattern(s string) (Pattern, error) {
	s = strings.Trim(strings.TrimSpace(strings.ReplaceAll(s, `\`, "/")), "/")
	if s == "" {
		return Pattern{}, nil
	}
	var p Pattern
	seen := map[string]bool{}
	for _, part := range strings.Split(s, "/") {
		part = strings.TrimSpace(part)
		var tok string
		switch strings.ToLower(part) {
		case "{author}":
			tok = tokAuthor
		case "{series}":
			tok = tokSeries
		case "{ignore}", "*":
			tok = tokIgnore
		default:
			return Pattern{}, fmt.Errorf("unknown segment %q: use {author}, {series} or {ignore}", part)
		}
		if tok != tokIgnore && seen[tok] {
			return Pattern{}, fmt.Errorf("%s appears more than once", part)
		}
		seen[tok] = true
		p.tokens = append(p.tokens, tok)
	}
	return p, nil
}

type Meta struct {
	Title  string `json:"title"`
	Author string `json:"author"`
	Series string `json:"series"`
}

// Apply derives metadata for a work at rel (slash-separated, relative to the
// library root). The work's own name is always the title; only the folders
// above it are matched against the pattern.
func (p Pattern) Apply(rel, kind, rootName string) Meta {
	var m Meta
	if rel == "" {
		m.Title = rootName
		return m
	}
	name := path.Base(rel)
	if kind == store.KindArchive {
		name = strings.TrimSuffix(name, path.Ext(name))
	}
	m.Title = name
	dir := path.Dir(rel)
	if dir == "." {
		return m
	}
	segs := strings.Split(dir, "/")
	for i, tok := range p.tokens {
		if i >= len(segs) {
			break
		}
		switch tok {
		case tokAuthor:
			m.Author = segs[i]
		case tokSeries:
			m.Series = segs[i]
		}
	}
	return m
}
