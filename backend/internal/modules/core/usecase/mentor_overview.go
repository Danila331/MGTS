package usecase

import (
	"context"
	"sort"
	"strings"
	"time"

	"mgts/backend/internal/modules/core/domain"
)

type MentorFeedbackComment struct {
	Dimension string `json:"dimension"`
	Text      string `json:"text"`
}

type MentorFeedback struct {
	InternshipID string                  `json:"internship_id"`
	Intern       string                  `json:"intern"`
	Department   string                  `json:"department"`
	Wave         int                     `json:"wave"`
	At           string                  `json:"at"`
	Submitted    bool                    `json:"submitted"`
	Scores       map[string]float64      `json:"scores,omitempty"`
	Comments     []MentorFeedbackComment `json:"comments,omitempty"`
}

type MentorOverviewItem struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Departments []string         `json:"departments"`
	Interns     int              `json:"interns"`
	Feedback    []MentorFeedback `json:"feedback"`
}

type mentorFeedbackPeriod struct {
	internshipID string
	wave         int
}

type pendingMentorFeedback struct {
	deadline time.Time
	answer   domain.Response
}

func (s *Service) MentorOverview(ctx context.Context, actorID string) (map[string][]MentorOverviewItem, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.requireSurveyHR(state, actorID); err != nil {
		return nil, err
	}
	mentors := map[string]*MentorOverviewItem{}
	for _, internship := range state.Internships {
		mentor, ok := state.Actors[internship.MentorID]
		if !ok || mentor.Role != domain.RoleMentor {
			continue
		}
		item := mentors[mentor.ID]
		if item == nil {
			item = &MentorOverviewItem{ID: mentor.ID, Name: mentor.Name, Departments: []string{}, Feedback: []MentorFeedback{}}
			mentors[mentor.ID] = item
		}
		item.Interns++
		if !contains(item.Departments, internship.Team) {
			item.Departments = append(item.Departments, internship.Team)
		}
	}

	periods := map[mentorFeedbackPeriod]pendingMentorFeedback{}
	internPulse := pulseTables[0]
	for _, assignment := range state.Assignments {
		internship := state.Internships[assignment.InternshipID]
		survey := state.Surveys[assignment.SurveyID]
		if mentors[internship.MentorID] == nil || assignment.RespondentID != internship.Intern.ID || !isMentorFeedbackSurvey(internPulse, survey) {
			continue
		}
		key := mentorFeedbackPeriod{internship.ID, survey.Wave}
		item := periods[key]
		if item.deadline.IsZero() || (!assignment.DueAt.IsZero() && assignment.DueAt.Before(item.deadline)) {
			item.deadline = assignment.DueAt
		}
		periods[key] = item
	}
	for _, response := range state.Responses {
		if response.Status != "submitted" || response.Role != domain.RoleIntern {
			continue
		}
		internship := state.Internships[response.InternshipID]
		survey := state.Surveys[response.SurveyID]
		if mentors[internship.MentorID] == nil || response.RespondentID != internship.Intern.ID || response.Wave != survey.Wave || !isMentorFeedbackSurvey(internPulse, survey) {
			continue
		}
		key := mentorFeedbackPeriod{internship.ID, response.Wave}
		item := periods[key]
		if item.answer.ID == "" || response.UpdatedAt.After(item.answer.UpdatedAt) || (response.UpdatedAt.Equal(item.answer.UpdatedAt) && response.ID > item.answer.ID) {
			item.answer = response
			periods[key] = item
		}
	}
	for key, record := range periods {
		internship := state.Internships[key.internshipID]
		mentor := mentors[internship.MentorID]
		entry := MentorFeedback{InternshipID: internship.ID, Intern: internship.Intern.Name, Department: internship.Team, Wave: key.wave, Submitted: record.answer.ID != ""}
		at := record.deadline
		if entry.Submitted {
			at = record.answer.UpdatedAt
			if assignment := state.Assignments[record.answer.AssignmentID]; assignment.SubmittedAt != nil {
				at = *assignment.SubmittedAt
			}
			questions, _ := internPulse.questions(state.Surveys[record.answer.SurveyID])
			entry.Scores = map[string]float64{}
			for _, question := range questions {
				value := record.answer.Answers[question.ID]
				if question.Type == "scale" {
					if number, ok := answerNumber(value); ok && number >= 1 && number <= 5 {
						entry.Scores[question.Dimension] = number
					}
				} else if comment, ok := value.(string); ok && strings.TrimSpace(comment) != "" {
					entry.Comments = append(entry.Comments, MentorFeedbackComment{Dimension: question.Dimension, Text: comment})
				}
			}
		}
		if !at.IsZero() {
			entry.At = at.Format(time.RFC3339)
		}
		mentor.Feedback = append(mentor.Feedback, entry)
	}
	items := make([]MentorOverviewItem, 0, len(mentors))
	for _, id := range domain.SortedKeys(mentors) {
		item := mentors[id]
		sort.Strings(item.Departments)
		sort.Slice(item.Feedback, func(i, j int) bool {
			a, b := item.Feedback[i], item.Feedback[j]
			if a.Wave != b.Wave {
				return a.Wave < b.Wave
			}
			return a.InternshipID < b.InternshipID
		})
		items = append(items, *item)
	}
	return map[string][]MentorOverviewItem{"mentors": items}, nil
}

func isMentorFeedbackSurvey(table pulseTable, survey domain.Survey) bool {
	return survey.Wave >= 1 && survey.Wave <= 6 && isPulseSurvey(table, survey, survey.Wave)
}
