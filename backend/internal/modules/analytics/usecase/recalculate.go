package usecase

import (
	"fmt"
	"sort"
	"strings"

	"mgts/backend/internal/modules/core/domain"
)

// Recalculate replaces metric points produced by a response and refreshes rule-based
// signals. It never closes a signal: resolution and dismissal are human decisions.
func Recalculate(state *domain.State, response domain.Response) {
	for id, point := range state.Metrics {
		if point.ResponseID == response.ID {
			delete(state.Metrics, id)
		}
	}
	survey := state.Surveys[response.SurveyID]
	for _, question := range survey.Questions {
		raw, ok := response.Answers[question.ID]
		if !ok || question.Type != "scale" || question.Dimension == "" {
			continue
		}
		value, ok := number(raw)
		if !ok {
			continue
		}
		id := state.NextID("metric")
		state.Metrics[id] = domain.MetricPoint{ID: id, ResponseID: response.ID, InternshipID: response.InternshipID,
			SurveyID: response.SurveyID, QuestionID: question.ID, QuestionVersion: domain.QuestionVersion(question),
			ScaleMin: question.Min, ScaleMax: question.Max, ScaleSignature: domain.QuestionScaleSignature(question),
			Dimension: question.Dimension, Value: value, Role: response.Role, Wave: response.Wave, CreatedAt: response.UpdatedAt}
		refreshSignal(state, response.InternshipID, question.Dimension)
	}
	refreshTextSignal(state, response, survey)
}

func number(raw any) (float64, bool) {
	switch value := raw.(type) {
	case float64:
		return value, true
	case float32:
		return float64(value), true
	case int:
		return float64(value), true
	case int64:
		return float64(value), true
	case jsonNumber:
		valueFloat, err := value.Float64()
		return valueFloat, err == nil
	default:
		return 0, false
	}
}

type jsonNumber interface{ Float64() (float64, error) }

func refreshSignal(state *domain.State, internshipID, dimension string) {
	points := []domain.MetricPoint{}
	for _, point := range state.Metrics {
		if point.InternshipID == internshipID && point.Dimension == dimension {
			points = append(points, point)
		}
	}
	if len(points) == 0 {
		return
	}
	sort.Slice(points, func(i, j int) bool { return points[i].CreatedAt.Before(points[j].CreatedAt) })
	latest := points[len(points)-1]
	lowThreshold := state.Settings.SignalThresholds["low"]
	positiveThreshold := state.Settings.SignalThresholds["positive"]
	if lowThreshold == 0 {
		lowThreshold = 2.5
	}
	if positiveThreshold == 0 {
		positiveThreshold = 4.5
	}
	kind := ""
	if latest.Value <= lowThreshold {
		kind = "low"
	} else if latest.Value >= positiveThreshold {
		kind = "positive"
	}
	if kind == "" {
		return
	}
	id := "auto-" + internshipID + "-" + dimension + "-" + kind
	title := "Низкая оценка: " + dimension
	urgency := "high"
	if kind == "positive" {
		title = "Сильная практика: " + dimension
		urgency = "low"
	}
	evidence := domain.Evidence{ID: latest.ResponseID, Type: "metric", SourceID: latest.ResponseID,
		Value: latest.Value, Quote: fmt.Sprintf("Оценка %.1f по шкале %d–%d", latest.Value, latest.ScaleMin, latest.ScaleMax), InternshipID: internshipID}
	now := domain.Now()
	if existing, ok := state.Signals[id]; ok {
		existing.Evidence = []domain.Evidence{evidence}
		existing.Summary = fmt.Sprintf("Последняя оценка %.1f; волна %d. Требуется проверка человеком.", latest.Value, latest.Wave)
		existing.UpdatedAt = now
		// Existing Status, including resolved/dismissed, is deliberately preserved.
		state.Signals[id] = existing
		return
	}
	state.Signals[id] = domain.Signal{ID: id, Title: title, Scope: "internship", InternshipID: internshipID,
		Dimension: dimension, Urgency: urgency, EvidenceStrength: "strong", Status: "new",
		Summary: fmt.Sprintf("Правило сработало на оценке %.1f в волне %d.", latest.Value, latest.Wave),
		Rule:    kind + "_scale_threshold", Evidence: []domain.Evidence{evidence}, CreatedAt: now, UpdatedAt: now,
		History: []domain.History{{At: now, ActorID: "system", Event: "created"}}}
}

func refreshTextSignal(state *domain.State, response domain.Response, survey domain.Survey) {
	for _, question := range survey.Questions {
		if question.Type != "text" {
			continue
		}
		text, _ := response.Answers[question.ID].(string)
		if !hasHelpIntent(text) {
			continue
		}
		id := "auto-help-" + response.InternshipID
		now := domain.Now()
		evidence := domain.Evidence{ID: response.ID, Type: "quote", SourceID: response.ID, Quote: text, InternshipID: response.InternshipID}
		if existing, ok := state.Signals[id]; ok {
			existing.Evidence = appendEvidence(existing.Evidence, evidence)
			existing.EvidenceStrength = evidenceStrength(existing.Evidence)
			existing.UpdatedAt = now
			state.Signals[id] = existing
			continue
		}
		state.Signals[id] = domain.Signal{ID: id, Title: "Явная просьба о помощи", Scope: "internship",
			InternshipID: response.InternshipID, Dimension: question.Dimension, Urgency: "critical",
			EvidenceStrength: "moderate", Status: "new", Summary: "В тексте ответа обнаружена просьба о помощи.",
			Rule: "help_keywords", Evidence: []domain.Evidence{evidence}, CreatedAt: now, UpdatedAt: now,
			History: []domain.History{{At: now, ActorID: "system", Event: "created"}}}
	}
}

func hasHelpIntent(text string) bool {
	normalized := strings.ToLower(strings.Join(strings.Fields(text), " "))
	// Remove explicit negations before looking for intent phrases.
	normalized = strings.ReplaceAll(normalized, "не нужна помощь", "")
	normalized = strings.ReplaceAll(normalized, "помощь не нужна", "")
	phrases := []string{
		"нужна помощь", "нужна поддержка", "нужна ваша помощь", "нужна твоя помощь",
		"помогите", "прошу помощи", "прошу о помощи", "прошу помочь", "прошу связаться",
		"нужен совет", "нужна консультация", "можете помочь", "можешь помочь",
		"свяжитесь со мной", "можете связаться",
	}
	for _, phrase := range phrases {
		if strings.Contains(normalized, phrase) {
			return true
		}
	}
	return false
}

func appendEvidence(items []domain.Evidence, item domain.Evidence) []domain.Evidence {
	result := dedupeEvidence(items)
	for _, existing := range result {
		if existing.SourceID == item.SourceID || sameEvidence(existing, item) {
			return result
		}
	}
	return append(result, item)
}

func dedupeEvidence(items []domain.Evidence) []domain.Evidence {
	result := make([]domain.Evidence, 0, len(items))
	for _, item := range items {
		duplicate := false
		for _, existing := range result {
			if existing.SourceID == item.SourceID || sameEvidence(existing, item) {
				duplicate = true
				break
			}
		}
		if !duplicate {
			result = append(result, item)
		}
	}
	return result
}

func sameEvidence(left, right domain.Evidence) bool {
	normalize := func(value string) string { return strings.Join(strings.Fields(value), " ") }
	return left.Type == right.Type && normalize(left.Quote) == normalize(right.Quote)
}

func evidenceStrength(items []domain.Evidence) string {
	if len(dedupeEvidence(items)) >= 2 {
		return "strong"
	}
	return "moderate"
}
