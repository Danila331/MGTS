package usecase

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	analytics "mgts/backend/internal/modules/analytics/usecase"
	"mgts/backend/internal/modules/core/domain"
)

type SurveyInput struct {
	Title, Description, Period string
	Audience                   domain.Role
	DueAt                      time.Time
	Wave                       int
	Questions                  []domain.Question
}

type SurveyPatch struct {
	Title, Description, Period *string
	Audience                   *domain.Role
	DueAt                      *time.Time
	Wave                       *int
	Questions                  *[]domain.Question
}

type AssignInput struct {
	InternshipIDs []string
	RespondentIDs []string
	DueAt         time.Time
}

func (s *Service) Surveys(ctx context.Context, actorID string) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	items := []domain.Survey{}
	for _, id := range domain.SortedKeys(state.Surveys) {
		survey := state.Surveys[id]
		if !s.canSurvey(state, actor, survey) {
			continue
		}
		survey.Coverage = state.SurveyCoverage(id)
		items = append(items, survey)
	}
	sort.Slice(items, func(i, j int) bool { return items[i].UpdatedAt.After(items[j].UpdatedAt) })
	return map[string]any{"items": items, "total": len(items)}, nil
}

func (s *Service) Survey(ctx context.Context, actorID, id string) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	survey, ok := state.Surveys[id]
	if !ok {
		return nil, domain.ErrNotFound
	}
	if !s.canSurvey(state, actor, survey) {
		return nil, domain.ErrForbidden
	}
	assignments := []domain.Assignment{}
	for _, assignmentID := range domain.SortedKeys(state.Assignments) {
		assignment := state.Assignments[assignmentID]
		if assignment.SurveyID != id {
			continue
		}
		if actor.Role != domain.RoleHR && actor.Role != domain.RoleManager && assignment.RespondentID != actor.ID {
			continue
		}
		assignments = append(assignments, assignment)
	}
	responses := []domain.Response{}
	for _, responseID := range domain.SortedKeys(state.Responses) {
		response := state.Responses[responseID]
		if response.SurveyID != id || response.Status != "submitted" {
			continue
		}
		internship := state.Internships[response.InternshipID]
		if actor.Role == domain.RoleHR || actor.Role == domain.RoleManager || response.RespondentID == actor.ID || (actor.Role == domain.RoleMentor && internship.MentorID == actor.ID) {
			responses = append(responses, response)
		}
	}
	survey.Coverage = state.SurveyCoverage(id)
	return map[string]any{"survey": survey, "questions": survey.Questions, "assignments": assignments, "coverage": survey.Coverage, "responses": responses}, nil
}

func (s *Service) CreateSurvey(ctx context.Context, actorID string, input SurveyInput) (domain.Survey, error) {
	var result domain.Survey
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if actor.Role != domain.RoleHR {
			return domain.ErrForbidden
		}
		if err := validateSurvey(input.Title, input.Audience, input.Questions); err != nil {
			return err
		}
		now := s.now()
		id := state.NextID("survey")
		if input.Wave < 1 {
			input.Wave = 1
		}
		result = domain.Survey{ID: id, Title: strings.TrimSpace(input.Title), Description: input.Description, Status: "draft",
			Audience: input.Audience, Period: input.Period, DueAt: input.DueAt, Wave: input.Wave, Questions: normalizeQuestions(input.Questions), CreatedAt: now, UpdatedAt: now}
		state.Surveys[id] = result
		state.Touch()
		return nil
	})
	return result, err
}

func (s *Service) UpdateSurvey(ctx context.Context, actorID, id string, patch SurveyPatch) (domain.Survey, error) {
	var result domain.Survey
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if actor.Role != domain.RoleHR {
			return domain.ErrForbidden
		}
		survey, ok := state.Surveys[id]
		if !ok {
			return domain.ErrNotFound
		}
		if survey.Status == "closed" {
			return domain.ErrConflict
		}
		title, audience, questions := survey.Title, survey.Audience, survey.Questions
		if patch.Title != nil {
			title = *patch.Title
		}
		if patch.Description != nil {
			survey.Description = *patch.Description
		}
		if patch.Period != nil {
			survey.Period = *patch.Period
		}
		if patch.Audience != nil {
			audience = *patch.Audience
		}
		if patch.Questions != nil {
			questions = versionQuestions(survey.Questions, *patch.Questions)
		}
		if err := validateSurvey(title, audience, questions); err != nil {
			return err
		}
		survey.Title, survey.Audience, survey.Questions = strings.TrimSpace(title), audience, normalizeQuestions(questions)
		if patch.DueAt != nil {
			survey.DueAt = *patch.DueAt
		}
		if patch.Wave != nil {
			if *patch.Wave < 1 {
				return invalid("wave must be positive")
			}
			survey.Wave = *patch.Wave
		}
		survey.UpdatedAt = s.now()
		state.Surveys[id] = survey
		state.Touch()
		result = survey
		return nil
	})
	return result, err
}

