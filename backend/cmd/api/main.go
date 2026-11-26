package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"mgts/backend/internal/app"
	"mgts/backend/internal/platform/config"
	"mgts/backend/internal/platform/loggerx"
	"mgts/backend/internal/transport/httptransport"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}
	logger, err := loggerx.New(cfg.LogLevel)
	if err != nil {
		panic(err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	application, err := app.New(ctx, cfg, logger)
	if err != nil {
		logger.Fatal().Err(err).Msg("api initialization failed")
	}
	defer application.Close()
	server := httptransport.NewServer(application.Service, logger, cfg.Version, cfg.Port)
	go func() {
		logger.Info().Int("port", cfg.Port).Str("storage", cfg.Storage).Msg("api started")
		if err := server.Start(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Fatal().Err(err).Msg("api failed")
		}
	}()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error().Err(err).Msg("api shutdown failed")
	}
}
