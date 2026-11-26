package domain

import (
	"fmt"
	"strings"
)

func QuestionVersion(question Question) int {
	if question.Version < 1 {
		return 1
	}
	return question.Version
}

// QuestionDefinitionSignature changes whenever answers are no longer comparable.
// Titles and descriptions are deliberately excluded because copy edits do not alter scale semantics.
func QuestionDefinitionSignature(question Question) string {
	return fmt.Sprintf("%s|%s|%s|%d|%d|%s", question.ID, question.Type, question.Dimension, question.Min, question.Max, strings.Join(question.Options, "\x1f"))
}

func QuestionScaleSignature(question Question) string {
	return fmt.Sprintf("%s|v%d|%s", question.ID, QuestionVersion(question), QuestionDefinitionSignature(question))
}

func MetricScaleSignature(point MetricPoint) string {
	if point.ScaleSignature != "" {
		return point.ScaleSignature
	}
	if point.QuestionID != "" {
		version := point.QuestionVersion
		if version < 1 {
			version = 1
		}
		min, max := point.ScaleMin, point.ScaleMax
		if min == 0 && max == 0 {
			min, max = 1, 5
		}
		return fmt.Sprintf("%s|v%d|%d-%d", point.QuestionID, version, min, max)
	}
	// Legacy points predate explicit versions. They remain visible but are never
	// mixed with explicitly versioned points introduced later.
	return "legacy"
}
