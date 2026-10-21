package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"sort"
	"strings"

	"mangayomi/internal/natural"
)

const (
	KindArchive = "archive"
	KindFolder  = "folder"
)

type Progress struct {
	Page      int   `json:"page"`
	Completed bool  `json:"completed"`
	UpdatedAt int64 `json:"updatedAt"`
}

type Work struct {
	ID        int64     `json:"id"`
	LibraryID int64     `json:"libraryId"`
	RelPath   string    `json:"relPath"`
	Kind      string    `json:"kind"`
	Title     string    `json:"title"`
	Author    string    `json:"author"`
	Series    string    `json:"series"`
	PageCount int       `json:"pageCount"`
	Size      int64     `json:"size"`
	Mtime     int64     `json:"mtime"`
	AddedAt   int64     `json:"addedAt"`
	Progress  *Progress `json:"progress"`
}

type Dim struct {
	W int `json:"w"`
	H int `json:"h"`
}

// WorkFile is a work plus what is needed to read its pages from disk.
type WorkFile struct {
	Work
	LibraryPath string
	Pages       []string
	Dims        []Dim // nil until computed
}

const workCols = `w.id, w.library_id, w.rel_path, w.kind, w.title, w.author, w.series, w.page_count, w.size,
	w.mtime, w.added_at, p.page, p.completed, p.updated_at`

const workFrom = ` FROM works w LEFT JOIN progress p ON p.work_id = w.id`

func scanWork(r rowScanner, extra ...any) (Work, error) {
	var w Work
	var page, completed, updated sql.NullInt64
	dest := []any{&w.ID, &w.LibraryID, &w.RelPath, &w.Kind, &w.Title, &w.Author, &w.Series, &w.PageCount,
		&w.Size, &w.Mtime, &w.AddedAt, &page, &completed, &updated}
	if err := r.Scan(append(dest, extra...)...); err != nil {
		return w, err
	}
	if page.Valid {
		w.Progress = &Progress{Page: int(page.Int64), Completed: completed.Int64 == 1, UpdatedAt: updated.Int64}
	}
	return w, nil
}

type WorkFilter struct {
	IDs       []int64
	LibraryID int64
	Author    *string
	Series    *string
	Query     string
	Status    string // "", "unread", "reading", "completed"
	Sort      string // "title", "added", "recent"
	Offset    int
	Limit     int // 0 = no limit
}

func (f WorkFilter) where() (string, []any) {
	conds := []string{"1 = 1"}
	var args []any
	if len(f.IDs) > 0 {
		conds = append(conds, "w.id IN ("+placeholders(len(f.IDs))+")")
		args = append(args, int64Args(f.IDs)...)
	}
	if f.LibraryID > 0 {
		conds = append(conds, "w.library_id = ?")
		args = append(args, f.LibraryID)
	}
	if f.Author != nil {
		conds = append(conds, "w.author = ?")
		args = append(args, *f.Author)
	}
	if f.Series != nil {
		conds = append(conds, "w.series = ?")
		args = append(args, *f.Series)
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		like := escapeLike(q)
		conds = append(conds, `(w.title LIKE ? ESCAPE '\' OR w.author LIKE ? ESCAPE '\' OR w.series LIKE ? ESCAPE '\')`)
		args = append(args, like, like, like)
	}
	switch f.Status {
	case "unread":
		conds = append(conds, "p.work_id IS NULL")
	case "reading":
		conds = append(conds, "p.work_id IS NOT NULL AND p.completed = 0")
	case "completed":
		conds = append(conds, "p.completed = 1")
	}
	return " WHERE " + strings.Join(conds, " AND "), args
}

func (f WorkFilter) orderBy() string {
	switch f.Sort {
	case "added":
		return " ORDER BY w.added_at DESC, w.id DESC"
	case "recent":
		return " ORDER BY p.updated_at IS NULL, p.updated_at DESC, w.sort_key"
	case "series":
		return " ORDER BY w.author = '', w.author COLLATE NOCASE, w.series = '', w.series COLLATE NOCASE, w.sort_key"
	default:
		return " ORDER BY w.sort_key, w.id"
	}
}

