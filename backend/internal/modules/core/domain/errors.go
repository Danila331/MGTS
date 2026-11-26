package domain

import "errors"

var (
	ErrNotFound      = errors.New("not found")
	ErrForbidden     = errors.New("forbidden")
	ErrConflict      = errors.New("conflict")
	ErrValidation    = errors.New("validation failed")
	ErrUnauthorized  = errors.New("unauthorized")
	ErrUnavailable   = errors.New("integration unavailable")
	ErrAlreadyExists = errors.New("already exists")
)
