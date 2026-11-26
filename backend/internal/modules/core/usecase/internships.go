package usecase

import (
	"context"
	"sort"
	"strings"
	"time"

	"mgts/backend/internal/modules/core/domain"
	identity "mgts/backend/internal/modules/identity/usecase"
)

type InternFilters struct {
	Search, TeamID, CohortID, Signal string
	Department, Sort                 string
	Page                             int
}

type InternshipPatch struct {
	Stage    *string
	Progress *int
	Settings domain.Map
}

func (s *Service) Interns(ctx context.Context, actorID string, filters InternFilters) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	scores := calculateInternshipScores(state)
	type scoredItem struct {
		item  map[string]any
		score internshipScore
	}
	scored := []scoredItem{}
	for _, internship := range identity.ScopedInternships(state, actor) {
		if filters.Search != "" && !matches(internship.ID+" "+internship.Intern.ID+" "+internship.Intern.Name+" "+internship.Team+" "+internship.Program, filters.Search) {
			continue
		}
		if filters.TeamID != "" && internship.TeamID != filters.TeamID {
			continue
		}
		if filters.Department != "" && !strings.EqualFold(internship.Team, filters.Department) {
			continue
		}
		if filters.CohortID != "" && internship.CohortID != filters.CohortID {
			continue
		}
		signals := s.internSignals(state, internship.ID)
		if filters.Signal == "open" {
			found := false
			for _, signal := range signals {
				if signal.Status != "resolved" && signal.Status != "dismissed" {
					found = true
				}
			}
			if !found {
				continue
			}
		}
		score := scores[internship.ID]
		item := internshipFields(internship)
		item["coverage"] = s.internCoverage(state, internship.ID)
		item["dynamics"] = s.internTrends(state, internship.ID)
		item["signal_count"] = len(signals)
		mergeFields(item, score.fields())
		scored = append(scored, scoredItem{item: item, score: score})
	}
	sort.SliceStable(scored, func(i, j int) bool {
		left, right := scored[i], scored[j]
		switch filters.Sort {
		case "name":
			return strings.ToLower(left.item["intern"].(domain.Person).Name) < strings.ToLower(right.item["intern"].(domain.Person).Name)
		case "score":
			if left.score.latestScore != right.score.latestScore {
				return left.score.latestScore > right.score.latestScore
			}
		case "percentile":
			if left.score.percentile != right.score.percentile {
				return left.score.percentile > right.score.percentile
			}
		default:
			leftActivity := left.item["last_activity"].(time.Time)
			rightActivity := right.item["last_activity"].(time.Time)
			if !leftActivity.Equal(rightActivity) {
				return leftActivity.After(rightActivity)
			}
		}
		return left.item["id"].(string) < right.item["id"].(string)
	})
	total := len(scored)
	page := filters.Page
	if page < 1 {
		page = 1
	}
	start := (page - 1) * 20
	if start > total {
		start = total
	}
	end := start + 20
	if end > total {
		end = total
	}
	items := make([]map[string]any, 0, end-start)
	for _, entry := range scored[start:end] {
		items = append(items, entry.item)
	}
	return map[string]any{"items": items, "total": total, "page": page}, nil
}

func (s *Service) Internship(ctx context.Context, actorID, id string) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	internship, err := s.internship(state, actor, id)
	if err != nil {
		return nil, err
	}
	participants := []domain.Participant{}
	for _, participantID := range []string{internship.ManagerID, internship.MentorID, internship.Intern.ID} {
		if participant, ok := state.Actors[participantID]; ok {
			participants = append(participants, domain.Participant{ActorID: participant.ID, Name: participant.Name, Role: participant.Role})
		}
	}
	responses := []domain.Response{}
	for _, responseID := range domain.SortedKeys(state.Responses) {
		response := state.Responses[responseID]
		if response.InternshipID != id || response.Status != "submitted" {
			continue
		}
		if actor.Role == domain.RoleIntern && response.RespondentID != actor.ID && response.RespondentID != internship.MentorID {
			continue
		}
		responses = append(responses, response)
	}
	timeline := []map[string]any{}
	for _, response := range responses {
		timeline = append(timeline, map[string]any{"at": response.UpdatedAt, "kind": "response", "id": response.ID, "title": state.Surveys[response.SurveyID].Title})
	}
	sort.Slice(timeline, func(i, j int) bool { return timeline[i]["at"].(time.Time).After(timeline[j]["at"].(time.Time)) })
	score := calculateInternshipScores(state)[id]
	coverage := s.internCoverage(state, id)
	internshipDTO := mergeFields(internshipFields(internship), score.fields())
	result := map[string]any{
		"internship": internshipDTO, "participants": participants, "metrics": s.internMetrics(state, id),
		"trends": s.internTrends(state, id), "timeline": timeline, "responses": responses,
		"coverage":   coverage,
		"percentile": map[string]any{"min": score.percentileMin, "max": score.percentileMax, "label": score.percentileLabel},
	}
	if actor.Role == domain.RoleHR {
		result["survey_signals"] = s.internSurveySignals(state, id, responses)
	}
	mergeFields(result, score.fields())
	return result, nil
}

