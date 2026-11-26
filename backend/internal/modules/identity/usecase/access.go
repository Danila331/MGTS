package usecase

import (
	"mgts/backend/internal/modules/core/domain"
)

func CanAccessInternship(actor domain.Actor, internship domain.Internship) bool {
	switch actor.Role {
	case domain.RoleHR, domain.RoleManager:
		return true
	case domain.RoleMentor:
		return actor.ID == internship.MentorID
	case domain.RoleIntern:
		return actor.InternshipID == internship.ID
	default:
		return false
	}
}

func CanAdmin(actor domain.Actor) bool { return actor.Role == domain.RoleHR }

func CanManage(actor domain.Actor, internship domain.Internship) bool {
	return actor.Role == domain.RoleHR || ((actor.Role == domain.RoleManager || actor.Role == domain.RoleMentor) && CanAccessInternship(actor, internship))
}

func CanSeeFeedback(actor domain.Actor, feedback domain.Feedback, internship domain.Internship, show bool) bool {
	if actor.ID == feedback.AuthorID {
		return true
	}
	if actor.Role == domain.RoleHR {
		return true
	}
	if feedback.Status != "published" {
		return false
	}
	if actor.Role == domain.RoleIntern {
		return actor.InternshipID == feedback.InternshipID && show
	}
	return CanAccessInternship(actor, internship)
}

func ScopedInternships(state *domain.State, actor domain.Actor) []domain.Internship {
	items := []domain.Internship{}
	for _, id := range domain.SortedKeys(state.Internships) {
		internship := state.Internships[id]
		if CanAccessInternship(actor, internship) {
			items = append(items, internship)
		}
	}
	return items
}
