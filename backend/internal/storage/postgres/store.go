package postgres

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"mgts/backend/internal/modules/core/domain"
)

//go:embed sql/*.sql
var sqlFiles embed.FS

var (
	getState  = mustSQL("sql/get_state.sql")
	lockState = mustSQL("sql/lock_state.sql")
	saveState = mustSQL("sql/save_state.sql")
)

type Store struct{ pool *pgxpool.Pool }

func New(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("postgres pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("postgres ping: %w", err)
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Snapshot(ctx context.Context) (*domain.State, error) {
	var raw []byte
	err := s.pool.QueryRow(ctx, getState).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.NewState(), nil
	}
	if err != nil {
		return nil, err
	}
	return decodeState(raw)
}

// Update uses SELECT FOR UPDATE and a transaction, providing an atomic unit of work
// across the whole aggregate. The JSONB representation keeps both adapters behaviorally identical.
func (s *Store) Update(ctx context.Context, fn func(*domain.State) error) (err error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(context.WithoutCancel(ctx))
		}
	}()
	var raw []byte
	err = tx.QueryRow(ctx, lockState).Scan(&raw)
	var state *domain.State
	if errors.Is(err, pgx.ErrNoRows) {
		state = domain.NewState()
		err = nil
	} else if err != nil {
		return err
	} else {
		state, err = decodeState(raw)
		if err != nil {
			return err
		}
	}
	if err = fn(state); err != nil {
		return err
	}
	state.Normalize()
	raw, err = json.Marshal(state)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, saveState, raw, state.Revision); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }
func (s *Store) Close() error                   { s.pool.Close(); return nil }
func (s *Store) Name() string                   { return "postgres" }

func decodeState(raw []byte) (*domain.State, error) {
	var state domain.State
	if err := json.Unmarshal(raw, &state); err != nil {
		return nil, err
	}
	state.Normalize()
	return &state, nil
}
func mustSQL(name string) string {
	data, err := sqlFiles.ReadFile(name)
	if err != nil {
		panic(err)
	}
	return string(data)
}
