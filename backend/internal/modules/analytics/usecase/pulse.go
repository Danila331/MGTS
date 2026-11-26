package usecase

import (
	"fmt"
	"slices"
	"strings"

	"mgts/backend/internal/modules/core/domain"
)

type PulseAnswer struct {
	ID       string             `json:"id"`
	Role     domain.Role        `json:"role"`
	Wave     int                `json:"wave"`
	Scores   map[string]float64 `json:"scores,omitempty"`
	Comments []string           `json:"comments,omitempty"`
}

type PulseHistory struct {
	Answers  []PulseAnswer          `json:"answers"`
	Findings []domain.SurveyFinding `json:"findings"`
}

type pulsePeriod struct {
	Wave int
	Role domain.Role
}

func PulseHistories(state *domain.State, isPulse func(domain.Survey) bool) map[string]PulseHistory {
	active := map[string]map[pulsePeriod]domain.Response{}
	for _, response := range state.Responses {
		survey := state.Surveys[response.SurveyID]
		if response.Status != "submitted" || survey.Audience != response.Role ||
			(response.Role != domain.RoleIntern && response.Role != domain.RoleMentor) ||
			response.Wave < 1 || response.Wave > 6 || !isPulse(survey) {
			continue
		}
		if active[response.InternshipID] == nil {
			active[response.InternshipID] = map[pulsePeriod]domain.Response{}
		}
		key := pulsePeriod{response.Wave, response.Role}
		previous := active[response.InternshipID][key]
		if previous.ID == "" || response.UpdatedAt.After(previous.UpdatedAt) ||
			(response.UpdatedAt.Equal(previous.UpdatedAt) && response.ID > previous.ID) {
			active[response.InternshipID][key] = response
		}
	}
	histories := make(map[string]PulseHistory, len(active))
	for id, responses := range active {
		history := PulseHistory{}
		for wave := 1; wave <= 6; wave++ {
			for _, role := range []domain.Role{domain.RoleIntern, domain.RoleMentor} {
				response, ok := responses[pulsePeriod{wave, role}]
				if !ok {
					continue
				}
				answer := PulseAnswer{ID: response.ID, Wave: wave, Role: role, Scores: map[string]float64{}}
				for _, question := range state.Surveys[response.SurveyID].Questions {
					switch question.Type {
					case "scale":
						if value, ok := number(response.Answers[question.ID]); ok && question.Min == 1 && question.Max == 5 {
							answer.Scores[question.Dimension] = value
						}
					case "text":
						if value, ok := response.Answers[question.ID].(string); ok && strings.TrimSpace(value) != "" {
							answer.Comments = append(answer.Comments, limitText(strings.TrimSpace(value), 800))
						}
					}
				}
				history.Answers = append(history.Answers, answer)
			}
		}
		history.Findings = pulseFindings(history.Answers)
		histories[id] = history
	}
	return histories
}

