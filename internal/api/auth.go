package api

import (
	"errors"
	"net/http"

	"mangayomi/internal/auth"
)

func (s *Server) authStatus(w http.ResponseWriter, r *http.Request) {
	setup, err := s.auth.SetupRequired(r.Context())
	if err != nil {
		s.internal(w, r, err)
		return
	}
	ok := false
	if !setup {
		ok, _ = s.auth.Validate(r.Context(), auth.TokenFromRequest(r))
	}
	writeJSON(w, http.StatusOK, map[string]bool{"setupRequired": setup, "authenticated": ok})
}

type passwordBody struct {
	Password string `json:"password"`
}

func (s *Server) authSetup(w http.ResponseWriter, r *http.Request) {
	var body passwordBody
	if !readJSON(w, r, &body) {
		return
	}
	switch err := s.auth.Setup(r.Context(), body.Password); {
	case errors.Is(err, auth.ErrWeakPassword):
		writeError(w, http.StatusBadRequest, "weak_password", "password is too short")
		return
	case errors.Is(err, auth.ErrAlreadySetUp):
		writeError(w, http.StatusConflict, "already_setup", "already set up")
		return
	case err != nil:
		s.internal(w, r, err)
		return
	}
	s.startSession(w, r)
}

func (s *Server) authLogin(w http.ResponseWriter, r *http.Request) {
	var body passwordBody
	if !readJSON(w, r, &body) {
		return
	}
	switch err := s.auth.Login(r.Context(), body.Password, auth.ClientKey(r)); {
	case errors.Is(err, auth.ErrTooManyAttempts):
		writeError(w, http.StatusTooManyRequests, "too_many_attempts", "too many failed attempts, try again later")
		return
	case errors.Is(err, auth.ErrInvalidPassword):
		writeError(w, http.StatusUnauthorized, "invalid_password", "wrong password")
		return
	case err != nil:
		s.internal(w, r, err)
		return
	}
	s.startSession(w, r)
}

func (s *Server) startSession(w http.ResponseWriter, r *http.Request) {
	token, exp, err := s.auth.NewSession(r.Context())
	if err != nil {
		s.internal(w, r, err)
		return
	}
	auth.SetCookie(w, r, token, exp)
	writeJSON(w, http.StatusOK, map[string]bool{"authenticated": true})
}

func (s *Server) authLogout(w http.ResponseWriter, r *http.Request) {
	if token := auth.TokenFromRequest(r); token != "" {
		_ = s.auth.Logout(r.Context(), token)
	}
	auth.ClearCookie(w, r)
	writeJSON(w, http.StatusOK, map[string]bool{"authenticated": false})
}

func (s *Server) changePassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Current string `json:"current"`
		Next    string `json:"next"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	switch err := s.auth.ChangePassword(r.Context(), body.Current, body.Next, auth.TokenFromRequest(r)); {
	case errors.Is(err, auth.ErrInvalidPassword):
		writeError(w, http.StatusBadRequest, "invalid_password", "current password is wrong")
	case errors.Is(err, auth.ErrWeakPassword):
		writeError(w, http.StatusBadRequest, "weak_password", "password is too short")
	case err != nil:
		s.internal(w, r, err)
	default:
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
	}
}
