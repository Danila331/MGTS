package loggerx

import (
	"os"
	"time"

	"github.com/rs/zerolog"
)

func New(level string) (zerolog.Logger, error) {
	parsed, err := zerolog.ParseLevel(level)
	if err != nil {
		return zerolog.Logger{}, err
	}
	zerolog.TimeFieldFormat = time.RFC3339Nano
	return zerolog.New(os.Stdout).Level(parsed).With().Timestamp().Logger(), nil
}