func pulseFindings(answers []PulseAnswer) []domain.SurveyFinding {
	findings := []domain.SurveyFinding{}
	if len(answers) == 0 {
		return findings
	}
	latest := answers[len(answers)-1].Wave
	byPeriod := map[pulsePeriod]PulseAnswer{}
	for _, answer := range answers {
		byPeriod[pulsePeriod{answer.Wave, answer.Role}] = answer
	}
	add := func(kind, severity, title string, sources ...domain.SurveyEvidence) {
		findings = append(findings, domain.SurveyFinding{Kind: kind, Severity: severity, Title: title, Wave: latest, Evidence: sources})
	}
	for _, role := range []domain.Role{domain.RoleIntern, domain.RoleMentor} {
		current := byPeriod[pulsePeriod{latest, role}]
		if current.ID == "" {
			continue
		}
		for _, comment := range current.Comments {
			if hasHelpIntent(comment) {
				add("help", "critical", "Явная просьба о помощи", current.Evidence(comment))
				break
			}
		}
		previous := byPeriod[pulsePeriod{latest - 1, role}]
		for _, dimension := range domain.SortedKeys(current.Scores) {
			value := current.Scores[dimension]
			name := pulseDimensionLabel(dimension)
			if value <= 2 {
				add("low", "high", "Низкая оценка · "+name, current.Evidence(scoreText(name, value)))
			}
			if before, ok := previous.Scores[dimension]; ok && before-value >= 2 {
				add("drop", "high", "Снижение оценки · "+name,
					previous.Evidence(scoreText(name, before)), current.Evidence(scoreText(name, value)))
			}
		}
	}
	intern, mentor := byPeriod[pulsePeriod{latest, domain.RoleIntern}], byPeriod[pulsePeriod{latest, domain.RoleMentor}]
	for _, metric := range []struct{ intern, mentor, label string }{
		{"clarity", "understanding", "Понимание задач"},
		{"team", "communication", "Взаимодействие с командой"},
	} {
		left, iok := intern.Scores[metric.intern]
		right, mok := mentor.Scores[metric.mentor]
		if iok && mok && (left-right >= 2 || right-left >= 2) {
			add("gap", "high", "Расхождение · "+metric.label,
				intern.Evidence(scoreText(pulseDimensionLabel(metric.intern), left)),
				mentor.Evidence(scoreText(pulseDimensionLabel(metric.mentor), right)))
		}
	}
	for _, theme := range []struct {
		title string
		words []string
	}{
		{"Приоритеты и сроки", []string{"неясн", "непонят", "не хватает времени", "не успев", "повторно уточня", "задерж"}},
		{"Поддержка и обратная связь", []string{"не хватает обратной связи", "не хватает поддержки", "сложно получить", "нужна помощь"}},
		{"Нагрузка", []string{"слишком высок", "высокая нагрузка", "перегруз", "слишком много задач"}},
		{"Рабочие инструменты", []string{"нет доступа", "не хватает доступ", "проблемы с доступ"}},
	} {
		var first, recent domain.SurveyEvidence
		for _, answer := range answers {
			for _, comment := range answer.Comments {
				if !hasOpenTheme(comment, theme.words) {
					continue
				}
				if answer.Wave < latest {
					first = answer.Evidence(comment)
				} else {
					recent = answer.Evidence(comment)
				}
			}
		}
		if first.ResponseID != "" && recent.ResponseID != "" {
			add("repeat", "high", "Повторяющаяся тема · "+theme.title, first, recent)
		}
	}
	slices.SortStableFunc(findings, func(a, b domain.SurveyFinding) int {
		if a.Severity == b.Severity {
			return 0
		}
		if a.Severity == "critical" {
			return -1
		}
		return 1
	})
	return findings
}

var themeClauseBreaks = strings.NewReplacer(", но ", ".", ", однако ", ".", ", зато ", ".", "ё", "е")

func hasOpenTheme(comment string, markers []string) bool {
	clauses := strings.FieldsFunc(themeClauseBreaks.Replace(strings.ToLower(comment)), func(char rune) bool {
		return char == '.' || char == ';' || char == '!' || char == '?' || char == '\n'
	})
	for _, clause := range clauses {
		if !containsPhrase(clause, markers) {
			continue
		}
		if containsPhrase(clause, []string{"не решен", "не решил", "не решат", "нереш", "не устранили", "не исчез", "не в норме", "не восстановили"}) {
			return true
		}
		if !containsPhrase(clause, []string{"решен", "решили", "больше нет", "устранили", "исчез", "в норме", "восстановили"}) {
			return true
		}
	}
	return false
}

func containsPhrase(text string, phrases []string) bool {
	return slices.ContainsFunc(phrases, func(phrase string) bool { return strings.Contains(text, phrase) })
}

func (a PulseAnswer) Evidence(text string) domain.SurveyEvidence {
	return domain.SurveyEvidence{ResponseID: a.ID, Role: a.Role, Wave: a.Wave, Text: text}
}

func (h PulseHistory) Attention(color string) string {
	if len(h.Findings) == 0 {
		return color
	}
	if h.Findings[0].Severity == "critical" || color == "red" {
		return "red"
	}
	return "yellow"
}

func scoreText(label string, score float64) string {
	return fmt.Sprintf("%s · %g из 5", label, score)
}

func limitText(value string, max int) string {
	runes := []rune(value)
	if len(runes) > max {
		return string(runes[:max])
	}
	return value
}

func pulseDimensionLabel(dimension string) string {
	labels := map[string]string{
		"clarity": "Понятность задач", "support": "Поддержка наставника", "workload": "Комфортность нагрузки",
		"interest": "Интерес к задачам", "growth": "Профессиональное развитие", "team": "Взаимодействие с командой",
		"satisfaction": "Удовлетворённость стажировкой", "understanding": "Понимание задач", "quality": "Качество задач",
		"independence": "Самостоятельность", "deadlines": "Соблюдение сроков", "engagement": "Вовлечённость",
		"communication": "Взаимодействие с наставником и командой",
	}
	if name := labels[dimension]; name != "" {
		return name
	}
	return dimension
}
