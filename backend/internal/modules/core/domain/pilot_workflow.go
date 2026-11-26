package domain

import "time"

type InternshipRecap struct {
	Progress      string     `json:"progress"`
	OpenQuestions string     `json:"open_questions"`
	NextSteps     string     `json:"next_steps"`
	SavedAt       *time.Time `json:"saved_at,omitempty"`
	Version       int        `json:"version"`
}

type HRContact struct {
	ID           string    `json:"id"`
	InternshipID string    `json:"internship_id"`
	SenderID     string    `json:"sender_id"`
	SenderName   string    `json:"sender_name"`
	SenderRole   Role      `json:"sender_role"`
	Message      string    `json:"message"`
	CreatedAt    time.Time `json:"created_at"`
}
