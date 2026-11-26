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
	"mgts/backend/internal/modules/core/usecase"
	"mgts/backend/internal/platform/config"
	"mgts/backend/internal/platform/huntflow"
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
	pulse := cfg.Pulse
	options := httptransport.ServerOptions{Tally: usecase.TallyConfig{
		Secret: pulse.TallySecret, InviteKey: pulse.InviteKey, InternID: pulse.TallyIntern, MentorID: pulse.TallyMentor,
	}}
	if pulse.Production {
		options.Auth = &httptransport.JWTAuth{PublicKey: pulse.AuthKey, Issuer: pulse.AuthIssuer, Audience: pulse.AuthAudience, Origin: pulse.Origin}
	}
	if pulse.HuntflowToken != "" {
		options.Candidate = huntflow.Client{Token: pulse.HuntflowToken, AccountID: pulse.HuntflowAccount, WebURL: pulse.HuntflowWebURL}
	}
	server := httptransport.NewServer(application.Service, logger, cfg.Version, cfg.Port, options)
	finished := make(chan struct{})
	wavesFinished := make(chan struct{})
	go func() {
		defer close(finished)
		runSurveyJobs(ctx, application)
	}()
	go func() {
		defer close(wavesFinished)
		runSurveyWaves(ctx, application)
	}()
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
	<-finished
	<-wavesFinished
}

func runSurveyJobs(ctx context.Context, application *app.App) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		if ctx.Err() != nil {
			return
		}
		worked, err := application.Service.ProcessSurveyAnalysis(ctx)
		if err != nil && ctx.Err() == nil {
			application.Logger.Warn().Err(err).Msg("survey analysis job")
		}
		if worked {
			continue
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func runSurveyWaves(ctx context.Context, application *app.App) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		if _, err := application.Service.ProcessSurveyWaves(ctx); err != nil && ctx.Err() == nil {
			application.Logger.Warn().Err(err).Msg("survey scheduling failed")
		}
		if _, err := application.Service.ProcessNotifications(ctx); err != nil && ctx.Err() == nil {
			application.Logger.Warn().Err(err).Msg("notification processing failed")
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
