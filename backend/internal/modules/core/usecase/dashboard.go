package usecase

import (
	"context"
	"fmt"
	"sort"
	"strconv"

	"mgts/backend/internal/modules/core/domain"
	identity "mgts/backend/internal/modules/identity/usecase"
)

func (s *Service) Dashboard(ctx context.Context, actorID string) (map[string]any, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return nil, err
	}
	if actor.Role == domain.RoleIntern {
		return nil, domain.ErrForbidden
	}
	internships := identity.ScopedInternships(state, actor)
	allowed := map[string]bool{}
	for _, internship := range internships {
		allowed[internship.ID] = true
	}
	points := []domain.MetricPoint{}
	invited, submitted := 0, 0
	unique := map[string]bool{}
	roleValues := map[domain.Role][]float64{}
	for _, point := range state.Metrics {
		if allowed[point.InternshipID] {
			points = append(points, point)
			roleValues[point.Role] = append(roleValues[point.Role], point.Value)
		}
	}
	for _, assignment := range state.Assignments {
		if !allowed[assignment.InternshipID] {
			continue
		}
		invited++
		if assignment.Status == "submitted" {
			submitted++
			unique[assignment.RespondentID] = true
		}
	}
	coverage := 0.0
	if invited > 0 {
		coverage = float64(submitted) * 100 / float64(invited)
	}
	cohorts := []map[string]any{}
	for _, id := range domain.SortedKeys(state.Cohorts) {
		cohort := state.Cohorts[id]
		count, progress := 0, 0
		for _, internship := range internships {
			if internship.CohortID == id {
				count++
				progress += internship.Progress
			}
		}
		if count > 0 {
			cohorts = append(cohorts, map[string]any{"id": id, "name": cohort.Name, "interns": count, "average_progress": progress / count})
		}
	}

	internList, err := s.Interns(ctx, actorID, InternFilters{})
	if err != nil {
		return nil, err
	}
	scores := calculateInternshipScores(state)
	latestValues, overallValues := []float64{}, []float64{}
	cohortAverage := 0.0
	for _, internship := range internships {
		score := scores[internship.ID]
		if score.latestWave > 0 {
			latestValues = append(latestValues, score.latestScore)
			overallValues = append(overallValues, score.overallScore)
		}
		cohortAverage = score.cohortAverage
	}
	latestAverage := avg(latestValues)
	return map[string]any{
		"metrics": map[string]any{
			"interns": len(internships), "average_coverage": coverage,
			"active_cohorts": len(cohorts), "average_score": latestAverage,
		},
		"items": internList["items"], "dimension_trends": buildTrends(points), "cohorts": cohorts,
		"coverage": map[string]any{"invited": invited, "submitted": submitted, "unique": len(unique), "percent": coverage},
		"averages": map[string]any{
			"latest_score": latestAverage, "overall_score": avg(overallValues),
			"cohort_average": cohortAverage,
			"intern":         avg(roleValues[domain.RoleIntern]), "mentor": avg(roleValues[domain.RoleMentor]),
		},
		"updated_at": s.now(),
	}, nil
}

func urgencyRank(value string) int {
	switch value {
	case "critical":
		return 4
	case "high":
		return 3
	case "medium":
		return 2
	default:
		return 1
	}
}

func sortedFloatKeys(values map[string][]float64) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func itoa(value int) string            { return strconv.Itoa(value) }
func formatFloat(value float64) string { return fmt.Sprintf("%.1f", value) }
