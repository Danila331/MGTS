package usecase

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"mgts/backend/internal/modules/core/domain"
)

type TallyConfig struct {
	Secret    string
	InviteKey string
	InternID  string
	MentorID  string
}

func (t TallyConfig) Enabled() bool {
	return t.Secret != "" && t.InviteKey != "" && t.Secret != t.InviteKey &&
		t.InternID != "" && t.MentorID != "" && t.InternID != t.MentorID
}

func (t TallyConfig) form(role domain.Role) string {
	switch role {
	case domain.RoleIntern:
		return t.InternID
	case domain.RoleMentor:
		return t.MentorID
	default:
		return ""
	}
}

type TallySubmission struct {
	EventType string `json:"eventType"`
	Data      struct {
		SubmissionID string       `json:"submissionId"`
		FormID       string       `json:"formId"`
		CreatedAt    time.Time    `json:"createdAt"`
		Fields       []TallyField `json:"fields"`
	} `json:"data"`
}

type TallyField struct {
	Label string          `json:"label"`
	Value json.RawMessage `json:"value"`
}

type ExternalInvite struct {
	Name     string    `json:"name"`
	Subject  string    `json:"subject"`
	URL      string    `json:"url"`
	Deadline time.Time `json:"deadline"`
}

const tallyInviteTTL = 32 * 24 * time.Hour

func (t TallyConfig) invite(assignmentID string, deadline time.Time) string {
	payload := assignmentID + "." + strconv.FormatInt(deadline.Unix(), 10)
	mac := hmac.New(sha256.New, []byte(t.InviteKey))
	mac.Write([]byte(payload))
	return payload + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func (t TallyConfig) verifyInvite(token string, submittedAt time.Time) (string, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 || parts[0] == "" {
		return "", false
	}
	expiry, err := strconv.ParseInt(parts[1], 10, 64)
	deadline := time.Unix(expiry, 0)
	return parts[0], err == nil && !submittedAt.After(deadline) && hmac.Equal([]byte(t.invite(parts[0], deadline)), []byte(token))
}

func (s *Service) TallyInvites(ctx context.Context, actorID, surveyID string, tally TallyConfig) ([]ExternalInvite, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.requireSurveyHR(state, actorID); err != nil {
		return nil, err
	}
	survey, ok := state.Surveys[surveyID]
	if !ok {
		return nil, domain.ErrNotFound
	}
	items := []ExternalInvite{}
	form := tally.form(survey.Audience)
	if !tally.Enabled() || form == "" || survey.Status != "published" {
		return items, nil
	}
	if _, _, ok := tallyQuestions(survey); !ok {
		return items, nil
	}
	now := s.now()
	latestDeadline := now.Truncate(time.Hour).Add(tallyInviteTTL)
	for _, id := range domain.SortedKeys(state.Assignments) {
		assignment := state.Assignments[id]
		if assignment.SurveyID != surveyID || assignment.Status == "submitted" || !assignment.DueAt.After(now) {
			continue
		}
		internship, respondent, ok := tallyParticipants(state, assignment, survey.Audience)
		if !ok {
			continue
		}
		deadline := assignment.DueAt
		if deadline.After(latestDeadline) {
			deadline = latestDeadline
		}
		query := url.Values{"pulse_invite": {tally.invite(id, deadline)}}
		items = append(items, ExternalInvite{
			Name: respondent.Name, Subject: internship.Intern.Name,
			URL: "https://tally.so/r/" + url.PathEscape(form) + "?" + query.Encode(), Deadline: deadline,
		})
	}
	return items, nil
}

func (s *Service) ImportTally(ctx context.Context, event TallySubmission, tally TallyConfig) (bool, error) {
	data := event.Data
	if !tally.Enabled() || event.EventType != "FORM_RESPONSE" || data.SubmissionID == "" || len(data.SubmissionID) > 128 ||
		data.FormID == "" || data.CreatedAt.IsZero() || data.CreatedAt.After(s.now().Add(5*time.Minute)) {
		return false, invalid("некорректное событие Tally")
	}
	fields := make(map[string][]json.RawMessage, len(data.Fields))
	for _, field := range data.Fields {
		label := normalizePulseHeader(field.Label)
		if label != "" {
			fields[label] = append(fields[label], field.Value)
		}
	}
	var token string
	invites := fields["pulse_invite"]
	if len(invites) != 1 || json.Unmarshal(invites[0], &token) != nil || len(token) > 512 {
		return false, domain.ErrForbidden
	}
	assignmentID, ok := tally.verifyInvite(token, data.CreatedAt)
	if !ok {
		return false, domain.ErrForbidden
	}

	externalID := "tally:" + data.FormID + ":" + data.SubmissionID
	var duplicate bool
	err := s.store.Update(ctx, func(state *domain.State) error {
		assignment, ok := state.Assignments[assignmentID]
		if !ok {
			return domain.ErrNotFound
		}
		survey := state.Surveys[assignment.SurveyID]
		if tally.form(survey.Audience) != data.FormID {
			return domain.ErrForbidden
		}
		if previousID, ok := state.Imports[externalID+":1"]; ok {
			if state.Responses[previousID].AssignmentID != assignment.ID {
				return domain.ErrConflict
			}
			duplicate = true
			return nil
		}
		internship, respondent, ok := tallyParticipants(state, assignment, survey.Audience)
		if !ok {
			return domain.ErrForbidden
		}
		if survey.Status != "published" || data.CreatedAt.After(assignment.DueAt) ||
			assignment.Status == "submitted" {
			return domain.ErrConflict
		}
		table, questions, ok := tallyQuestions(survey)
		if !ok {
			return invalid("в Tally поддерживаются контрольные анкеты Пульса")
		}
		answers := make(map[string]any, len(questions))
		for index, question := range questions {
			aliases := []string{normalizePulseHeader(table.columns[index].header), normalizePulseHeader(question.Title), question.Dimension}
			slices.Sort(aliases)
			var values []json.RawMessage
			for _, alias := range slices.Compact(aliases) {
				values = append(values, fields[alias]...)
			}
			if len(values) > 1 {
				return invalid("в Tally повторяется поле «" + table.columns[index].header + "»")
			}
			if len(values) == 1 {
				var answer any
				if err := json.Unmarshal(values[0], &answer); err != nil {
					return invalid("некорректное поле Tally")
				}
				answers[question.ID] = answer
			}
		}
		_, importedDuplicate, err := s.ingestExternal(state, "tally", ExternalResponseInput{
			ExternalID: externalID, SurveyID: survey.ID, InternshipID: internship.ID, RespondentID: respondent.ID,
			Version: 1, Answers: answers, AssignmentID: assignment.ID, SubmittedAt: data.CreatedAt.UTC(),
		})
		duplicate = importedDuplicate
		return err
	})
	return duplicate, err
}

func tallyQuestions(survey domain.Survey) (pulseTable, []domain.Question, bool) {
	if survey.Wave >= 1 && survey.Wave <= 6 {
		for _, table := range pulseTables {
			if questions, ok := table.questions(survey); ok {
				return table, questions, true
			}
		}
	}
	return pulseTable{}, nil, false
}

func tallyParticipants(state *domain.State, assignment domain.Assignment, audience domain.Role) (domain.Internship, domain.Actor, bool) {
	internship, exists := state.Internships[assignment.InternshipID]
	respondent := state.Actors[assignment.RespondentID]
	return internship, respondent, exists && respondent.Role == audience &&
		contains(defaultRespondents(internship, audience), respondent.ID)
}
