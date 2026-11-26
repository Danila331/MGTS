package domain

import "time"

type SurveyFinding struct {
	Kind     string           `json:"kind"`
	Severity string           `json:"severity"`
	Title    string           `json:"title"`
	Wave     int              `json:"wave"`
	Evidence []SurveyEvidence `json:"evidence"`
}

type SurveyEvidence struct {
	ResponseID string `json:"response_id"`
	Role       Role   `json:"role"`
	Wave       int    `json:"wave"`
	Text       string `json:"text"`
}

type SurveySummary struct {
	Summary  string           `json:"summary"`
	NextStep string           `json:"next_step"`
	Evidence []SurveyEvidence `json:"evidence"`
}

type SurveyAnalysis struct {
	ReviewVersion string          `json:"review_version"`
	Findings      []SurveyFinding `json:"findings"`
	Status        string          `json:"status"`
	Model         string          `json:"model,omitempty"`
	AI            *SurveySummary  `json:"ai,omitempty"`
	FollowUp      *SurveyFollowUp `json:"follow_up,omitempty"`
}

type SurveyFollowUp struct {
	Status    string    `json:"status"`
	Note      string    `json:"note"`
	UpdatedBy string    `json:"updated_by"`
	UpdatedAt time.Time `json:"updated_at"`
}

type SurveyAnalysisJob struct {
	Fingerprint string         `json:"fingerprint"`
	Attempts    int            `json:"attempts"`
	NextRun     time.Time      `json:"next_run"`
	LeaseUntil  time.Time      `json:"lease_until"`
	Result      *SurveySummary `json:"result,omitempty"`
}
