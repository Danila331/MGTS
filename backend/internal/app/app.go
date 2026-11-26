package app

import (
	"context"
	"fmt"

	"github.com/rs/zerolog"
	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/modules/core/ports"
	"mgts/backend/internal/modules/core/usecase"
	insights "mgts/backend/internal/modules/insights/usecase"
	"mgts/backend/internal/platform/config"
	"mgts/backend/internal/storage/memory"
	pgstore "mgts/backend/internal/storage/postgres"
)

type App struct {
	Service *usecase.Service
	Store   ports.Store
	Config  config.Config
	Logger  zerolog.Logger
}

func New(ctx context.Context, cfg config.Config, logger zerolog.Logger) (*App, error) {
	var store ports.Store
	switch cfg.Storage {
	case "memory":
		store = memory.New(nil)
	case "postgres":
		postgresStore, err := pgstore.New(ctx, cfg.DatabaseURL)
		if err != nil {
			return nil, err
		}
		store = postgresStore
	default:
		return nil, fmt.Errorf("unsupported storage %q", cfg.Storage)
	}
	if err := store.Update(ctx, func(state *domain.State) error {
		if len(state.Actors) == 0 {
			initial, err := initialState(cfg.Pulse.Production, cfg.Pulse.Bootstrap)
			if err != nil {
				return err
			}
			*state = *initial
		}
		if cfg.Pulse.Production {
			for _, actorID := range state.IdentitySubjects {
				if state.Actors[actorID].Role == domain.RoleHR {
					return nil
				}
			}
			return fmt.Errorf("production database has no provisioned HR identity")
		}
		return nil
	}); err != nil {
		store.Close()
		return nil, fmt.Errorf("seed storage: %w", err)
	}
	service := usecase.New(store)
	if cfg.Pulse.AIEndpoint != "" {
		service.SetSurveyAnalyzer(insights.PulseProvider{Endpoint: cfg.Pulse.AIEndpoint, Model: cfg.Pulse.AIModel, Token: cfg.Pulse.AIToken})
	}
	return &App{Service: service, Store: store, Config: cfg, Logger: logger}, nil
}
func (a *App) Close() error { return a.Store.Close() }
