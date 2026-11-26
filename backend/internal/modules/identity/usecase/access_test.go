package usecase

import (
	"testing"

	"mgts/backend/internal/modules/core/domain"
)

func TestInternshipScope(t *testing.T) {
	internship := domain.Internship{ID: "i1", TeamID: "team1", ManagerID: "m1", MentorID: "mentor1"}
	tests := []struct {
		name  string
		actor domain.Actor
		want  bool
	}{
		{"hr", domain.Actor{ID: "hr", Role: domain.RoleHR}, true},
		{"manager own team", domain.Actor{ID: "m2", Role: domain.RoleManager, TeamID: "team1"}, true},
		{"manager other team has full scope", domain.Actor{ID: "m2", Role: domain.RoleManager, TeamID: "team2"}, true},
		{"assigned mentor", domain.Actor{ID: "mentor1", Role: domain.RoleMentor}, true},
		{"other mentor", domain.Actor{ID: "mentor2", Role: domain.RoleMentor}, false},
		{"own internship", domain.Actor{ID: "intern", Role: domain.RoleIntern, InternshipID: "i1"}, true},
		{"other internship", domain.Actor{ID: "intern", Role: domain.RoleIntern, InternshipID: "i2"}, false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := CanAccessInternship(test.actor, internship); got != test.want {
				t.Fatalf("got %v want %v", got, test.want)
			}
		})
	}
}

func TestFeedbackVisibilityForIntern(t *testing.T) {
	intern := domain.Actor{ID: "intern", Role: domain.RoleIntern, InternshipID: "i1"}
	feedback := domain.Feedback{ID: "f1", InternshipID: "i1", AuthorID: "mentor", Status: "published"}
	internship := domain.Internship{ID: "i1", MentorID: "mentor"}
	if CanSeeFeedback(intern, feedback, internship, false) {
		t.Fatal("hidden feedback must not be visible")
	}
	if !CanSeeFeedback(intern, feedback, internship, true) {
		t.Fatal("published feedback must be visible when enabled")
	}
	feedback.Status = "draft"
	if CanSeeFeedback(intern, feedback, internship, true) {
		t.Fatal("draft feedback must not be visible")
	}
}