func (s *Service) PublishSurvey(ctx context.Context, actorID, id string) (domain.Survey, error) {
	var result domain.Survey
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if actor.Role != domain.RoleHR {
			return domain.ErrForbidden
		}
		survey, ok := state.Surveys[id]
		if !ok {
			return domain.ErrNotFound
		}
		if len(survey.Questions) == 0 {
			return invalid("cannot publish without questions")
		}
		if survey.Status == "closed" {
			return domain.ErrConflict
		}
		survey.Status = "published"
		survey.UpdatedAt = s.now()
		state.Surveys[id] = survey
		state.Touch()
		result = survey
		return nil
	})
	return result, err
}

func (s *Service) AssignSurvey(ctx context.Context, actorID, id string, input AssignInput) ([]domain.Assignment, error) {
	result := []domain.Assignment{}
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if actor.Role != domain.RoleHR {
			return domain.ErrForbidden
		}
		survey, ok := state.Surveys[id]
		if !ok {
			return domain.ErrNotFound
		}
		if survey.Status != "published" {
			return invalid("survey must be published before assignment")
		}
		if len(input.InternshipIDs) == 0 {
			return invalid("internship_ids are required")
		}
		dueAt := input.DueAt
		if dueAt.IsZero() {
			dueAt = survey.DueAt
		}
		changed := false
		for _, internshipID := range input.InternshipIDs {
			internship, ok := state.Internships[internshipID]
			if !ok {
				return fmt.Errorf("%w: internship %s", domain.ErrNotFound, internshipID)
			}
			respondents := input.RespondentIDs
			if len(respondents) == 0 {
				respondents = defaultRespondents(internship, survey.Audience)
			}
			for _, respondentID := range respondents {
				respondent, ok := state.Actors[respondentID]
				if !ok {
					return fmt.Errorf("%w: actor %s", domain.ErrNotFound, respondentID)
				}
				if respondent.Role != survey.Audience {
					return invalid("respondent " + respondentID + " does not match survey audience")
				}
				duplicate := false
				for _, assignment := range state.Assignments {
					if assignment.SurveyID == id && assignment.InternshipID == internshipID && assignment.RespondentID == respondentID {
						duplicate = true
						result = append(result, assignment)
					}
				}
				if duplicate {
					continue
				}
				assignmentID := state.NextID("assignment")
				assignment := domain.Assignment{ID: assignmentID, SurveyID: id, InternshipID: internshipID, RespondentID: respondentID, Status: "assigned", DueAt: dueAt}
				state.Assignments[assignmentID] = assignment
				result = append(result, assignment)
				changed = true
				notificationID := state.NextID("notification")
				state.Notifications[notificationID] = domain.Notification{ID: notificationID, ActorID: respondentID, Kind: "survey_assigned", Message: survey.Title, Status: "pending", CreatedAt: s.now()}
			}
		}
		if changed {
			state.Touch()
		}
		return nil
	})
	return result, err
}

func (s *Service) TakeSurvey(ctx context.Context, actorID, surveyID, internshipID string) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	survey, assignment, err := s.takeAssignment(state, actor, surveyID, internshipID)
	if err != nil {
		return nil, err
	}
	var draft *domain.Response
	for _, response := range state.Responses {
		if response.AssignmentID == assignment.ID && response.Status == "draft" {
			copy := response
			draft = &copy
		}
	}
	return map[string]any{"survey": survey, "questions": survey.Questions, "assignment": assignment, "draft": draft}, nil
}

