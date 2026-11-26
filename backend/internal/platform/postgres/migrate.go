package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
)

const migrationLockID int64 = 472901733

type MigrationRunner struct {
	conn  *pgx.Conn
	files fs.FS
}
type migration struct{ version, up, down string }

func NewMigrationRunner(conn *pgx.Conn, files fs.FS) *MigrationRunner {
	return &MigrationRunner{conn: conn, files: files}
}

func (r *MigrationRunner) list() ([]migration, error) {
	ups, err := fs.Glob(r.files, "*.up.sql")
	if err != nil {
		return nil, err
	}
	sort.Strings(ups)
	items := make([]migration, 0, len(ups))
	for _, up := range ups {
		base := strings.TrimSuffix(up, ".up.sql")
		version, _, _ := strings.Cut(base, "_")
		items = append(items, migration{version: version, up: up, down: base + ".down.sql"})
	}
	return items, nil
}
func (r *MigrationRunner) ensure(ctx context.Context) error {
	_, err := r.conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`)
	return err
}
func (r *MigrationRunner) lock(ctx context.Context, fn func() error) (err error) {
	if _, err = r.conn.Exec(ctx, "SELECT pg_advisory_lock($1)", migrationLockID); err != nil {
		return err
	}
	defer func() {
		_, _ = r.conn.Exec(context.WithoutCancel(ctx), "SELECT pg_advisory_unlock($1)", migrationLockID)
	}()
	return fn()
}
func (r *MigrationRunner) applied(ctx context.Context) (map[string]string, error) {
	rows, err := r.conn.Query(ctx, "SELECT version,checksum FROM schema_migrations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[string]string{}
	for rows.Next() {
		var version, checksum string
		if err := rows.Scan(&version, &checksum); err != nil {
			return nil, err
		}
		result[version] = checksum
	}
	return result, rows.Err()
}
func (r *MigrationRunner) Up(ctx context.Context) (applied []string, err error) {
	err = r.lock(ctx, func() error {
		if err := r.ensure(ctx); err != nil {
			return err
		}
		items, err := r.list()
		if err != nil {
			return err
		}
		done, err := r.applied(ctx)
		if err != nil {
			return err
		}
		for _, item := range items {
			data, err := fs.ReadFile(r.files, item.up)
			if err != nil {
				return err
			}
			sumBytes := sha256.Sum256(data)
			sum := hex.EncodeToString(sumBytes[:])
			if previous, ok := done[item.version]; ok {
				if previous != sum {
					return fmt.Errorf("migration %s checksum mismatch", item.version)
				}
				continue
			}
			if err := r.apply(ctx, item.version, string(data), sum, true); err != nil {
				return fmt.Errorf("apply %s: %w", item.up, err)
			}
			applied = append(applied, item.version)
		}
		return nil
	})
	return applied, err
}
func (r *MigrationRunner) Down(ctx context.Context) (version string, err error) {
	err = r.lock(ctx, func() error {
		if err := r.ensure(ctx); err != nil {
			return err
		}
		items, err := r.list()
		if err != nil {
			return err
		}
		done, err := r.applied(ctx)
		if err != nil {
			return err
		}
		for i := len(items) - 1; i >= 0; i-- {
			item := items[i]
			if _, ok := done[item.version]; !ok {
				continue
			}
			data, err := fs.ReadFile(r.files, item.down)
			if err != nil {
				return err
			}
			if err := r.apply(ctx, item.version, string(data), "", false); err != nil {
				return err
			}
			version = item.version
			return nil
		}
		return nil
	})
	return version, err
}
func (r *MigrationRunner) Status(ctx context.Context) ([]string, error) {
	if err := r.ensure(ctx); err != nil {
		return nil, err
	}
	items, err := r.list()
	if err != nil {
		return nil, err
	}
	done, err := r.applied(ctx)
	if err != nil {
		return nil, err
	}
	result := []string{}
	for _, item := range items {
		status := "pending"
		if _, ok := done[item.version]; ok {
			status = "applied"
		}
		result = append(result, item.version+" "+status)
	}
	return result, nil
}
func (r *MigrationRunner) apply(ctx context.Context, version, sqlText, checksum string, up bool) (err error) {
	tx, err := r.conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(context.WithoutCancel(ctx))
		}
	}()
	if _, err = tx.Exec(ctx, sqlText); err != nil {
		return err
	}
	if up {
		_, err = tx.Exec(ctx, "INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)", version, checksum)
	} else {
		_, err = tx.Exec(ctx, "DELETE FROM schema_migrations WHERE version=$1", version)
	}
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}
