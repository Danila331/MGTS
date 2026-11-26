package usecase

import (
	"time"

	"mgts/backend/internal/modules/core/domain"
)

// activeResponse returns the newest active response deterministically. Storage may
// contain legacy duplicates; ingestion and submission repair them on the next write.
func activeResponse(state *domain.State, assignmentID string) (string, domain.Response, bool) {
	var selectedID string
	var selected domain.Response
	for id, response := range state.Responses {
		if response.AssignmentID != assignmentID || response.Status != "submitted" {
			continue
		}
		if selectedID == "" || response.UpdatedAt.After(selected.UpdatedAt) || (response.UpdatedAt.Equal(selected.UpdatedAt) && id > selectedID) {
			selectedID, selected = id, response
		}
	}
	return selectedID, selected, selectedID != ""
}

func supersedeResponse(state *domain.State, responseID string, now time.Time) {
	response, ok := state.Responses[responseID]
	if !ok {
		return
	}
	response.Status = "superseded"
	response.UpdatedAt = now
	state.Responses[responseID] = response
	for metricID, point := range state.Metrics {
		if point.ResponseID == responseID {
			delete(state.Metrics, metricID)
		}
	}
}

func supersedeOtherActiveResponses(state *domain.State, assignmentID, keepID string, now time.Time) {
	for id, response := range state.Responses {
		if id != keepID && response.AssignmentID == assignmentID && response.Status == "submitted" {
			supersedeResponse(state, id, now)
		}
	}
}

func discardDrafts(state *domain.State, assignmentID string) {
	for id, response := range state.Responses {
		if response.AssignmentID == assignmentID && response.Status == "draft" {
			delete(state.Responses, id)
		}
	}
}
