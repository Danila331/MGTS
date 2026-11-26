package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"mgts/backend/internal/app"
	"mgts/backend/internal/platform/config"
	"mgts/backend/internal/platform/loggerx"
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
		logger.Fatal().Err(err).Msg("worker initialization failed")
	}
	defer application.Close()
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	logger.Info().Str("storage", cfg.Storage).Msg("worker started")
	for {
		processed, err := application.Service.ProcessNotifications(ctx)
		if err != nil && ctx.Err() == nil {
			logger.Error().Err(err).Msg("worker pass failed")
		} else if processed > 0 {
			logger.Info().Int("processed", processed).Msg("notifications processed")
		}
		select {
		case <-ctx.Done():
			logger.Info().Msg("worker stopped")
			return
		case <-ticker.C:
		}
	}
}