func (s *Service) internSurveySignals(state *domain.State, id string, responses []domain.Response) []domain.Signal {
	signals := s.internSignals(state, id)
	if len(signals) == 0 {
		return signals
	}
	byID := make(map[string]domain.Response, len(responses))
	for _, response := range responses {
		byID[response.ID] = response
	}
	pointsByResponse := map[string][]domain.MetricPoint{}
	for _, point := range state.Metrics {
		if _, ok := byID[point.ResponseID]; ok && point.InternshipID == id {
			pointsByResponse[point.ResponseID] = append(pointsByResponse[point.ResponseID], point)
		}
	}

	items := []domain.Signal{}
	for _, signal := range signals {
		if signal.Status == "resolved" || signal.Status == "dismissed" {
			continue
		}
		// An edited or superseded answer must not be cited as current evidence.
		evidence := make([]domain.Evidence, 0, len(signal.Evidence))
		for _, source := range signal.Evidence {
			response, ok := byID[source.SourceID]
			if ok && (source.InternshipID == "" || source.InternshipID == id) &&
				validSurveyEvidence(signal, source, response, pointsByResponse[response.ID]) {
				evidence = append(evidence, source)
			}
		}
		if len(evidence) > 0 {
			signal.Evidence = evidence
			items = append(items, signal)
		}
	}
	sort.SliceStable(items, func(i, j int) bool {
		if urgencyRank(items[i].Urgency) != urgencyRank(items[j].Urgency) {
			return urgencyRank(items[i].Urgency) > urgencyRank(items[j].Urgency)
		}
		return items[i].UpdatedAt.After(items[j].UpdatedAt)
	})
	return items
}

func validSurveyEvidence(signal domain.Signal, source domain.Evidence, response domain.Response, points []domain.MetricPoint) bool {
	switch {
	case signal.Rule == "help_keywords" && source.Type == "quote":
		return response.HasSubmittedQuote(source.Quote)
	case (signal.Rule == "low_scale_threshold" || signal.Rule == "positive_scale_threshold") && source.Type == "metric":
		for _, point := range points {
			if point.Dimension == signal.Dimension && point.Value == source.Value {
				return true
			}
		}
	}
	return false
}

func (s *Service) UpdateInternship(ctx context.Context, actorID, id string, patch InternshipPatch) (domain.Internship, error) {
	var result domain.Internship
	err := s.store.Update(ctx, func(state *domain.State) error {
		actor, err := s.actor(state, actorID)
		if err != nil {
			return err
		}
		if actor.Role != domain.RoleHR {
			return domain.ErrForbidden
		}
		internship, ok := state.Internships[id]
		if !ok {
			return domain.ErrNotFound
		}
		if patch.Stage != nil {
			if *patch.Stage == "" {
				return invalid("stage is empty")
			}
			internship.Stage = *patch.Stage
		}
		if patch.Progress != nil {
			if *patch.Progress < 0 || *patch.Progress > 100 {
				return invalid("progress must be 0..100")
			}
			internship.Progress = *patch.Progress
		}
		if patch.Settings != nil {
			internship.Settings = patch.Settings
		}
		internship.LastActivity = s.now()
		state.Internships[id] = internship
		state.Touch()
		result = internship
		return nil
	})
	return result, err
}

func (s *Service) internSignals(state *domain.State, internshipID string) []domain.Signal {
	items := []domain.Signal{}
	for _, id := range domain.SortedKeys(state.Signals) {
		if state.Signals[id].InternshipID == internshipID {
			items = append(items, state.Signals[id])
		}
	}
	return items
}

func (s *Service) internCoverage(state *domain.State, internshipID string) domain.Coverage {
	result := domain.Coverage{}
	unique := map[string]bool{}
	for _, assignment := range state.Assignments {
		if assignment.InternshipID == internshipID {
			result.Invited++
			if assignment.Status == "submitted" {
				result.Submitted++
				unique[assignment.RespondentID] = true
			}
		}
	}
	result.Unique = len(unique)
	if result.Invited > 0 {
		result.Percent = float64(result.Submitted) * 100 / float64(result.Invited)
	}
	return result
}

func (s *Service) internMetrics(state *domain.State, internshipID string) map[string]float64 {
	values := map[string][]float64{}
	for _, point := range state.Metrics {
		if point.InternshipID == internshipID {
			values[point.Dimension] = append(values[point.Dimension], point.Value)
		}
	}
	result := map[string]float64{}
	for dimension, nums := range values {
		result[dimension] = avg(nums)
	}
	return result
}

func (s *Service) internTrends(state *domain.State, internshipID string) []map[string]any {
	points := []domain.MetricPoint{}
	for _, point := range state.Metrics {
		if point.InternshipID == internshipID {
			points = append(points, point)
		}
	}
	return buildTrends(points)
}
