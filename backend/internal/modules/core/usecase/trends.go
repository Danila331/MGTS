package usecase

import (
	"fmt"
	"sort"

	"mgts/backend/internal/modules/core/domain"
)

type trendGroup struct {
	dimension, signature, questionID    string
	role                                domain.Role
	questionVersion, scaleMin, scaleMax int
	byWave                              map[int][]float64
}

// buildTrends never combines incompatible question versions or scales. Delta is
// calculated only between adjacent waves of the same compatible series.
func buildTrends(points []domain.MetricPoint) []map[string]any {
	groups := map[string]*trendGroup{}
	for _, point := range points {
		signature := domain.MetricScaleSignature(point)
		key := string(point.Role) + "\x00" + point.Dimension + "\x00" + signature
		group := groups[key]
		if group == nil {
			min, max := point.ScaleMin, point.ScaleMax
			if min == 0 && max == 0 {
				min, max = 1, 5
			}
			group = &trendGroup{dimension: point.Dimension, role: point.Role, signature: signature, questionID: point.QuestionID,
				questionVersion: point.QuestionVersion, scaleMin: min, scaleMax: max, byWave: map[int][]float64{}}
			groups[key] = group
		}
		group.byWave[point.Wave] = append(group.byWave[point.Wave], point.Value)
	}
	keys := make([]string, 0, len(groups))
	for key := range groups {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	result := make([]map[string]any, 0, len(keys))
	for _, key := range keys {
		group := groups[key]
		waves := make([]int, 0, len(group.byWave))
		for wave := range group.byWave {
			waves = append(waves, wave)
		}
		sort.Ints(waves)
		series := []map[string]any{}
		all := []float64{}
		var previous *float64
		previousWave := 0
		for _, wave := range waves {
			value := avg(group.byWave[wave])
			point := map[string]any{"wave": wave, "period": fmt.Sprintf("Месяц %d", wave), "value": value, "responses": len(group.byWave[wave]), "delta": nil}
			if previous != nil && previousWave == wave-1 {
				point["delta"] = value - *previous
			}
			previousValue := value
			previous = &previousValue
			previousWave = wave
			series = append(series, point)
			all = append(all, group.byWave[wave]...)
		}
		result = append(result, map[string]any{"dimension": group.dimension, "role": group.role, "question_id": group.questionID,
			"question_version": group.questionVersion, "scale_min": group.scaleMin, "scale_max": group.scaleMax,
			"scale_signature": group.signature, "average": avg(all), "points": series})
	}
	return result
}
