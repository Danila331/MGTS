package usecase

import (
	"slices"
	"testing"

	"mgts/backend/internal/modules/core/domain"
)

func TestPulseFindingScenarios(t *testing.T) {
	intern := func(w int, clarity float64, comment string) PulseAnswer {
		return PulseAnswer{ID: "s", Wave: w, Role: domain.RoleIntern, Scores: map[string]float64{"clarity": clarity}, Comments: []string{comment}}
	}
	mentor := func(w int, understanding float64) PulseAnswer {
		return PulseAnswer{ID: "n", Wave: w, Role: domain.RoleMentor, Scores: map[string]float64{"understanding": understanding}}
	}
	tests := []struct {
		name    string
		answers []PulseAnswer
		want    []string
	}{
		{"stable", []PulseAnswer{intern(1, 4, "Задачи понятны"), intern(2, 4, "Наставник помогает")}, nil},
		{"low_rating", []PulseAnswer{intern(1, 2, "Не хватает описания задач")}, []string{"low"}},
		{"drop", []PulseAnswer{intern(1, 5, ""), intern(2, 3, "")}, []string{"drop"}},
		{"missing_month", []PulseAnswer{intern(1, 5, ""), intern(3, 3, "")}, nil},
		{"matching_dimension_gap", []PulseAnswer{intern(1, 3, ""), mentor(1, 5)}, []string{"gap"}},
		{"both_sources_repeat_same_theme", []PulseAnswer{intern(1, 4, "Не хватает обратной связи"), intern(2, 4, "Всё понятно"), {ID: "n", Role: domain.RoleMentor, Wave: 2, Comments: []string{"Стажёру не хватает обратной связи"}}}, []string{"repeat"}},
		{"explicit_help_at_high_score", []PulseAnswer{intern(1, 5, "Мне нужна помощь с приоритетами")}, []string{"help"}},
		{"explicit_negation", []PulseAnswer{intern(1, 5, "Сейчас мне не нужна помощь")}, nil},
		{"support_negation", []PulseAnswer{intern(1, 5, "Мне больше не нужна поддержка")}, nil},
		{"help_needed_paraphrase", []PulseAnswer{intern(1, 5, "Без помощи я не могу продолжить работу")}, []string{"help"}},
		{"resolved_theme", []PulseAnswer{intern(1, 4, "Проблемы с доступом"), intern(2, 4, "Проблемы с доступом решены")}, nil},
		{"resolution_negated", []PulseAnswer{intern(1, 4, "Проблемы с доступом"), intern(2, 4, "Проблемы с доступом до сих пор не решены")}, []string{"repeat"}},
		{"unrelated_resolution", []PulseAnswer{intern(1, 4, "Высокая нагрузка"), intern(2, 4, "Проблемы с доступом решены, но высокая нагрузка остаётся")}, []string{"repeat"}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var got []string
			for _, item := range pulseFindings(tc.answers) {
				got = append(got, item.Kind)
			}
			slices.Sort(got)
			if !slices.Equal(got, tc.want) {
				t.Fatalf("got %v; want %v", got, tc.want)
			}
		})
	}
}
