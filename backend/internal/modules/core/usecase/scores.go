package usecase

import (
	"fmt"
	"math"

	"mgts/backend/internal/modules/core/domain"
)

// internshipScore contains the exact percentile only for internal sorting and
// calculation. Public DTOs expose percentileMin/Max, never the exact rank.
type internshipScore struct {
	latestScore     float64
	overallScore    float64
	cohortAverage   float64
	percentile      float64
	percentileMin   int
	percentileMax   int
	percentileLabel string
	trafficLight    string
	department      string
	currentPeriod   string
	latestWave      int
}

func calculateInternshipScores(state *domain.State) map[string]internshipScore {
	overall := map[string][]float64{}
	byWave := map[string]map[int][]float64{}
	for _, point := range state.Metrics {
		if point.Role != domain.RoleIntern {
			continue
		}
		if _, exists := state.Internships[point.InternshipID]; !exists {
			continue
		}
		overall[point.InternshipID] = append(overall[point.InternshipID], point.Value)
		if byWave[point.InternshipID] == nil {
			byWave[point.InternshipID] = map[int][]float64{}
		}
		byWave[point.InternshipID][point.Wave] = append(byWave[point.InternshipID][point.Wave], point.Value)
	}

	result := map[string]internshipScore{}
	latestSum := 0.0
	latestCount := 0
	for id, internship := range state.Internships {
		latestWave := 0
		for wave := range byWave[id] {
			if wave > latestWave {
				latestWave = wave
			}
		}
		latest := 0.0
		if latestWave > 0 {
			latest = avg(byWave[id][latestWave])
			latestSum += latest
			latestCount++
		}
		period := ""
		if latestWave > 0 {
			period = fmt.Sprintf("Месяц %d", latestWave)
		}
		result[id] = internshipScore{
			latestScore: latest, overallScore: avg(overall[id]), latestWave: latestWave,
			trafficLight: trafficLight(latest, latestWave > 0), department: internship.Team,
			currentPeriod: period,
		}
	}
	cohortAverage := 0.0
	if latestCount > 0 {
		cohortAverage = latestSum / float64(latestCount)
	}
	for id, score := range result {
		worse, equal, total := 0, 0, 0
		for _, other := range result {
			if other.latestWave == 0 {
				continue
			}
			total++
			switch {
			case other.latestScore < score.latestScore-1e-9:
				worse++
			case math.Abs(other.latestScore-score.latestScore) <= 1e-9:
				equal++
			}
		}
		if score.latestWave > 0 && total > 0 {
			score.percentile = 100 * (float64(worse) + 0.5*float64(equal)) / float64(total)
		}
		score.cohortAverage = cohortAverage
		score.percentileMin, score.percentileMax = percentileBucket(score.percentile)
		score.percentileLabel = fmt.Sprintf("%d–%d", score.percentileMin, score.percentileMax)
		result[id] = score
	}
	return result
}

func percentileBucket(percentile float64) (int, int) {
	if percentile >= 100 {
		return 80, 100
	}
	minimum := int(math.Floor(percentile/20)) * 20
	if minimum < 0 {
		minimum = 0
	}
	maximum := minimum + 20
	if maximum > 100 {
		maximum = 100
	}
	return minimum, maximum
}

func trafficLight(score float64, hasResponses bool) string {
	if !hasResponses {
		return "gray"
	}
	switch {
	case score >= 4:
		return "green"
	case score >= 3:
		return "yellow"
	default:
		return "red"
	}
}

func (score internshipScore) fields() map[string]any {
	return map[string]any{
		"latest_score":     score.latestScore,
		"overall_score":    score.overallScore,
		"cohort_average":   score.cohortAverage,
		"percentile_min":   score.percentileMin,
		"percentile_max":   score.percentileMax,
		"percentile_label": score.percentileLabel,
		"traffic_light":    score.trafficLight,
		"department":       score.department,
		"current_period":   score.currentPeriod,
	}
}

func mergeFields(target map[string]any, fields map[string]any) map[string]any {
	for key, value := range fields {
		target[key] = value
	}
	return target
}

func internshipFields(internship domain.Internship) map[string]any {
	return map[string]any{
		"id": internship.ID, "intern": internship.Intern, "program": internship.Program,
		"cohort": internship.Cohort, "cohort_id": internship.CohortID,
		"team": internship.Team, "team_id": internship.TeamID, "stage": internship.Stage,
		"manager": internship.Manager, "mentor": internship.Mentor,
		"progress": internship.Progress, "last_activity": internship.LastActivity,
	}
}