func (s *Service) SaveDraft(ctx context.Context, actorID, surveyID, internshipID string, answers map[string]any) (domain.Response, error) {
	var result domain.Response
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		survey, assignment, err := s.takeAssignment(state, actor, surveyID, internshipID)
		if err != nil {
			return err
		}
		if assignment.Status == "submitted" {
			return domain.ErrConflict
		}
		if err := validateAnswers(survey, answers, false); err != nil {
			return err
		}
		now := s.now()
		found := false
		for id, response := range state.Responses {
			if response.AssignmentID == assignment.ID && response.Status == "draft" {
				response.Answers = cloneAnswers(answers)
				response.UpdatedAt = now
				state.Responses[id] = response
				result = response
				found = true
				break
			}
		}
		if !found {
			id := state.NextID("response")
			result = domain.Response{ID: id, SurveyID: surveyID, AssignmentID: assignment.ID,
				InternshipID: assignment.InternshipID, RespondentID: actor.ID, Respondent: actor.Name, Role: actor.Role,
				Wave: survey.Wave, Answers: cloneAnswers(answers), Status: "draft", Version: 1, CreatedAt: now, UpdatedAt: now}
			state.Responses[id] = result
		}
		assignment.Status = "draft"
		state.Assignments[assignment.ID] = assignment
		state.Touch()
		return nil
	})
	return result, err
}

func (s *Service) SubmitSurvey(ctx context.Context, actorID, surveyID, internshipID string, answers map[string]any) (domain.Response, error) {
	var result domain.Response
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		survey, assignment, err := s.takeAssignment(state, actor, surveyID, internshipID)
		if err != nil {
			return err
		}
		if err := validateAnswers(survey, answers, true); err != nil {
			return err
		}
		now := s.now()
		responseID, existing, found := activeResponse(state, assignment.ID)
		if found && existing.ExternalID != "" {
			// A built-in correction supersedes the imported response and its metrics.
			supersedeResponse(state, responseID, now)
			responseID = ""
		}
		// A successful submit consumes every draft for the assignment atomically,
		// including the first submit when no submitted response exists yet.
		discardDrafts(state, assignment.ID)
		supersedeOtherActiveResponses(state, assignment.ID, responseID, now)
		if responseID == "" {
			responseID = state.NextID("response")
			existing = domain.Response{ID: responseID, CreatedAt: now, Version: 0}
		}
		result = domain.Response{ID: responseID, SurveyID: surveyID, AssignmentID: assignment.ID, InternshipID: assignment.InternshipID,
			RespondentID: actor.ID, Respondent: actor.Name, Role: actor.Role, Wave: survey.Wave, Answers: cloneAnswers(answers),
			Status: "submitted", Version: existing.Version + 1, CreatedAt: existing.CreatedAt, UpdatedAt: now}
		state.Responses[responseID] = result
		assignment.Status = "submitted"
		assignment.SubmittedAt = &now
		state.Assignments[assignment.ID] = assignment
		internship := state.Internships[assignment.InternshipID]
		internship.LastActivity = now
		state.Internships[internship.ID] = internship
		analytics.Recalculate(state, result)
		state.Touch()
		return nil
	})
	return result, err
}

func (s *Service) takeAssignment(state *domain.State, actor domain.Actor, surveyID, internshipID string) (domain.Survey, domain.Assignment, error) {
	survey, ok := state.Surveys[surveyID]
	if !ok {
		return domain.Survey{}, domain.Assignment{}, domain.ErrNotFound
	}
	if survey.Status != "published" {
		return survey, domain.Assignment{}, domain.ErrConflict
	}
	candidates := []domain.Assignment{}
	for _, assignment := range state.Assignments {
		if assignment.SurveyID == surveyID && assignment.RespondentID == actor.ID && (internshipID == "" || assignment.InternshipID == internshipID) {
			candidates = append(candidates, assignment)
		}
	}
	if len(candidates) == 0 {
		return survey, domain.Assignment{}, domain.ErrForbidden
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].ID < candidates[j].ID })
	return survey, candidates[0], nil
}

func defaultRespondents(internship domain.Internship, audience domain.Role) []string {
	switch audience {
	case domain.RoleIntern:
		return []string{internship.Intern.ID}
	case domain.RoleMentor:
		return []string{internship.MentorID}
	case domain.RoleManager:
		return []string{internship.ManagerID}
	default:
		return nil
	}
}

