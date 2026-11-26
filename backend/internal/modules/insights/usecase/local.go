package usecase

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"mgts/backend/internal/modules/core/domain"
)

const Model = "local-deterministic-v1"
const PromptVersion = "hr-evidence-v1"

func SummarizeFeedback(item domain.Feedback) map[string]any {
	themes := Themes(item.Text + " " + item.Strengths + " " + item.Growth)
	return map[string]any{"summary": fmt.Sprintf("Отзыв %s: %s", item.Author, firstSentence(item.Text)),
		"themes": themes, "sentiment": item.Sentiment, "model": Model,
		"evidence": []domain.Evidence{{ID: item.ID, Type: "feedback", SourceID: item.ID, Quote: item.Text, InternshipID: item.InternshipID}}}
}

func Analyze(kind, text string) map[string]any {
	words := strings.Fields(text)
	metrics := regexp.MustCompile(`[0-9]+(?:[.,][0-9]+)?%?`).FindAllString(text, -1)
	result := map[string]any{"result": map[string]any{"clarity": clarity(words), "specificity": specificity(text, metrics), "has_metrics": len(metrics) > 0, "word_count": len(words)},
		"suggestions": suggestions(text, metrics), "draft": improve(text),
		"evidence": []domain.Evidence{{ID: "input-text", Type: "text", SourceID: kind, Quote: firstSentence(text)}}, "model": Model, "prompt_version": PromptVersion}
	return result
}

func Edit(text, instruction string) string {
	trimmed := strings.Join(strings.Fields(text), " ")
	lower := strings.ToLower(instruction)
	switch {
	case strings.Contains(lower, "корот"), strings.Contains(lower, "short"):
		return firstSentence(trimmed)
	case strings.Contains(lower, "исправ"), strings.Contains(lower, "grammar"):
		return strings.ReplaceAll(strings.ReplaceAll(trimmed, "  ", " "), " ,", ",")
	case strings.Contains(lower, "улучш"), strings.Contains(lower, "improve"):
		return improve(trimmed)
	default:
		if trimmed == "" {
			return ""
		}
		return trimmed + "\n\nУточнение: " + strings.TrimSpace(instruction)
	}
}

func Themes(text string) []string {
	catalog := map[string][]string{
		"наставничество": {"настав", "ментор", "помог"}, "задачи": {"задач", "проект", "результат"},
		"коммуникация": {"коммуник", "встреч", "команда"}, "нагрузка": {"нагруз", "не успева", "переработ"},
		"обучение": {"обуч", "изуч", "навык"}, "инициатива": {"инициатив", "самостоятель", "предлож"},
	}
	found := []string{}
	lower := strings.ToLower(text)
	for theme, keywords := range catalog {
		for _, keyword := range keywords {
			if strings.Contains(lower, keyword) {
				found = append(found, theme)
				break
			}
		}
	}
	if len(found) == 0 {
		found = append(found, "общий опыт")
	}
	sort.Strings(found)
	return found
}

func Query(question string, metrics map[string]float64, evidence []domain.Evidence) map[string]any {
	answer := "По доступным данным: "
	if len(metrics) == 0 {
		answer += "недостаточно числовых ответов для вывода; отсутствие данных не означает отсутствие проблем."
	} else {
		keys := make([]string, 0, len(metrics))
		for key := range metrics {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		parts := []string{}
		for _, key := range keys {
			parts = append(parts, fmt.Sprintf("%s — %.2f", key, metrics[key]))
		}
		answer += strings.Join(parts, "; ") + "."
	}
	return map[string]any{"answer": answer, "evidence": evidence, "model": Model, "prompt_version": PromptVersion, "created_at": time.Now().UTC()}
}

func clarity(words []string) string {
	if len(words) < 8 {
		return "needs_detail"
	}
	if len(words) > 250 {
		return "too_long"
	}
	return "clear"
}
func specificity(text string, metrics []string) string {
	if len(metrics) > 0 {
		return "measurable"
	}
	if strings.Contains(strings.ToLower(text), "результат") {
		return "result_oriented"
	}
	return "general"
}
func suggestions(text string, metrics []string) []string {
	items := []string{}
	if len(strings.Fields(text)) < 20 {
		items = append(items, "Добавьте конкретную задачу, действие и полученный результат.")
	}
	if len(metrics) == 0 {
		items = append(items, "Добавьте измеримый показатель или наблюдаемый эффект.")
	}
	if len(items) == 0 {
		items = append(items, "Сохраните структуру: контекст → действие → результат → следующий шаг.")
	}
	return items
}
func improve(text string) string {
	trimmed := strings.Join(strings.Fields(text), " ")
	if trimmed == "" {
		return ""
	}
	return trimmed + "\n\nСледующий шаг: зафиксировать измеримый результат, срок и ответственного."
}
func firstSentence(text string) string {
	text = strings.Join(strings.Fields(text), " ")
	if text == "" {
		return "текст не заполнен"
	}
	if index := strings.IndexAny(text, ".!?"); index >= 0 {
		return text[:index+1]
	}
	if len(text) > 240 {
		return text[:240] + "…"
	}
	return text
}
