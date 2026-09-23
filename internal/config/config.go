// Package config reads runtime settings from the environment.
package config

import (
	"os"
	"path/filepath"
)

type Config struct {
	Addr      string // HTTP listen address
	ConfigDir string // database and caches, mapped to the host
	DataDir   string // manga files, mapped to the host
	WebDir    string // built frontend; empty or missing disables static serving
}

func Load() Config {
	return Config{
		Addr:      env("MANGAYOMI_ADDR", ":"+env("PORT", "7652")),
		ConfigDir: abs(env("MANGAYOMI_CONFIG_DIR", "config")),
		DataDir:   abs(env("MANGAYOMI_DATA_DIR", "data")),
		WebDir:    abs(env("MANGAYOMI_WEB_DIR", filepath.Join("web", "dist"))),
	}
}

func (c Config) DBPath() string   { return filepath.Join(c.ConfigDir, "mangayomi.db") }
func (c Config) CoverDir() string { return filepath.Join(c.ConfigDir, "cache", "covers") }

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func abs(p string) string {
	if a, err := filepath.Abs(p); err == nil {
		return a
	}
	return filepath.Clean(p)
}
