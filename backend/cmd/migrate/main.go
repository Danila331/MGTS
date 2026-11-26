package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"mgts/backend/internal/platform/config"
	platformpg "mgts/backend/internal/platform/postgres"
	"mgts/backend/migrations"
)

func main() {
	down := flag.Bool("down", false, "roll back the latest migration")
	status := flag.Bool("status", false, "show migration status")
	flag.Parse()
	cfg, err := config.Load()
	if err != nil {
		fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	conn, err := pgx.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		fatal(err)
	}
	defer conn.Close(context.Background())
	runner := platformpg.NewMigrationRunner(conn, migrations.FS)
	if *status {
		items, err := runner.Status(ctx)
		if err != nil {
			fatal(err)
		}
		for _, item := range items {
			fmt.Println(item)
		}
		return
	}
	if *down {
		version, err := runner.Down(ctx)
		if err != nil {
			fatal(err)
		}
		fmt.Println("rolled back:", version)
		return
	}
	items, err := runner.Up(ctx)
	if err != nil {
		fatal(err)
	}
	fmt.Println("applied:", items)
}
func fatal(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }
