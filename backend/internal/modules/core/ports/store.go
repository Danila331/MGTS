package ports

import (
	"context"

	"mgts/backend/internal/modules/core/domain"
)

// Store is the unit-of-work port shared by both storage adapters. Update is atomic:
// a failed callback never commits, and concurrent writers are serialized.
type Store interface {
	Snapshot(context.Context) (*domain.State, error)
	Update(context.Context, func(*domain.State) error) error
	Ping(context.Context) error
	Close() error
	Name() string
}
