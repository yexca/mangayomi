// Package store owns the SQLite database: schema, migrations and queries.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

var ErrNotFound = errors.New("not found")

type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	dsn := "file:" + filepath.ToSlash(path) +
		"?_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=synchronous(NORMAL)"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, err
	}
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

// Now is the timestamp format used throughout the schema: unix milliseconds.
func Now() int64 { return time.Now().UnixMilli() }

var migrations = []string{
	`
CREATE TABLE settings (
	key   TEXT PRIMARY KEY,
	value TEXT NOT NULL
);

CREATE TABLE sessions (
	token_hash TEXT PRIMARY KEY,
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);

CREATE TABLE libraries (
	id                INTEGER PRIMARY KEY AUTOINCREMENT,
	name              TEXT NOT NULL,
	path              TEXT NOT NULL,
	pattern           TEXT NOT NULL DEFAULT '',
	excludes          TEXT NOT NULL DEFAULT '[]',
	reading_direction TEXT NOT NULL DEFAULT 'rtl',
	scan_interval     INTEGER NOT NULL DEFAULT 0,
	last_scan_at      INTEGER,
	created_at        INTEGER NOT NULL
);

CREATE TABLE works (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
	rel_path   TEXT NOT NULL,
	kind       TEXT NOT NULL,
	title      TEXT NOT NULL,
	sort_key   TEXT NOT NULL,
	author     TEXT NOT NULL DEFAULT '',
	series     TEXT NOT NULL DEFAULT '',
	page_count INTEGER NOT NULL,
	pages      BLOB NOT NULL,
	dims       TEXT,
	size       INTEGER NOT NULL,
	mtime      INTEGER NOT NULL,
	added_at   INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	UNIQUE (library_id, rel_path)
);
CREATE INDEX idx_works_author_series ON works (author, series, sort_key);
CREATE INDEX idx_works_series ON works (series);
CREATE INDEX idx_works_sort ON works (sort_key);
CREATE INDEX idx_works_added ON works (added_at);

CREATE TABLE progress (
	work_id    INTEGER PRIMARY KEY REFERENCES works(id) ON DELETE CASCADE,
	page       INTEGER NOT NULL,
	completed  INTEGER NOT NULL DEFAULT 0,
	updated_at INTEGER NOT NULL
);
CREATE INDEX idx_progress_updated ON progress (updated_at);
`,
}

func (s *Store) migrate() error {
	var version int
	if err := s.db.QueryRow(`PRAGMA user_version`).Scan(&version); err != nil {
		return err
	}
	for i := version; i < len(migrations); i++ {
		tx, err := s.db.Begin()
		if err != nil {
			return err
		}
		if _, err := tx.Exec(migrations[i]); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("migration %d: %w", i+1, err)
		}
		if _, err := tx.Exec(fmt.Sprintf(`PRAGMA user_version = %d`, i+1)); err != nil {
			_ = tx.Rollback()
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}

// ---- settings ----

func (s *Store) GetSetting(ctx context.Context, key string) (string, bool, error) {
	var v string
	err := s.db.QueryRowContext(ctx, `SELECT value FROM settings WHERE key = ?`, key).Scan(&v)
	if errors.Is(err, sql.ErrNoRows) {
		return "", false, nil
	}
	return v, err == nil, err
}

func (s *Store) SetSetting(ctx context.Context, key, value string) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
		key, value)
	return err
}

// SetSettingIfAbsent reports whether the value was written.
func (s *Store) SetSettingIfAbsent(ctx context.Context, key, value string) (bool, error) {
	res, err := s.db.ExecContext(ctx,
		`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING`, key, value)
	if err != nil {
		return false, err
	}
	n, err := res.RowsAffected()
	return n == 1, err
}

func (s *Store) DeleteSetting(ctx context.Context, key string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM settings WHERE key = ?`, key)
	return err
}

// ---- sessions ----

func (s *Store) CreateSession(ctx context.Context, hash string, expiresAt int64) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)`, hash, Now(), expiresAt)
	return err
}

// SessionExpiry returns ErrNotFound for unknown or expired sessions.
func (s *Store) SessionExpiry(ctx context.Context, hash string) (int64, error) {
	var exp int64
	err := s.db.QueryRowContext(ctx,
		`SELECT expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?`, hash, Now()).Scan(&exp)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, ErrNotFound
	}
	return exp, err
}

func (s *Store) ExtendSession(ctx context.Context, hash string, expiresAt int64) error {
	_, err := s.db.ExecContext(ctx, `UPDATE sessions SET expires_at = ? WHERE token_hash = ?`, expiresAt, hash)
	return err
}

func (s *Store) DeleteSession(ctx context.Context, hash string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash = ?`, hash)
	return err
}

// DeleteOtherSessions removes every session except keepHash (pass "" to remove all).
func (s *Store) DeleteOtherSessions(ctx context.Context, keepHash string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE token_hash <> ?`, keepHash)
	return err
}

func (s *Store) PurgeExpiredSessions(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM sessions WHERE expires_at <= ?`, Now())
	return err
}

// ---- helpers ----

func placeholders(n int) string {
	return strings.TrimSuffix(strings.Repeat("?,", n), ",")
}

func int64Args(ids []int64) []any {
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	return args
}

func escapeLike(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return "%" + r.Replace(s) + "%"
}
