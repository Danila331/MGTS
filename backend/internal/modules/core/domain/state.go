package domain

import (
	"fmt"
	"sort"
	"time"
)

func NewState() *State {
	return &State{
		IdentitySubjects:   map[string]string{},
		SurveyAnalysisJobs: map[string]SurveyAnalysisJob{}, SurveyFollowUps: map[string]SurveyFollowUp{}, CandidateLinks: map[string]int{},
		InternshipRecaps: map[string]InternshipRecap{}, HRContacts: map[string]HRContact{},
		Actors: map[string]Actor{}, Teams: map[string]Team{}, Cohorts: map[string]Cohort{},
		Internships: map[string]Internship{}, Surveys: map[string]Survey{}, Assignments: map[string]Assignment{},
		Responses: map[string]Response{}, Metrics: map[string]MetricPoint{}, Signals: map[string]Signal{},
		Actions: map[string]Action{}, Feedback: map[string]Feedback{}, FeedbackRequests: map[string]FeedbackRequest{},
		Reviews: map[string]Review{}, Diagnostics: map[string]Diagnostic{}, Goals: map[string]Goal{},
		Integrations: map[string]Integration{}, Journal: map[string]JournalEntry{}, Imports: map[string]string{},
		AILogs: map[string]AILog{}, Notifications: map[string]Notification{},
		Settings: Settings{ShowFeedbackToIntern: true, SignalThresholds: map[string]float64{"low": 2.5, "positive": 4.5}, ScaleMin: 1, ScaleMax: 5},
	}
}

func (s *State) Normalize() {
	defaults := NewState()
	if s.IdentitySubjects == nil {
		s.IdentitySubjects = defaults.IdentitySubjects
	}
	if s.SurveyAnalysisJobs == nil {
		s.SurveyAnalysisJobs = defaults.SurveyAnalysisJobs
	}
	if s.SurveyFollowUps == nil {
		s.SurveyFollowUps = defaults.SurveyFollowUps
	}
	if s.CandidateLinks == nil {
		s.CandidateLinks = defaults.CandidateLinks
	}
	if s.InternshipRecaps == nil {
		s.InternshipRecaps = defaults.InternshipRecaps
	}
	if s.HRContacts == nil {
		s.HRContacts = defaults.HRContacts
	}
	if s.Actors == nil {
		s.Actors = defaults.Actors
	}
	if s.Teams == nil {
		s.Teams = defaults.Teams
	}
	if s.Cohorts == nil {
		s.Cohorts = defaults.Cohorts
	}
	if s.Internships == nil {
		s.Internships = defaults.Internships
	}
	if s.Surveys == nil {
		s.Surveys = defaults.Surveys
	}
	if s.Assignments == nil {
		s.Assignments = defaults.Assignments
	}
	if s.Responses == nil {
		s.Responses = defaults.Responses
	}
	if s.Metrics == nil {
		s.Metrics = defaults.Metrics
	}
	if s.Signals == nil {
		s.Signals = defaults.Signals
	}
	if s.Actions == nil {
		s.Actions = defaults.Actions
	}
	if s.Feedback == nil {
		s.Feedback = defaults.Feedback
	}
	if s.FeedbackRequests == nil {
		s.FeedbackRequests = defaults.FeedbackRequests
	}
	if s.Reviews == nil {
		s.Reviews = defaults.Reviews
	}
	if s.Diagnostics == nil {
		s.Diagnostics = defaults.Diagnostics
	}
	if s.Goals == nil {
		s.Goals = defaults.Goals
	}
	if s.Integrations == nil {
		s.Integrations = defaults.Integrations
	}
	if s.Journal == nil {
		s.Journal = defaults.Journal
	}
	if s.Imports == nil {
		s.Imports = defaults.Imports
	}
	if s.AILogs == nil {
		s.AILogs = defaults.AILogs
	}
	if s.Notifications == nil {
		s.Notifications = defaults.Notifications
	}
	if s.Settings.SignalThresholds == nil {
		s.Settings.SignalThresholds = defaults.Settings.SignalThresholds
	}
	if s.Settings.ScaleMax == 0 {
		s.Settings.ScaleMin, s.Settings.ScaleMax = 1, 5
	}
}

func (s *State) NextID(prefix string) string {
	s.Sequence++
	return fmt.Sprintf("%s-%06d", prefix, s.Sequence)
}

func (s *State) Touch() { s.Revision++ }

func (s *State) Actor(id string) (Actor, error) {
	a, ok := s.Actors[id]
	if !ok {
		return Actor{}, ErrUnauthorized
	}
	return a, nil
}

func (s *State) SurveyCoverage(surveyID string) Coverage {
	unique := map[string]bool{}
	c := Coverage{}
	for _, a := range s.Assignments {
		if a.SurveyID != surveyID {
			continue
		}
		c.Invited++
		if a.Status == "submitted" {
			c.Submitted++
			unique[a.RespondentID] = true
		}
	}
	c.Unique = len(unique)
	if c.Invited > 0 {
		c.Percent = float64(c.Submitted) * 100 / float64(c.Invited)
	}
	return c
}

func SortedKeys[T any](items map[string]T) []string {
	keys := make([]string, 0, len(items))
	for key := range items {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func Now() time.Time { return time.Now().UTC().Truncate(time.Second) }