func (s *Store) ListWorks(ctx context.Context, f WorkFilter) ([]Work, int, error) {
	where, args := f.where()
	var total int
	if err := s.db.QueryRowContext(ctx, `SELECT COUNT(*)`+workFrom+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	q := `SELECT ` + workCols + workFrom + where + f.orderBy()
	if f.Limit > 0 {
		q += " LIMIT ? OFFSET ?"
		args = append(args, f.Limit, f.Offset)
	}
	rows, err := s.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	works := []Work{}
	for rows.Next() {
		w, err := scanWork(rows)
		if err != nil {
			return nil, 0, err
		}
		works = append(works, w)
	}
	return works, total, rows.Err()
}

func (s *Store) GetWork(ctx context.Context, id int64) (Work, error) {
	w, err := scanWork(s.db.QueryRowContext(ctx, `SELECT `+workCols+workFrom+` WHERE w.id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return w, ErrNotFound
	}
	return w, err
}

func (s *Store) GetWorkFile(ctx context.Context, id int64) (WorkFile, error) {
	var wf WorkFile
	var pages []byte
	var dims sql.NullString
	w, err := scanWork(s.db.QueryRowContext(ctx,
		`SELECT `+workCols+`, l.path, w.pages, w.dims`+workFrom+` JOIN libraries l ON l.id = w.library_id WHERE w.id = ?`, id),
		&wf.LibraryPath, &pages, &dims)
	if errors.Is(err, sql.ErrNoRows) {
		return wf, ErrNotFound
	}
	if err != nil {
		return wf, err
	}
	wf.Work = w
	wf.Pages = DecodePages(pages)
	if dims.Valid {
		_ = json.Unmarshal([]byte(dims.String), &wf.Dims)
	}
	return wf, nil
}

func (s *Store) SetDims(ctx context.Context, id int64, dims []Dim) error {
	b, _ := json.Marshal(dims)
	_, err := s.db.ExecContext(ctx, `UPDATE works SET dims = ? WHERE id = ?`, string(b), id)
	return err
}

// EncodePages stores entry names NUL-separated: archive entry names are not
// guaranteed to be valid UTF-8, so they cannot round-trip through JSON.
func EncodePages(pages []string) []byte { return []byte(strings.Join(pages, "\x00")) }

func DecodePages(b []byte) []string {
	if len(b) == 0 {
		return nil
	}
	return strings.Split(string(b), "\x00")
}

// ---- scanner support ----

type IndexEntry struct {
	ID        int64
	Kind      string
	Size      int64
	Mtime     int64
	PageCount int
	Title     string
	Author    string
	Series    string
}

func (s *Store) WorkIndex(ctx context.Context, libraryID int64) (map[string]IndexEntry, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, rel_path, kind, size, mtime, page_count, title, author, series FROM works WHERE library_id = ?`, libraryID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	idx := map[string]IndexEntry{}
	for rows.Next() {
		var e IndexEntry
		var rel string
		if err := rows.Scan(&e.ID, &rel, &e.Kind, &e.Size, &e.Mtime, &e.PageCount, &e.Title, &e.Author, &e.Series); err != nil {
			return nil, err
		}
		idx[rel] = e
	}
	return idx, rows.Err()
}

type WorkRecord struct {
	LibraryID int64
	RelPath   string
	Kind      string
	Title     string
	Author    string
	Series    string
	Pages     []string
	Size      int64
	Mtime     int64
}

func (s *Store) InsertWork(ctx context.Context, r WorkRecord) (int64, error) {
	now := Now()
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO works (library_id, rel_path, kind, title, sort_key, author, series, page_count, pages, size, mtime, added_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		r.LibraryID, r.RelPath, r.Kind, r.Title, natural.Key(r.Title), r.Author, r.Series, len(r.Pages),
		EncodePages(r.Pages), r.Size, r.Mtime, now, now)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// UpdateWork replaces the content of a changed work and forgets cached page sizes.
func (s *Store) UpdateWork(ctx context.Context, id int64, r WorkRecord) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE works SET kind = ?, title = ?, sort_key = ?, author = ?, series = ?, page_count = ?, pages = ?,
		 dims = NULL, size = ?, mtime = ?, updated_at = ? WHERE id = ?`,
		r.Kind, r.Title, natural.Key(r.Title), r.Author, r.Series, len(r.Pages), EncodePages(r.Pages),
		r.Size, r.Mtime, Now(), id)
	if err != nil {
		return err
	}
	// Keep the reader position valid if the work shrank.
	_, err = s.db.ExecContext(ctx,
		`UPDATE progress SET page = MAX(0, ? - 1) WHERE work_id = ? AND page >= ?`, len(r.Pages), id, len(r.Pages))
	return err
}

func (s *Store) UpdateWorkMeta(ctx context.Context, id int64, title, author, series string) error {
	_, err := s.db.ExecContext(ctx,
		`UPDATE works SET title = ?, sort_key = ?, author = ?, series = ?, updated_at = ? WHERE id = ?`,
		title, natural.Key(title), author, series, Now(), id)
	return err
}

func (s *Store) DeleteWorks(ctx context.Context, ids []int64) error {
	for len(ids) > 0 {
		n := min(len(ids), 500)
		if _, err := s.db.ExecContext(ctx,
			`DELETE FROM works WHERE id IN (`+placeholders(n)+`)`, int64Args(ids[:n])...); err != nil {
			return err
		}
		ids = ids[n:]
	}
	return nil
}

// ---- series navigation ----

type WorkRef struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
}

// SeriesNeighbors returns the works before and after w within its series.
func (s *Store) SeriesNeighbors(ctx context.Context, w Work) (prev, next *WorkRef, err error) {
	if w.Series == "" {
		return nil, nil, nil
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, title FROM works WHERE library_id = ? AND author = ? AND series = ? ORDER BY sort_key, id`,
		w.LibraryID, w.Author, w.Series)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	var list []WorkRef
	for rows.Next() {
		var r WorkRef
		if err := rows.Scan(&r.ID, &r.Title); err != nil {
			return nil, nil, err
		}
		list = append(list, r)
	}
	for i, r := range list {
		if r.ID != w.ID {
			continue
		}
		if i > 0 {
			prev = &list[i-1]
		}
		if i+1 < len(list) {
			next = &list[i+1]
		}
	}
	return prev, next, rows.Err()
}

// ---- groups ----

type SeriesGroup struct {
	Author       string `json:"author"`
	Series       string `json:"series"`
	Count        int    `json:"count"`
	Completed    int    `json:"completed"`
	CoverID      int64  `json:"coverId"`
	CoverVersion int64  `json:"coverVersion"`
	LastAddedAt  int64  `json:"lastAddedAt"`
}

type AuthorGroup struct {
	Author       string `json:"author"`
	Count        int    `json:"count"`
	SeriesCount  int    `json:"seriesCount"`
	Completed    int    `json:"completed"`
	CoverID      int64  `json:"coverId"`
	CoverVersion int64  `json:"coverVersion"`
	LastAddedAt  int64  `json:"lastAddedAt"`
}

type GroupFilter struct {
	LibraryID int64
	Author    *string
	Query     string
	Sort      string // "name" or "added"
	Offset    int
	Limit     int // 0 = no limit
}

// page applies the filter offset and limit to a sorted group list. Groups
// are sorted in Go (natural order), so paging happens after the query.
func page[T any](items []T, f GroupFilter) []T {
	items = items[min(f.Offset, len(items)):]
	if f.Limit > 0 && f.Limit < len(items) {
		items = items[:f.Limit]
	}
	return items
}

func (f GroupFilter) where(searchCols ...string) (string, []any) {
	var conds []string
	var args []any
	if f.LibraryID > 0 {
		conds = append(conds, "w.library_id = ?")
		args = append(args, f.LibraryID)
	}
	if f.Author != nil {
		conds = append(conds, "w.author = ?")
		args = append(args, *f.Author)
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		var ors []string
		for _, c := range searchCols {
			ors = append(ors, c+` LIKE ? ESCAPE '\'`)
			args = append(args, escapeLike(q))
		}
		conds = append(conds, "("+strings.Join(ors, " OR ")+")")
	}
	if len(conds) == 0 {
		return "", nil
	}
	return " AND " + strings.Join(conds, " AND "), args
}

// ListSeries returns one page of series groups and the total count.
func (s *Store) ListSeries(ctx context.Context, f GroupFilter) ([]SeriesGroup, int, error) {
	where, args := f.where("w.series", "w.author")
	rows, err := s.db.QueryContext(ctx, `
WITH ranked AS (
	SELECT w.id, w.author, w.series, w.mtime, w.added_at, COALESCE(p.completed, 0) AS done,
		ROW_NUMBER() OVER (PARTITION BY w.author, w.series ORDER BY w.sort_key, w.id) AS rn
	`+workFrom+` WHERE w.series <> ''`+where+`
)
SELECT author, series, COUNT(*), SUM(done), MAX(added_at),
	MAX(CASE WHEN rn = 1 THEN id END), MAX(CASE WHEN rn = 1 THEN mtime END)
FROM ranked GROUP BY author, series`, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	groups := []SeriesGroup{}
	for rows.Next() {
		var g SeriesGroup
		if err := rows.Scan(&g.Author, &g.Series, &g.Count, &g.Completed, &g.LastAddedAt, &g.CoverID, &g.CoverVersion); err != nil {
			return nil, 0, err
		}
		groups = append(groups, g)
	}
	if f.Sort == "added" {
		sort.SliceStable(groups, func(i, j int) bool { return groups[i].LastAddedAt > groups[j].LastAddedAt })
	} else {
		sort.SliceStable(groups, func(i, j int) bool {
			if c := natural.Compare(groups[i].Series, groups[j].Series); c != 0 {
				return c < 0
			}
			return natural.Less(groups[i].Author, groups[j].Author)
		})
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return page(groups, f), len(groups), nil
}

// ListAuthors returns one page of author groups and the total count.
func (s *Store) ListAuthors(ctx context.Context, f GroupFilter) ([]AuthorGroup, int, error) {
	f.Author = nil
	where, args := f.where("w.author")
	rows, err := s.db.QueryContext(ctx, `
WITH ranked AS (
	SELECT w.id, w.author, w.series, w.mtime, w.added_at, COALESCE(p.completed, 0) AS done,
		ROW_NUMBER() OVER (PARTITION BY w.author ORDER BY w.series = '', w.series, w.sort_key, w.id) AS rn
	`+workFrom+` WHERE w.author <> ''`+where+`
)
SELECT author, COUNT(*), COUNT(DISTINCT NULLIF(series, '')), SUM(done), MAX(added_at),
	MAX(CASE WHEN rn = 1 THEN id END), MAX(CASE WHEN rn = 1 THEN mtime END)
FROM ranked GROUP BY author`, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	groups := []AuthorGroup{}
	for rows.Next() {
		var g AuthorGroup
		if err := rows.Scan(&g.Author, &g.Count, &g.SeriesCount, &g.Completed, &g.LastAddedAt, &g.CoverID, &g.CoverVersion); err != nil {
			return nil, 0, err
		}
		groups = append(groups, g)
	}
	if f.Sort == "added" {
		sort.SliceStable(groups, func(i, j int) bool { return groups[i].LastAddedAt > groups[j].LastAddedAt })
	} else {
		sort.SliceStable(groups, func(i, j int) bool { return natural.Less(groups[i].Author, groups[j].Author) })
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	return page(groups, f), len(groups), nil
}

// ---- progress ----

func (s *Store) SetProgress(ctx context.Context, workID int64, page int, completed bool) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO progress (work_id, page, completed, updated_at) VALUES (?, ?, ?, ?)
		 ON CONFLICT (work_id) DO UPDATE SET page = excluded.page, completed = excluded.completed, updated_at = excluded.updated_at`,
		workID, page, boolInt(completed), Now())
	return err
}

// MarkCompleted marks works as read, or clears their progress entirely.
func (s *Store) MarkCompleted(ctx context.Context, ids []int64, completed bool) error {
	if len(ids) == 0 {
		return nil
	}
	if !completed {
		_, err := s.db.ExecContext(ctx,
			`DELETE FROM progress WHERE work_id IN (`+placeholders(len(ids))+`)`, int64Args(ids)...)
		return err
	}
	args := append([]any{Now()}, int64Args(ids)...)
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO progress (work_id, page, completed, updated_at)
		 SELECT id, MAX(page_count - 1, 0), 1, ? FROM works WHERE id IN (`+placeholders(len(ids))+`)
		 ON CONFLICT (work_id) DO UPDATE SET page = excluded.page, completed = 1, updated_at = excluded.updated_at`,
		args...)
	return err
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
