package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
)

type Library struct {
	ID               int64    `json:"id"`
	Name             string   `json:"name"`
	Path             string   `json:"path"`
	Pattern          string   `json:"pattern"`
	Excludes         []string `json:"excludes"`
	ReadingDirection string   `json:"readingDirection"`
	ScanInterval     int      `json:"scanInterval"` // minutes, 0 = manual only
	LastScanAt       *int64   `json:"lastScanAt"`
	CreatedAt        int64    `json:"createdAt"`
	WorkCount        int      `json:"workCount"`
}

const libraryCols = `l.id, l.name, l.path, l.pattern, l.excludes, l.reading_direction, l.scan_interval,
	l.last_scan_at, l.created_at, (SELECT COUNT(*) FROM works w WHERE w.library_id = l.id)`

type rowScanner interface{ Scan(dest ...any) error }

func scanLibrary(r rowScanner) (Library, error) {
	var l Library
	var excludes string
	var last sql.NullInt64
	err := r.Scan(&l.ID, &l.Name, &l.Path, &l.Pattern, &excludes, &l.ReadingDirection, &l.ScanInterval,
		&last, &l.CreatedAt, &l.WorkCount)
	if err != nil {
		return l, err
	}
	if last.Valid {
		l.LastScanAt = &last.Int64
	}
	if err := json.Unmarshal([]byte(excludes), &l.Excludes); err != nil || l.Excludes == nil {
		l.Excludes = []string{}
	}
	return l, nil
}

func (s *Store) ListLibraries(ctx context.Context) ([]Library, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT `+libraryCols+` FROM libraries l ORDER BY l.name COLLATE NOCASE, l.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	libs := []Library{}
	for rows.Next() {
		l, err := scanLibrary(rows)
		if err != nil {
			return nil, err
		}
		libs = append(libs, l)
	}
	return libs, rows.Err()
}

func (s *Store) GetLibrary(ctx context.Context, id int64) (Library, error) {
	l, err := scanLibrary(s.db.QueryRowContext(ctx, `SELECT `+libraryCols+` FROM libraries l WHERE l.id = ?`, id))
	if errors.Is(err, sql.ErrNoRows) {
		return l, ErrNotFound
	}
	return l, err
}

func (s *Store) CreateLibrary(ctx context.Context, l *Library) error {
	excludes, _ := json.Marshal(l.Excludes)
	l.CreatedAt = Now()
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO libraries (name, path, pattern, excludes, reading_direction, scan_interval, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		l.Name, l.Path, l.Pattern, string(excludes), l.ReadingDirection, l.ScanInterval, l.CreatedAt)
	if err != nil {
		return err
	}
	l.ID, err = res.LastInsertId()
	return err
}

func (s *Store) UpdateLibrary(ctx context.Context, l *Library) error {
	excludes, _ := json.Marshal(l.Excludes)
	res, err := s.db.ExecContext(ctx,
		`UPDATE libraries SET name = ?, path = ?, pattern = ?, excludes = ?, reading_direction = ?, scan_interval = ?
		 WHERE id = ?`,
		l.Name, l.Path, l.Pattern, string(excludes), l.ReadingDirection, l.ScanInterval, l.ID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// DeleteLibrary removes the library and its index (not files on disk) and
// returns the ids of the works that were dropped.
func (s *Store) DeleteLibrary(ctx context.Context, id int64) ([]int64, error) {
	ids, err := s.workIDs(ctx, `SELECT id FROM works WHERE library_id = ?`, id)
	if err != nil {
		return nil, err
	}
	res, err := s.db.ExecContext(ctx, `DELETE FROM libraries WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrNotFound
	}
	return ids, nil
}

func (s *Store) SetLastScan(ctx context.Context, id, at int64) error {
	_, err := s.db.ExecContext(ctx, `UPDATE libraries SET last_scan_at = ? WHERE id = ?`, at, id)
	return err
}

func (s *Store) workIDs(ctx context.Context, query string, args ...any) ([]int64, error) {
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
