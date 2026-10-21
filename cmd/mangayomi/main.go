package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"mangayomi/internal/api"
	"mangayomi/internal/auth"
	"mangayomi/internal/config"
	"mangayomi/internal/deletion"
	"mangayomi/internal/media"
	"mangayomi/internal/scanner"
	"mangayomi/internal/store"
)

// version is set at build time from the VERSION file (see Makefile and Dockerfile).
var version = "dev"

func main() {
	cfg := config.Load()
	log := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: logLevel()}))

	cmd := "serve"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	var err error
	switch cmd {
	case "serve":
		err = serve(cfg, log)
	case "reset-password":
		err = resetPassword(cfg)
	case "healthcheck":
		err = healthcheck(cfg)
	case "version":
		fmt.Println(version)
	default:
		err = fmt.Errorf("unknown command %q (commands: serve, reset-password, healthcheck, version)", cmd)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func logLevel() slog.Level {
	if os.Getenv("MANGAYOMI_DEBUG") != "" {
		return slog.LevelDebug
	}
	return slog.LevelInfo
}

func serve(cfg config.Config, log *slog.Logger) error {
	for _, dir := range []string{cfg.ConfigDir, cfg.CoverDir(), cfg.DataDir} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create %s: %w", dir, err)
		}
	}
	st, err := store.Open(cfg.DBPath())
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer st.Close()

	m := media.New(cfg.CoverDir())
	defer m.Close()
	sc := scanner.New(st, m, log)
	a := auth.New(st)
	srv := api.New(cfg, st, a, m, sc, deletion.New(st, m, cfg.DataDir), log)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go sc.RunScheduler(ctx)
	sc.StartCoverWarmer(ctx)
	go func() {
		t := time.NewTicker(time.Hour)
		defer t.Stop()
		for {
			_ = st.PurgeExpiredSessions(ctx)
			select {
			case <-ctx.Done():
				return
			case <-t.C:
			}
		}
	}()

	httpSrv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           srv.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		IdleTimeout:       2 * time.Minute,
	}
	errc := make(chan error, 1)
	go func() {
		log.Info("mangayomi listening", "version", version, "addr", cfg.Addr, "config", cfg.ConfigDir, "data", cfg.DataDir)
		errc <- httpSrv.ListenAndServe()
	}()

	select {
	case err := <-errc:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
	}
	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutdownCtx)
	sc.CancelAll()
	sc.Wait()
	return nil
}

func resetPassword(cfg config.Config) error {
	st, err := store.Open(cfg.DBPath())
	if err != nil {
		return err
	}
	defer st.Close()
	if err := auth.New(st).Reset(context.Background()); err != nil {
		return err
	}
	fmt.Println("Password cleared. Open the web UI to set a new one.")
	return nil
}

func healthcheck(cfg config.Config) error {
	_, port, err := net.SplitHostPort(cfg.Addr)
	if err != nil {
		return err
	}
	client := http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/api/health")
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return nil
}
