// Package api exposes the HTTP API and serves the built frontend.
package api

import (
	"encoding/json"
	"errors"
	"io/fs"
	"log/slog"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"

	"mangayomi/internal/auth"
	"mangayomi/internal/config"
	"mangayomi/internal/deletion"
	"mangayomi/internal/media"
	"mangayomi/internal/scanner"
	"mangayomi/internal/store"
)

type Server struct {
	cfg     config.Config
	store   *store.Store
	auth    *auth.Auth
	media   *media.Service
	scanner *scanner.Scanner
	deleter *deletion.Service
	log     *slog.Logger
}

func New(cfg config.Config, st *store.Store, a *auth.Auth, m *media.Service, sc *scanner.Scanner,
	d *deletion.Service, log *slog.Logger) *Server {
	return &Server{cfg: cfg, store: st, auth: a, media: m, scanner: sc, deleter: d, log: log}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/auth/status", s.authStatus)
	mux.HandleFunc("POST /api/auth/setup", s.authSetup)
	mux.HandleFunc("POST /api/auth/login", s.authLogin)
	mux.HandleFunc("POST /api/auth/logout", s.authLogout)

	private := func(pattern string, h http.HandlerFunc) { mux.Handle(pattern, s.requireAuth(h)) }
	private("POST /api/auth/password", s.changePassword)

	private("GET /api/fs/browse", s.browse)

	private("GET /api/libraries", s.listLibraries)
	private("POST /api/libraries", s.createLibrary)
	private("POST /api/libraries/preview", s.previewLibrary)
	private("POST /api/libraries/scan", s.scanAll)
	private("GET /api/libraries/{id}", s.getLibrary)
	private("PUT /api/libraries/{id}", s.updateLibrary)
	private("DELETE /api/libraries/{id}", s.deleteLibrary)
	private("POST /api/libraries/{id}/scan", s.scanLibrary)
	private("GET /api/scan/status", s.scanStatus)

	private("GET /api/home", s.home)
	private("GET /api/works", s.listWorks)
	private("GET /api/works/{id}", s.getWork)
	private("GET /api/works/{id}/pages", s.workPages)
	private("GET /api/works/{id}/pages/{n}", s.workPage)
	private("GET /api/works/{id}/cover", s.workCover)
	private("PUT /api/works/{id}/progress", s.setProgress)
	private("POST /api/progress/batch", s.batchProgress)
	private("GET /api/series", s.listSeries)
	private("GET /api/authors", s.listAuthors)

	private("POST /api/delete/preview", s.deletePreview)
	private("POST /api/delete/confirm", s.deleteConfirm)

	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "not_found", "not found")
	})
	mux.Handle("/", s.static())

	return s.recoverer(s.requireJSON(mux))
}

// ---- middleware ----

func (s *Server) requireAuth(next http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := auth.TokenFromRequest(r)
		ok, extended := s.auth.Validate(r.Context(), token)
		if !ok {
			writeError(w, http.StatusUnauthorized, "unauthorized", "sign in required")
			return
		}
		if !extended.IsZero() {
			auth.SetCookie(w, r, token, extended)
		}
		next(w, r)
	})
}

// requireJSON blocks cross-site form posts: browsers cannot send an
// application/json body to another origin without a CORS preflight.
func (s *Server) requireJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
		default:
			if strings.HasPrefix(r.URL.Path, "/api/") {
				mt, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
				if mt != "application/json" {
					writeError(w, http.StatusUnsupportedMediaType, "bad_request", "expected application/json")
					return
				}
			}
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if v := recover(); v != nil {
				if v == http.ErrAbortHandler {
					panic(v)
				}
				s.log.Error("panic", "path", r.URL.Path, "err", v)
				writeError(w, http.StatusInternalServerError, "internal", "internal error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// ---- static frontend ----

func (s *Server) static() http.Handler {
	dir := s.cfg.WebDir
	if _, err := os.Stat(filepath.Join(dir, "index.html")); err != nil {
		s.log.Warn("frontend not found, serving API only", "dir", dir)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "Frontend not built. Run `npm run build` in web/ or use the Vite dev server.", http.StatusNotFound)
		})
	}
	fsys := os.DirFS(dir)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if p == "" {
			p = "index.html"
		}
		if fi, err := fs.Stat(fsys, p); err == nil && !fi.IsDir() {
			switch {
			case strings.HasPrefix(p, "assets/"):
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			case p == "index.html" || p == "sw.js" || p == "registerSW.js" || strings.HasSuffix(p, ".webmanifest"):
				w.Header().Set("Cache-Control", "no-cache")
			}
			if p == "index.html" {
				serveIndex(w, r, fsys)
				return
			}
			http.ServeFileFS(w, r, fsys, p)
			return
		}
		if strings.HasPrefix(p, "assets/") || path.Ext(p) != "" {
			http.NotFound(w, r)
			return
		}
		// Client-side route.
		w.Header().Set("Cache-Control", "no-cache")
		serveIndex(w, r, fsys)
	})
}

func serveIndex(w http.ResponseWriter, r *http.Request, fsys fs.FS) {
	b, err := fs.ReadFile(fsys, "index.html")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(b)
}

// ---- helpers ----

type apiError struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, msg string) {
	writeJSON(w, status, apiError{Error: msg, Code: code})
}

func (s *Server) internal(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found", "not found")
		return
	}
	s.log.Error("request failed", "path", r.URL.Path, "err", err)
	writeError(w, http.StatusInternalServerError, "internal", err.Error())
}

func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid JSON body: "+err.Error())
		return false
	}
	return true
}

func pathID(w http.ResponseWriter, r *http.Request, name string) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid "+name)
		return 0, false
	}
	return id, true
}

func queryInt(r *http.Request, name string, def int) int {
	v, err := strconv.Atoi(r.URL.Query().Get(name))
	if err != nil {
		return def
	}
	return v
}

func queryInt64(r *http.Request, name string) int64 {
	v, _ := strconv.ParseInt(r.URL.Query().Get(name), 10, 64)
	return v
}

// queryOptional distinguishes "absent" from "present but empty".
func queryOptional(r *http.Request, name string) *string {
	q := r.URL.Query()
	if !q.Has(name) {
		return nil
	}
	v := q.Get(name)
	return &v
}

func within(root, p string) bool {
	rel, err := filepath.Rel(root, p)
	if err != nil {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)))
}
