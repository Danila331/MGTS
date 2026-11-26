package usecase

import (
	"fmt"
	"testing"
	"time"

	"mgts/backend/internal/modules/core/domain"
)

func TestHelpIntentPhrases(t *testing.T) {
	tests := []struct {
		text string
		want bool
	}{
		{"Наставник помогает разбираться в архитектуре, задачи понятны.", false},
		{"Помогает ли наставник на встречах?", false},
		{"Помощь не нужна, всё понятно.", false},
		{"Срочно закончить задачу к пятнице.", false},
		{"Не успеваю, нужна помощь с задачами.", true},
		{"Нужна поддержка с доступами.", true},
		{"Помогите разобраться с окружением.", true},
		{"Прошу помощи с настройкой.", true},
		{"Прошу связаться после встречи.", true},
		{"Нужен совет по архитектуре.", true},
	}
	for _, test := range tests {
		t.Run(test.text, func(t *testing.T) {
			if got := hasHelpIntent(test.text); got != test.want {
				t.Fatalf("hasHelpIntent(%q)=%v want %v", test.text, got, test.want)
			}
		})
	}
}

func TestPositiveFeedbackDoesNotCreateHelpSignal(t *testing.T) {
	state, _ := textSignalFixture()
	response := textResponse("response-positive", "Наставник помогает разбираться в архитектуре, задачи понятны.", 1)
	Recalculate(state, response)
	if _, exists := state.Signals["auto-help-internship-01"]; exists {
		t.Fatal("positive feedback created a help signal")
	}
}

func TestHelpSignalDeduplicatesQuotesAndRecalculatesStrength(t *testing.T) {
	state, _ := textSignalFixture()
	const requestText = "Не успеваю, нужна помощь с задачами"
	Recalculate(state, textResponse("response-help-1", requestText, 1))
	signalID := "auto-help-internship-01"
	signal, exists := state.Signals[signalID]
	if !exists {
		t.Fatal("explicit help request did not create a signal")
	}
	if len(signal.Evidence) != 1 || signal.EvidenceStrength != "moderate" {
		t.Fatalf("unexpected initial evidence: %v strength=%s", signal.Evidence, signal.EvidenceStrength)
	}
	for wave := 2; wave <= 4; wave++ {
		Recalculate(state, textResponse(fmt.Sprintf("response-help-%d", wave), requestText, wave))
	}
	signal = state.Signals[signalID]
	if len(signal.Evidence) != 1 {
		t.Fatalf("identical quotes became independent evidence: %v", signal.Evidence)
	}
	if signal.EvidenceStrength != "moderate" {
		t.Fatalf("duplicate quotes inflated strength: %s", signal.EvidenceStrength)
	}
	Recalculate(state, textResponse("response-help-unique", "Помогите согласовать приоритеты с руководителем.", 4))
	signal = state.Signals[signalID]
	if len(signal.Evidence) != 2 || signal.EvidenceStrength != "strong" {
		t.Fatalf("unique evidence was not counted correctly: %v strength=%s", signal.Evidence, signal.EvidenceStrength)
	}
}

func textSignalFixture() (*domain.State, domain.Survey) {
	state := domain.NewState()
	survey := domain.Survey{ID: "survey-text", Status: "published", Wave: 1, Questions: []domain.Question{{ID: "q-comment", Type: "text", Dimension: "experience"}}}
	state.Surveys[survey.ID] = survey
	return state, survey
}

func textResponse(id, text string, wave int) domain.Response {
	return domain.Response{ID: id, SurveyID: "survey-text", AssignmentID: "assignment-text", InternshipID: "internship-01",
		RespondentID: "actor-intern-01", Role: domain.RoleIntern, Wave: wave, Status: "submitted", Version: 1,
		Answers: map[string]any{"q-comment": text}, CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC()}
}
