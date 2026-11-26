package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Pulse       Pulse
	Port        int
	Storage     string
	DatabaseURL string
	Version     string
	LogLevel    string
}

func Load() (Config, error) {
	cfg := Config{Port: 8080, Storage: "memory", Version: "1.0.0", LogLevel: "info"}
	if raw := os.Getenv("PORT"); raw != "" {
		port, err := strconv.Atoi(raw)
		if err != nil || port < 1 || port > 65535 {
			return Config{}, fmt.Errorf("invalid PORT %q", raw)
		}
		cfg.Port = port
	}
	if raw := os.Getenv("STORAGE"); raw != "" {
		cfg.Storage = raw
	}
	if cfg.Storage != "memory" && cfg.Storage != "postgres" {
		return Config{}, fmt.Errorf("STORAGE must be memory or postgres")
	}
	cfg.DatabaseURL = os.Getenv("DATABASE_URL")
	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = "postgres://postgres:postgres@localhost:5432/mgts?sslmode=disable"
	}
	if raw := os.Getenv("VERSION"); raw != "" {
		cfg.Version = raw
	}
	if raw := os.Getenv("LOG_LEVEL"); raw != "" {
		cfg.LogLevel = raw
	}
	pulse, err := loadPulse(cfg.Storage)
	cfg.Pulse = pulse
	return cfg, err
}
