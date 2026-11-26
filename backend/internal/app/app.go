package app

import (
	"context"
	"fmt"

	"github.com/rs/zerolog"
	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/modules/core/ports"
	"mgts/backend/internal/modules/core/usecase"
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
			*state = *memory.Seed()
		}
		return nil
	}); err != nil {
		store.Close()
		return nil, fmt.Errorf("seed storage: %w", err)
	}
	return &App{Service: usecase.New(store), Store: store, Config: cfg, Logger: logger}, nil
}
func (a *App) Close() error { return a.Store.Close() }
