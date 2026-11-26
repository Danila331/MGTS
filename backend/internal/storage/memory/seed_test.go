package memory

import (
	"fmt"
	"testing"

	"mgts/backend/internal/modules/core/domain"
)

func TestSeedContainsCompleteMGTSHistory(t *testing.T) {
	state := Seed()
	if len(state.Internships) != 5 {
		t.Fatalf("internships=%d, want 5", len(state.Internships))
	}
	if len(state.Surveys) != 12 || len(state.Assignments) != 60 {
		t.Fatalf("surveys=%d assignments=%d, want 12 and 60", len(state.Surveys), len(state.Assignments))
	}
	if len(state.Responses) != 60 {
		t.Fatalf("responses=%d, want 60", len(state.Responses))
	}
	internWaves, mentorWaves := map[int]bool{}, map[int]bool{}
	internResponses, mentorResponses := 0, 0
	for _, survey := range state.Surveys {
		if survey.Status != "published" || survey.Period != fmt.Sprintf("Месяц %d", survey.Wave) {
			t.Fatalf("unexpected survey period/status: %+v", survey)
		}
		scales, texts := 0, 0
		for _, question := range survey.Questions {
			switch question.Type {
			case "scale":
				scales++
			case "text":
				texts++
			}
		}
		switch survey.Audience {
		case domain.RoleIntern:
			internWaves[survey.Wave] = true
			if scales != 7 || texts != 2 {
				t.Fatalf("intern form has %d scales and %d texts", scales, texts)
			}
		case domain.RoleMentor:
			mentorWaves[survey.Wave] = true
			if scales != 6 || texts != 2 {
				t.Fatalf("mentor form has %d scales and %d texts", scales, texts)
			}
		default:
			t.Fatalf("unexpected audience %s", survey.Audience)
		}
	}
	for _, response := range state.Responses {
		if response.Status != "submitted" {
			t.Fatalf("response %s is %s", response.ID, response.Status)
		}
		switch response.Role {
		case domain.RoleIntern:
			internResponses++
		case domain.RoleMentor:
			mentorResponses++
		}
	}
	if len(internWaves) != 6 || len(mentorWaves) != 6 || internResponses != 30 || mentorResponses != 30 {
		t.Fatalf("waves intern=%d mentor=%d, responses intern=%d mentor=%d", len(internWaves), len(mentorWaves), internResponses, mentorResponses)
	}
	if len(state.Metrics) != 30*7+30*6 {
		t.Fatalf("metric points=%d, want 390", len(state.Metrics))
	}
}

func TestSeedPreservesSourceAnswersAndComments(t *testing.T) {
	state := Seed()
	intern := state.Responses["response-intern-03-3"]
	if intern.Answers["intern_clarity"] != 2 || intern.Answers["intern_satisfaction"] != 2 {
		t.Fatalf("source scores changed: %+v", intern.Answers)
	}
	if intern.Answers["intern_difficulties"] != "Часть задач пришлось переделывать из-за непонятной постановки." {
		t.Fatalf("source comment changed: %+v", intern.Answers)
	}
	mentor := state.Responses["response-mentor-05-6"]
	if mentor.Answers["mentor_independence"] != 5 || mentor.Answers["mentor_attention"] != "Сложностей, требующих внимания, нет." {
		t.Fatalf("source mentor answer changed: %+v", mentor.Answers)
	}
	for index := 1; index <= 5; index++ {
		internID := fmt.Sprintf("СТ-%03d", index)
		mentorID := fmt.Sprintf("Н-%03d", index)
		if state.Actors[internID].Role != domain.RoleIntern || state.Actors[mentorID].Role != domain.RoleMentor {
			t.Fatalf("demo actor IDs missing for %s/%s", internID, mentorID)
		}
	}
}
