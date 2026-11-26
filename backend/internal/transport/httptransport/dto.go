package httptransport

import (
	"time"

	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/modules/core/usecase"
)

type questionDTO struct {
	ID        string   `json:"id"`
	Type      string   `json:"type"`
	Title     string   `json:"title"`
	Required  bool     `json:"required"`
	Dimension string   `json:"dimension"`
	Min       int      `json:"min"`
	Max       int      `json:"max"`
	Version   int      `json:"version"`
	Options   []string `json:"options"`
}
type surveyDTO struct {
	Title       string        `json:"title"`
	Description string        `json:"description"`
	Audience    domain.Role   `json:"audience"`
	Period      string        `json:"period"`
	DueAt       time.Time     `json:"due_at"`
	Wave        int           `json:"wave"`
	Questions   []questionDTO `json:"questions"`
}
type surveyPatchDTO struct {
	Title       *string        `json:"title"`
	Description *string        `json:"description"`
	Audience    *domain.Role   `json:"audience"`
	Period      *string        `json:"period"`
	DueAt       *time.Time     `json:"due_at"`
	Wave        *int           `json:"wave"`
	Questions   *[]questionDTO `json:"questions"`
}
type assignDTO struct {
	InternshipIDs []string  `json:"internship_ids"`
	RespondentIDs []string  `json:"respondent_ids"`
	DueAt         time.Time `json:"due_at"`
}
type answersDTO struct {
	Answers map[string]any `json:"answers"`
}
type internshipPatchDTO struct {
	Stage    *string    `json:"stage"`
	Progress *int       `json:"progress"`
	Settings domain.Map `json:"settings"`
}
type feedbackDTO struct {
	InternshipID string `json:"internship_id"`
	RecipientID  string `json:"recipient_id"`
	Relation     string `json:"relation"`
	Frequency    string `json:"frequency"`
	Sentiment    string `json:"sentiment"`
	Strengths    string `json:"strengths"`
	Growth       string `json:"growth"`
	Text         string `json:"text"`
	Status       string `json:"status"`
}
type feedbackPatchDTO struct {
	Relation  *string `json:"relation"`
	Frequency *string `json:"frequency"`
	Sentiment *string `json:"sentiment"`
	Strengths *string `json:"strengths"`
	Growth    *string `json:"growth"`
	Text      *string `json:"text"`
}
type feedbackRequestDTO struct {
	InternshipID string `json:"internship_id"`
	RecipientID  string `json:"recipient_id"`
	Message      string `json:"message"`
}
type signalPatchDTO struct {
	Status  *string    `json:"status"`
	Urgency *string    `json:"urgency"`
	OwnerID *string    `json:"owner_id"`
	DueAt   *time.Time `json:"due_at"`
}
type actionDTO struct {
	Title   string    `json:"title"`
	OwnerID string    `json:"owner_id"`
	DueAt   time.Time `json:"due_at"`
}
type actionPatchDTO struct {
	Status  *string `json:"status"`
	Result  *string `json:"result"`
	Comment *string `json:"comment"`
}
type reviewDTO struct {
	InternshipID     string  `json:"internship_id"`
	Kind             string  `json:"kind"`
	Text             string  `json:"text"`
	ManagerReasoning string  `json:"manager_reasoning"`
	RecommendedLevel string  `json:"recommended_level"`
	Score            float64 `json:"score"`
}
type reviewPatchDTO struct {
	Text             *string  `json:"text"`
	ManagerReasoning *string  `json:"manager_reasoning"`
	RecommendedLevel *string  `json:"recommended_level"`
	Score            *float64 `json:"score"`
	Status           *string  `json:"status"`
}
type calibrateDTO struct {
	Level string   `json:"level"`
	Score *float64 `json:"score"`
}
type diagnosticDTO struct {
	InternshipID string `json:"internship_id"`
	Kind         int    `json:"kind"`
}
type diagnosticCompleteDTO struct {
	Completed map[domain.Role]int `json:"completed"`
	Results   domain.Map          `json:"results"`
}
type goalDTO struct {
	InternshipID string    `json:"internship_id"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	OwnerID      string    `json:"owner_id"`
	DueAt        time.Time `json:"due_at"`
}
type goalPatchDTO struct {
	Title       *string    `json:"title"`
	Description *string    `json:"description"`
	Status      *string    `json:"status"`
	Result      *string    `json:"result"`
	Progress    *int       `json:"progress"`
	DueAt       *time.Time `json:"due_at"`
}
type aiQueryDTO struct {
	Question     string `json:"question"`
	InternshipID string `json:"internship_id"`
}
type aiAnalyzeDTO struct {
	Kind      string `json:"kind"`
	Text      string `json:"text"`
	ContextID string `json:"context_id"`
}
type aiEditDTO struct {
	Text        string `json:"text"`
	Instruction string `json:"instruction"`
}
type externalResponseDTO struct {
	ExternalID   string         `json:"external_id"`
	SurveyID     string         `json:"survey_id"`
	InternshipID string         `json:"internship_id"`
	RespondentID string         `json:"respondent_id"`
	Version      int            `json:"version"`
	Answers      map[string]any `json:"answers"`
}
type settingsPatchDTO struct {
	ShowFeedbackToIntern *bool              `json:"show_feedback_to_intern"`
	SignalThresholds     map[string]float64 `json:"signal_thresholds"`
	ScaleMin             *int               `json:"scale_min"`
	ScaleMax             *int               `json:"scale_max"`
}

func questionsFromDTO(items []questionDTO) []domain.Question {
	result := make([]domain.Question, 0, len(items))
	for _, item := range items {
		result = append(result, domain.Question{ID: item.ID, Type: item.Type, Title: item.Title, Required: item.Required, Dimension: item.Dimension, Min: item.Min, Max: item.Max, Version: item.Version, Options: item.Options})
	}
	return result
}
func (d surveyDTO) input() usecase.SurveyInput {
	return usecase.SurveyInput{Title: d.Title, Description: d.Description, Audience: d.Audience, Period: d.Period, DueAt: d.DueAt, Wave: d.Wave, Questions: questionsFromDTO(d.Questions)}
}
func (d feedbackDTO) input() usecase.FeedbackInput {
	return usecase.FeedbackInput{InternshipID: d.InternshipID, RecipientID: d.RecipientID, Relation: d.Relation, Frequency: d.Frequency, Sentiment: d.Sentiment, Strengths: d.Strengths, Growth: d.Growth, Text: d.Text, Status: d.Status}
}
func (d reviewDTO) input() usecase.ReviewInput {
	return usecase.ReviewInput{InternshipID: d.InternshipID, Kind: d.Kind, Text: d.Text, ManagerReasoning: d.ManagerReasoning, RecommendedLevel: d.RecommendedLevel, Score: d.Score}
}
func (d goalDTO) input() usecase.GoalInput {
	return usecase.GoalInput{InternshipID: d.InternshipID, Title: d.Title, Description: d.Description, OwnerID: d.OwnerID, DueAt: d.DueAt}
}
