// Package auth implements single-user password login with cookie sessions.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"

	"mangayomi/internal/store"
)

const (
	CookieName     = "mangayomi_session"
	sessionTTL     = 30 * 24 * time.Hour
	passwordKey    = "password_hash"
	MinPasswordLen = 6
)

var (
	ErrInvalidPassword = errors.New("invalid password")
	ErrAlreadySetUp    = errors.New("already set up")
	ErrWeakPassword    = errors.New("password too short")
	ErrTooManyAttempts = errors.New("too many attempts")
)

type Auth struct {
	store *store.Store

	mu    sync.Mutex
	fails map[string]*failure
}

type failure struct {
	count int
	since time.Time
}

func New(st *store.Store) *Auth {
	return &Auth{store: st, fails: map[string]*failure{}}
}

func (a *Auth) SetupRequired(ctx context.Context) (bool, error) {
	_, ok, err := a.store.GetSetting(ctx, passwordKey)
	return !ok, err
}

func (a *Auth) Setup(ctx context.Context, password string) error {
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	ok, err := a.store.SetSettingIfAbsent(ctx, passwordKey, hash)
	if err != nil {
		return err
	}
	if !ok {
		return ErrAlreadySetUp
	}
	return nil
}

// Login checks the password, rate limited per client address.
func (a *Auth) Login(ctx context.Context, password, client string) error {
	if a.limited(client) {
		return ErrTooManyAttempts
	}
	if err := a.check(ctx, password); err != nil {
		a.fail(client)
		time.Sleep(400 * time.Millisecond)
		return err
	}
	a.mu.Lock()
	delete(a.fails, client)
	a.mu.Unlock()
	return nil
}

func (a *Auth) check(ctx context.Context, password string) error {
	hash, ok, err := a.store.GetSetting(ctx, passwordKey)
	if err != nil {
		return err
	}
	if !ok || bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return ErrInvalidPassword
	}
	return nil
}

// ChangePassword verifies the current password and signs out other sessions.
func (a *Auth) ChangePassword(ctx context.Context, current, next, keepToken string) error {
	if err := a.check(ctx, current); err != nil {
		return err
	}
	hash, err := hashPassword(next)
	if err != nil {
		return err
	}
	if err := a.store.SetSetting(ctx, passwordKey, hash); err != nil {
		return err
	}
	return a.store.DeleteOtherSessions(ctx, hashToken(keepToken))
}

// Reset clears the password and all sessions so the setup screen shows again.
func (a *Auth) Reset(ctx context.Context) error {
	if err := a.store.DeleteSetting(ctx, passwordKey); err != nil {
		return err
	}
	return a.store.DeleteOtherSessions(ctx, "")
}

func (a *Auth) NewSession(ctx context.Context) (string, time.Time, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", time.Time{}, err
	}
	token := hex.EncodeToString(b)
	exp := time.Now().Add(sessionTTL)
	if err := a.store.CreateSession(ctx, hashToken(token), exp.UnixMilli()); err != nil {
		return "", time.Time{}, err
	}
	return token, exp, nil
}

// Validate checks a session token and slides its expiry forward when it is
// past the halfway point. It returns the new expiry when it was extended.
func (a *Auth) Validate(ctx context.Context, token string) (bool, time.Time) {
	if token == "" {
		return false, time.Time{}
	}
	h := hashToken(token)
	exp, err := a.store.SessionExpiry(ctx, h)
	if err != nil {
		return false, time.Time{}
	}
	if time.Until(time.UnixMilli(exp)) < sessionTTL/2 {
		next := time.Now().Add(sessionTTL)
		if a.store.ExtendSession(ctx, h, next.UnixMilli()) == nil {
			return true, next
		}
	}
	return true, time.Time{}
}

func (a *Auth) Logout(ctx context.Context, token string) error {
	return a.store.DeleteSession(ctx, hashToken(token))
}

func (a *Auth) limited(client string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	f, ok := a.fails[client]
	if !ok {
		return false
	}
	if time.Since(f.since) > 15*time.Minute {
		delete(a.fails, client)
		return false
	}
	return f.count >= 10
}

func (a *Auth) fail(client string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	f, ok := a.fails[client]
	if !ok || time.Since(f.since) > 15*time.Minute {
		f = &failure{since: time.Now()}
		a.fails[client] = f
	}
	f.count++
}

func hashPassword(pw string) (string, error) {
	if len([]rune(pw)) < MinPasswordLen {
		return "", ErrWeakPassword
	}
	b, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	return string(b), err
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// ---- HTTP helpers ----

func TokenFromRequest(r *http.Request) string {
	c, err := r.Cookie(CookieName)
	if err != nil {
		return ""
	}
	return c.Value
}

func SetCookie(w http.ResponseWriter, r *http.Request, token string, exp time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    token,
		Path:     "/",
		Expires:  exp,
		HttpOnly: true,
		Secure:   isHTTPS(r),
		SameSite: http.SameSiteLaxMode,
	})
}

func ClearCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     CookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   isHTTPS(r),
		SameSite: http.SameSiteLaxMode,
	})
}

func isHTTPS(r *http.Request) bool {
	return r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

// ClientKey identifies a client for rate limiting.
func ClientKey(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