func validateSurvey(title string, audience domain.Role, questions []domain.Question) error {
	if strings.TrimSpace(title) == "" {
		return invalid("title is required")
	}
	if audience != domain.RoleIntern && audience != domain.RoleMentor && audience != domain.RoleManager {
		return invalid("audience must be intern, mentor or manager")
	}
	seen := map[string]bool{}
	for index, question := range questions {
		if strings.TrimSpace(question.Title) == "" {
			return invalid("question title is required")
		}
		if question.ID != "" {
			if seen[question.ID] {
				return invalid("duplicate question id")
			}
			seen[question.ID] = true
		}
		switch question.Type {
		case "scale":
			if question.Min == 0 {
				question.Min = 1
			}
			if question.Max == 0 {
				question.Max = 5
			}
			if question.Min >= question.Max {
				return invalid("invalid scale range")
			}
		case "single", "multiple":
			if len(question.Options) < 2 {
				return invalid("choice question needs at least two options")
			}
		case "text":
		default:
			return invalid(fmt.Sprintf("unsupported question type at index %d", index))
		}
	}
	return nil
}

func normalizeQuestions(questions []domain.Question) []domain.Question {
	result := append([]domain.Question(nil), questions...)
	for index := range result {
		if result[index].ID == "" {
			result[index].ID = fmt.Sprintf("q%d", index+1)
		}
		if result[index].Type == "scale" {
			if result[index].Min == 0 {
				result[index].Min = 1
			}
			if result[index].Max == 0 {
				result[index].Max = 5
			}
		}
		if result[index].Version < 1 {
			result[index].Version = 1
		}
	}
	return result
}

func versionQuestions(previous, incoming []domain.Question) []domain.Question {
	oldByID := map[string]domain.Question{}
	for _, question := range normalizeQuestions(previous) {
		oldByID[question.ID] = question
	}
	result := normalizeQuestions(incoming)
	for index, question := range result {
		old, ok := oldByID[question.ID]
		if !ok {
			continue
		}
		oldVersion := domain.QuestionVersion(old)
		if question.Version <= oldVersion {
			result[index].Version = oldVersion
			if domain.QuestionDefinitionSignature(old) != domain.QuestionDefinitionSignature(question) {
				result[index].Version = oldVersion + 1
			}
		}
	}
	return result
}

func validateAnswers(survey domain.Survey, answers map[string]any, requireAll bool) error {
	known := map[string]domain.Question{}
	for _, question := range survey.Questions {
		known[question.ID] = question
	}
	for id := range answers {
		if _, ok := known[id]; !ok {
			return invalid("unknown question " + id)
		}
	}
	for _, question := range survey.Questions {
		raw, exists := answers[question.ID]
		if !exists || raw == nil || raw == "" {
			if requireAll && question.Required {
				return invalid("required answer missing: " + question.ID)
			}
			continue
		}
		switch question.Type {
		case "scale":
			value, ok := answerNumber(raw)
			if !ok || value < float64(question.Min) || value > float64(question.Max) {
				return invalid("invalid scale answer: " + question.ID)
			}
		case "text":
			if _, ok := raw.(string); !ok {
				return invalid("text answer expected: " + question.ID)
			}
		case "single":
			value, ok := raw.(string)
			if !ok || !contains(question.Options, value) {
				return invalid("invalid single choice: " + question.ID)
			}
		case "multiple":
			values, ok := raw.([]any)
			if !ok {
				if typed, yes := raw.([]string); yes {
					for _, value := range typed {
						if !contains(question.Options, value) {
							return invalid("invalid multiple choice: " + question.ID)
						}
					}
					continue
				} else {
					return invalid("multiple choice expected: " + question.ID)
				}
			}
			for _, rawValue := range values {
				value, ok := rawValue.(string)
				if !ok || !contains(question.Options, value) {
					return invalid("invalid multiple choice: " + question.ID)
				}
			}
		}
	}
	return nil
}

func answerNumber(raw any) (float64, bool) {
	switch value := raw.(type) {
	case float64:
		return value, true
	case float32:
		return float64(value), true
	case int:
		return float64(value), true
	case int64:
		return float64(value), true
	case interface{ Float64() (float64, error) }:
		result, err := value.Float64()
		return result, err == nil
	default:
		return 0, false
	}
}
func contains(items []string, wanted string) bool {
	for _, item := range items {
		if item == wanted {
			return true
		}
	}
	return false
}
func cloneAnswers(answers map[string]any) map[string]any {
	result := map[string]any{}
	for key, value := range answers {
		result[key] = value
	}
	return result
}
