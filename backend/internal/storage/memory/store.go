package memory

import (
	"context"
	"encoding/json"
	"sync"

	"mgts/backend/internal/modules/core/domain"
)

type Store struct {
	mu    sync.RWMutex
	state *domain.State
}

func New(initial *domain.State) *Store {
	if initial == nil {
		initial = domain.NewState()
	}
	initial.Normalize()
	return &Store{state: initial}
}

func (s *Store) Snapshot(ctx context.Context) (*domain.State, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return clone(s.state)
}

func (s *Store) Update(ctx context.Context, fn func(*domain.State) error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	next, err := clone(s.state)
	if err != nil {
		return err
	}
	if err := fn(next); err != nil {
		return err
	}
	next.Normalize()
	s.state = next
	return ctx.Err()
}

func (s *Store) Ping(ctx context.Context) error { return ctx.Err() }
func (s *Store) Close() error                   { return nil }
func (s *Store) Name() string                   { return "memory" }

func clone(state *domain.State) (*domain.State, error) {
	data, err := json.Marshal(state)
	if err != nil {
		return nil, err
	}
	var result domain.State
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	result.Normalize()
	return &result, nil
}
